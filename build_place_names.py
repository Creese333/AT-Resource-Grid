"""
Builds place_names.json for the A.T. Resource Grid search: every named place in the USGS Geographic Names Information
System (GNIS, The National Map "geonames" service) — towns, summits, gaps, streams, falls, lakes, churches, schools and more — within the
HUC10 shell (the 49 sq mi cells in soils_wetlands_huc10.json; the corridor cells in at_wheel_cells.json if that is missing).

Standard library only. Run by the Historic resources workflow on GitHub (it reuses that workflow's monthly schedule).
The service's layers and field names are read from the service itself, so small schema changes do not break the build.
If the service cannot be reached the existing place_names.json is kept.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'place_names.json')
UA = {'User-Agent': 'AT-Resource-Grid place names build (NPS Appalachian National Scenic Trail)'}
SERVICES = ['https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer',
            'https://carto-wfs.nationalmap.gov/arcgis/rest/services/geonames/MapServer']
BUDGET = 15 * 60
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
        w = json.load(open(os.path.join(HERE, 'soils_wetlands_huc10.json')))['levels']['wheel']
        cells = []
        for g, mi in zip(w['g'], w['mi']):
            la, lo = g[0], g[1]; ring = [[la / 1e5, lo / 1e5]]
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; ring.append([la / 1e5, lo / 1e5])
            cells.append({'mi': mi, 'ring': ring})
        return sorted(cells, key=lambda c: c['mi'])
    except Exception:
        return json.load(open(os.path.join(HERE, 'at_wheel_cells.json')))


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


def main():
    svc = meta = None
    for u in SERVICES:
        try:
            meta = get_json(u + '?f=json'); svc = u; break
        except Exception as e:
            print('service:', e, flush=True)
    if not svc:
        sys.exit('GNIS service not reached; keeping the existing file')
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
    if not layers:
        sys.exit('no point layers with names found; keeping the existing file')
    cells = load_cells(); chunks = []
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
        sys.exit('no names found; keeping the existing file')
    # compact rows to keep the file small: [name, class index, lat, lon, state index]
    items = sorted(out.values(), key=lambda x: x['n'])
    classes = sorted({x['k'] for x in items}); states = sorted({x.get('s') or '' for x in items})
    ci = {c: i for i, c in enumerate(classes)}; si = {c: i for i, c in enumerate(states)}
    rows = [[x['n'], ci[x['k']], x['la'], x['lo'], si[x.get('s') or '']] for x in items]
    json.dump({'at': int(time.time() * 1000), 'source': 'USGS Geographic Names Information System', 'incomplete': failed,
               'classes': classes, 'states': states, 'rows': rows}, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, len(rows), 'names;', failed, 'requests failed;', os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
