"""
Builds place_names.json for the A.T. Resource Grid search: every named place in the USGS Geographic Names Information
System (GNIS, The National Map "geonames" service) — towns, summits, gaps, streams, falls, lakes, churches, schools and more — within the
HUC10 shell (the 49 sq mi cells in soils_wetlands_huc10.json; the corridor cells in at_wheel_cells.json if that is missing).

Standard library only. Run by the Historic resources workflow on GitHub (it reuses that workflow's monthly schedule).
The service's layers and field names are read from the service itself, so small schema changes do not break the build.
If the service cannot be reached the existing place_names.json is kept.
"""
import builtins, csv, io, json, os, re, sys, time, urllib.parse, urllib.request, zipfile
LOG = []
def print(*a, **k):
    LOG.append(' '.join(str(x) for x in a)[:600]); builtins.print(*a, **k)
from concurrent.futures import ThreadPoolExecutor

SCRIPTS = os.path.dirname(os.path.abspath(__file__))          # scripts/
HERE = os.path.dirname(SCRIPTS)                                  # the repository: index.html
DATA = os.path.join(HERE, 'data')                                # what the dashboard loads
INPUTS = os.path.join(HERE, 'inputs')                            # tables kept by hand
CACHE = os.path.join(HERE, 'cache')                              # kept between runs; the dashboard never loads these
for _d in (DATA, INPUTS, CACHE): os.makedirs(_d, exist_ok=True)
OUT = os.path.join(DATA, 'place_names.json')
UA = {'User-Agent': 'AT-Resource-Grid place names build (NPS Appalachian National Scenic Trail)'}
SERVICES = ['https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer',
            'https://carto-wfs.nationalmap.gov/arcgis/rest/services/geonames/MapServer']
BUDGET = 15 * 60
# first choice: the GNIS Domestic Names files (pipe-delimited text, one zip per state) from The National Map download bucket
BUCKET = 'https://prd-tnm.s3.amazonaws.com'
PREFIX = 'StagedProducts/GeographicNames/DomesticNames/'
AT_STATES = ['GA', 'NC', 'TN', 'VA', 'WV', 'MD', 'PA', 'NJ', 'NY', 'CT', 'MA', 'VT', 'NH', 'ME']
STATE_ABBR = {'Georgia': 'GA', 'North Carolina': 'NC', 'Tennessee': 'TN', 'Virginia': 'VA', 'West Virginia': 'WV', 'Maryland': 'MD', 'Pennsylvania': 'PA',
              'New Jersey': 'NJ', 'New York': 'NY', 'Connecticut': 'CT', 'Massachusetts': 'MA', 'Vermont': 'VT', 'New Hampshire': 'NH', 'Maine': 'ME'}
# every GNIS name in the shell is kept (towns, summits, gaps, streams, churches, schools, cemeteries ...); the search ranks them


def get_json(url, tries=2, timeout=45):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            print(f'   retry {k + 1}: {e}', flush=True); time.sleep(3)
    raise RuntimeError('no answer from ' + url.split('?')[0])


def in_ring(la, lo, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        yi, xi = ring[i]; yj, xj = ring[j]
        if (yi > la) != (yj > la) and lo < (xj - xi) * (la - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def load_cells():
    try:
        w = json.load(open(os.path.join(DATA, 'soils_wetlands_huc10.json')))['levels']['wheel']
        cells = []
        for g, mi in zip(w['g'], w['mi']):
            la, lo = g[0], g[1]; ring = [[la / 1e5, lo / 1e5]]
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; ring.append([la / 1e5, lo / 1e5])
            cells.append({'mi': mi, 'ring': ring})
        return sorted(cells, key=lambda c: c['mi'])
    except Exception:
        return json.load(open(os.path.join(INPUTS, 'at_wheel_cells.json')))


def pick(fields, *pats):
    names = [f['name'] for f in fields]
    for p in pats:
        for n in names:
            if re.fullmatch(p, n, re.I):
                return n
    for p in pats:
        for n in names:
            if re.search(p, n, re.I):
                return n
    return None


class CellIndex:
    """the HUC10 cells binned by 0.2 degree, so each name is tested against only the few cells near it"""
    def __init__(self, cells):
        self.bins = {}
        for c in cells:
            r = c['ring']; s_, n_ = min(p[0] for p in r), max(p[0] for p in r); w_, e_ = min(p[1] for p in r), max(p[1] for p in r)
            for i in range(int(s_ // .2), int(n_ // .2) + 1):
                for j in range(int(w_ // .2), int(e_ // .2) + 1):
                    self.bins.setdefault((i, j), []).append((s_, n_, w_, e_, r))
    def inside(self, la, lo):
        for s_, n_, w_, e_, r in self.bins.get((int(la // .2), int(lo // .2)), ()):
            if s_ <= la <= n_ and w_ <= lo <= e_ and in_ring(la, lo, r):
                return True
        return False


def get_bytes(url, timeout=180):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def from_files(cells):
    """every GNIS domestic name in the AT states, kept when it falls in a HUC10 cell; None if the files cannot be reached"""
    try:
        xml = get_bytes(f'{BUCKET}/?list-type=2&prefix={urllib.parse.quote(PREFIX)}', 60).decode('utf-8', 'replace')
    except Exception as e:
        print('GNIS file listing not reached:', repr(e), flush=True); return None
    keys = re.findall(r'<Key>([^<]+\.zip)</Key>', xml)
    print('GNIS files listed:', len(keys), [k.rsplit('/', 1)[-1] for k in keys][:40], flush=True)
    text = [k for k in keys if re.search(r'text', k, re.I)] or keys
    per_state = {st: next((k for k in text if re.search(rf'[_/-]{st}[_.-]', k)), None) for st in AT_STATES}
    if all(per_state.values()):
        files = list(per_state.values())
    else:
        nat = next((k for k in text if re.search(r'national', k, re.I)), None)
        if not nat:
            print('GNIS files: no per-state or national text file found', flush=True); return None
        files = [nat]
    idx = CellIndex(cells); out = {}; stop = time.time() + BUDGET
    for k in files:
        if time.time() > stop:
            print('GNIS files: time budget used up', flush=True); break
        try:
            z = zipfile.ZipFile(io.BytesIO(get_bytes(f'{BUCKET}/{k}')))
        except Exception as e:
            print('   ', k, repr(e), flush=True); continue
        print('   ', k, 'members:', z.namelist()[:6], flush=True)
        for member in z.namelist():
            if not member.lower().endswith('.txt'):
                continue
            rd = csv.reader(io.TextIOWrapper(z.open(member), encoding='utf-8-sig', errors='replace'), delimiter='|')
            head = [h.strip().lower() for h in next(rd)]
            col = lambda *ps: next((head.index(h) for p in ps for h in head if re.fullmatch(p, h)), None)
            iid, inm, icl = col(r'feature_id'), col(r'feature_name'), col(r'feature_class')
            ist, ila, ilo = col(r'state_alpha', r'state_name'), col(r'prim_lat_dec'), col(r'prim_long_dec')
            if None in (inm, ila, ilo):
                print('   unexpected columns in', member, head[:20], flush=True); continue
            n0 = len(out)
            for row in rd:
                try:
                    la, lo = float(row[ila]), float(row[ilo])
                except (ValueError, IndexError):
                    continue
                if not la or not idx.inside(la, lo):
                    continue
                st = row[ist].strip() if ist is not None else ''
                key = row[iid] if iid is not None else f'{row[inm]}|{la:.4f}|{lo:.4f}'
                out[key] = {'n': row[inm].strip(), 'k': row[icl].strip() if icl is not None else '', 'la': round(la, 5), 'lo': round(lo, 5), 's': STATE_ABBR.get(st, st)}
            print(f'   {member}: {len(out) - n0} names in the HUC10 shell', flush=True)
    return out or None


def main():
    cells = load_cells()
    out = from_files(cells)
    if out:
        return write(out, 0)
    print('falling back to the geonames map service', flush=True)
    svc = meta = None
    for u in SERVICES:
        try:
            meta = get_json(u + '?f=json'); svc = u; break
        except Exception as e:
            print('service:', e, flush=True)
    if not svc:
        return save_log_only('GNIS service not reached; keeping the existing file')
    layers = []
    for L in meta.get('layers', []):
        try:
            lm = get_json(f"{svc}/{L['id']}?f=json")
        except Exception:
            continue
        if lm.get('type') != 'Feature Layer' or lm.get('geometryType') != 'esriGeometryPoint':
            continue
        f = lm.get('fields') or []
        nm = pick(f, r'gaz_name', r'feature_name', r'name')
        if not nm:
            continue
        layers.append({'id': L['id'], 'title': L.get('name', ''), 'name': nm, 'cls': pick(f, r'gaz_featureclass', r'feature_class', r'class'),
                       'fid': pick(f, r'gaz_id', r'feature_id', r'gnis_id'), 'st': pick(f, r'state_alpha', r'state'), 'max': lm.get('maxRecordCount') or 1000})
    print('layers:', [(l['id'], l['title'], l['name'], l['cls']) for l in layers], flush=True)
    print('all layers in the service:', [(L.get('id'), L.get('name')) for L in meta.get('layers', [])], flush=True)
    if not layers:
        return save_log_only('no point layers with names found; keeping the existing file')
    chunks = []
    for i in range(0, len(cells), 10):
        rings = [c['ring'] for c in cells[i:i + 10]]; pts = [p for r in rings for p in r]
        chunks.append({'rings': rings, 's': min(p[0] for p in pts), 'n': max(p[0] for p in pts), 'w': min(p[1] for p in pts), 'e': max(p[1] for p in pts)})
    stop = time.time() + BUDGET; out = {}; failed = 0

    def job(args):
        L, ch = args
        if time.time() > stop:
            return L, ch, None
        res, off = [], 0
        try:
            while True:
                q = urllib.parse.urlencode({'where': '1=1', 'geometry': json.dumps({'xmin': ch['w'], 'ymin': ch['s'], 'xmax': ch['e'], 'ymax': ch['n'], 'spatialReference': {'wkid': 4326}}),
                                            'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
                                            'outFields': ','.join(x for x in [L['name'], L['cls'], L['fid'], L['st']] if x), 'returnGeometry': 'true', 'outSR': 4326,
                                            'resultOffset': off, 'resultRecordCount': min(1000, L['max']), 'f': 'json'})
                j = get_json(f"{svc}/{L['id']}/query?{q}")
                if 'error' in j:
                    raise RuntimeError(j['error'].get('message', 'service error'))
                fs = j.get('features') or []; res += fs
                if not j.get('exceededTransferLimit') or not fs:
                    return L, ch, res
                off += len(fs)
        except Exception as e:
            print('   ', L['id'], e, flush=True)
            return L, ch, None

    with ThreadPoolExecutor(4) as pool:
        for n, (L, ch, fs) in enumerate(pool.map(job, [(L, ch) for ch in chunks for L in layers]), 1):
            if fs is None:
                failed += 1; continue
            for f in fs:
                a, g = f.get('attributes') or {}, f.get('geometry') or {}
                if g.get('x') is None:
                    continue
                name = str(a.get(L['name']) or '').strip(); cls = str(a.get(L['cls']) or '').strip() if L['cls'] else ''
                if not name:
                    continue
                la, lo = round(g['y'], 5), round(g['x'], 5)
                if not any(in_ring(la, lo, r) for r in ch['rings']):
                    continue
                key = a.get(L['fid']) if L['fid'] else f'{name}|{la:.3f}|{lo:.3f}'
                out[key] = {'n': name, 'k': cls, 'la': la, 'lo': lo, **({'s': a.get(L['st'])} if L['st'] and a.get(L['st']) else {})}
            if n % 50 == 0:
                print(f'GNIS: {n} of {len(chunks) * len(layers)} requests, {len(out)} names', flush=True)
    if not out:
        return save_log_only('no names found; keeping the existing file')
    write(out, failed)


def save_log_only(reason):
    # keep the existing names, but record what happened so the run can be checked from the repository
    print(reason)
    try:
        j = json.load(open(OUT))
    except Exception:
        j = {'rows': [], 'classes': [], 'states': []}
    j['log'] = LOG[-80:]; j['log_at'] = int(time.time() * 1000)
    json.dump(j, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)


def write(out, failed):
    # compact rows to keep the file small: [name, class index, lat, lon, state index]
    items = sorted(out.values(), key=lambda x: x['n'])
    classes = sorted({x['k'] for x in items}); states = sorted({x.get('s') or '' for x in items})
    ci = {c: i for i, c in enumerate(classes)}; si = {c: i for i, c in enumerate(states)}
    rows = [[x['n'], ci[x['k']], x['la'], x['lo'], si[x.get('s') or '']] for x in items]
    json.dump({'at': int(time.time() * 1000), 'source': 'USGS Geographic Names Information System', 'incomplete': failed,
               'classes': classes, 'states': states, 'rows': rows, 'log': LOG[-80:]}, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, len(rows), 'names;', failed, 'requests failed;', os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
