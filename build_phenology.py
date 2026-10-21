"""Pre-builds the iNaturalist records behind three questions on the A.T. Resource Grid:
"When does it flower here?", "Where are forest pests turning up?" and
"Where are priority invasives spreading?" (the priority invasive plants in invasive_lookup.csv).

The dashboard used to page through the iNaturalist API in each visitor's browser, 200 records at a time, the first time a
species was picked. This script runs the same queries once (weekly, from the GitHub Action) and writes:

  phen/index.json        when it ran, the project, and per species: records kept, research-grade count, newest record ids
  phen/<species key>.json the records themselves: [day of year, year, stage, lat, lon, iNaturalist id]
                          and, for priority invasives and forest pests, EDDMapS reports in the HUC10 shell cells:
                          "edd": [day of year, year, lat, lon, EDDMapS id], "edd_dup": reports dropped as iNaturalist duplicates

EDDMapS (the public EDDMapS points service, read with the helpers in build_inat_ebird.py) is fetched once per run for every
spread species. Rows of one report (same species, date and spot) are kept once, and a report within 50 m and a day of
one of the species' iNaturalist records is dropped, since it is the same sighting. If EDDMapS cannot be reached, each
species keeps the EDDMapS reports from its previous file.

The dashboard loads phen/<key>.json from the site, then asks iNaturalist only for records newer than the file
(usually one small request). Species not in the files still load live, as before.

The species list is read from index.html (the PHEN list), so adding a species there is enough; the next run picks it up.
Stages: 1 flowers, 3 flower buds (plants); 4 adults, 5 any record (insects and pathogens).
Records with obscured or private locations are left out, as on the dashboard.

Standard library only. Run:  python build_phenology.py           (every species)
                             python build_phenology.py bloodroot  (species whose key contains the text)
"""
import csv, json, math, os, re, sys, time, urllib.parse, urllib.request
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'phen')
API = os.environ.get('INAT_API', 'https://api.inaturalist.org')
PAUSE = float(os.environ.get('INAT_PAUSE', '1.1'))   # iNaturalist asks for about one request a second
FIELDS = '(id:!t,observed_on:!t,quality_grade:!t,obscured:!t,geoprivacy:!t,taxon_geoprivacy:!t,geojson:all)'
UA = 'AT-Resource-Grid phenology build (github.com/Creese333/AT-Resource-Grid)'

_last = [0.0]
def get(path, params):
    """GET a JSON page from the iNaturalist API, politely paced, with a few retries."""
    url = API + path + '?' + urllib.parse.urlencode(params, safe='(),:!')
    for attempt in range(5):
        wait = PAUSE - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            code = getattr(e, 'code', None)
            if code in (400, 404, 422): raise
            print(f'  retry {attempt + 1} after {e}', flush=True)
            time.sleep(min(60, 5 * 2 ** attempt))
    raise RuntimeError('iNaturalist did not answer: ' + url)

def read_config():
    """The iNaturalist project and the PHEN species list from index.html."""
    h = open(os.path.join(HERE, 'index.html'), encoding='utf-8').read()
    m = re.search(r"project:\s*'([^']*)'", h)
    project = m.group(1) if m else ''
    a = h.index('const PHEN = [') + len('const PHEN = ')
    depth, i = 0, a
    while True:
        ch = h[i]
        if ch == "'":
            i = h.index("'", i + 1)
        elif h.startswith('/*', i):
            i = h.index('*/', i) + 1
        elif ch == '[': depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0: break
        i += 1
    src = re.sub(r'/\*.*?\*/', '', h[a:i + 1], flags=re.S)
    src = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: json.dumps(m.group(1)), src)
    src = re.sub(r',\s*([\]}])', r'\1', src)
    groups = json.loads(src)
    species = []
    for group, items in groups:
        for it in items:
            common, sci = it[0], it[1]
            kind = it[2] if len(it) > 2 and it[2] else 'plant'
            st = SETS.get(group, 'phen')
            if st == 'pinv': continue   # the priority invasives come from invasive_lookup.csv (read_priority), so the CSV is the one list
            species.append({'common': common, 'sci': sci, 'key': re.sub(r'[^a-z]+', '-', sci.lower()), 'kind': kind,
                            'set': st, 'pest': st != 'phen'})
    have = {s['key'] for s in species}
    for sp in read_priority():
        if sp['key'] not in have: species.append(sp); have.add(sp['key'])
    return project, species

SETS = {'Forest pests': 'pest', 'Early detection (EDRR)': 'pinv', 'Established priority': 'pinv', 'Priority invasive plants': 'pinv'}
PINV_GROUP = {'EDRR': 'Early detection (EDRR)', 'Priority': 'Established priority'}
PRIO_TRUE = ('1', 'y', 'yes', 'true', 'priority', 'high')

def read_priority():
    """The priority invasive plants from invasive_lookup.csv, the same rule as build_inat_ebird.py: APP_EDRR = 1 marks an
    early detection (EDRR) species, APPA_PRIORITY marks an established priority species. A subspecies or variety is dropped when its species is also listed (the species query includes it).
    Species added here appear on the dashboard through phen/index.json without editing index.html."""
    path = os.path.join(HERE, 'invasive_lookup.csv')
    if not os.path.exists(path): return []
    rows = [r for r in csv.DictReader(open(path, encoding='utf-8-sig'))
            if str(r.get('APP_EDRR', '')).strip() == '1' or str(r.get('APPA_PRIORITY', '')).strip().lower() in PRIO_TRUE]
    names = [(r.get('INAT_NAME') or r.get('SCI_NAME') or '').strip() for r in rows]
    out, seen = [], set()
    for r, n in zip(rows, names):
        if not n or n.lower() in seen or any(n != m and n.startswith(m + ' ') for m in names): continue
        seen.add(n.lower())
        c = (r.get('COMMON_NAME') or '').strip()
        c = (c[0].upper() + c[1:]) if c and c.lower() != 'grass' else n
        tier = 'EDRR' if str(r.get('APP_EDRR', '')).strip() == '1' else 'Priority'
        out.append({'common': c, 'sci': n, 'key': re.sub(r'[^a-z]+', '-', n.lower()), 'kind': 'spread', 'set': 'pinv', 'pest': True,
                    'tier': tier, 'group': PINV_GROUP[tier]})
    return out

def terms():
    """Annotation ids, looked up by name (iNaturalist renames terms now and then), with the known ids as the fallback."""
    T = {'fl': [12, 13], 'bd': [12, 15], 'ad': [1, 2]}
    try:
        res = get('/v1/controlled_terms', {}).get('results', [])
        val = lambda t, rx: next((v['id'] for v in t.get('values', []) if re.search(rx, v.get('label') or '', re.I)), None)
        ff = next((t for t in res if t['id'] == 12), None) or next((t for t in res if re.search('flowers and fruits|phenology', t.get('label') or '', re.I)), None)
        if ff:
            T['fl'] = [ff['id'], val(ff, r'^flowers?$|^flowering$') or 13]
            T['bd'] = [ff['id'], val(ff, r'bud') or 15]
        ls = next((t for t in res if t['id'] == 1), None) or next((t for t in res if re.search('life stage', t.get('label') or '', re.I)), None)
        if ls: T['ad'] = [ls['id'], val(ls, r'^adult$') or 2]
    except Exception as e:
        print('  controlled terms lookup failed, using the known ids:', e)
    return T

def taxon_id(sci):
    res = get('/v1/taxa', {'per_page': 30, 'q': sci}).get('results', [])
    t = next((x for x in res if (x.get('name') or '').lower() == sci.lower()), None)
    if not t: t = next((x for x in res if (x.get('matched_term') or '').lower() == sci.lower()), None)  # a synonym iNaturalist matched
    if not t: raise RuntimeError('No iNaturalist taxon named ' + sci)
    return t['id']

def doy(d):
    try: t = datetime.strptime(d[:10], '%Y-%m-%d')
    except Exception: return None
    return t.timetuple().tm_yday

def keep(o):
    """[lat, lon] for a research-grade record with an open location, else None (same rule as the dashboard)."""
    if o.get('quality_grade') and o['quality_grade'] != 'research': return None
    if o.get('obscured') or o.get('geoprivacy') in ('obscured', 'private') or o.get('taxon_geoprivacy') in ('obscured', 'private'): return None
    c = (o.get('geojson') or {}).get('coordinates')
    return [round(float(c[1]), 5), round(float(c[0]), 5)] if c else None

V2 = [True]
def page(base, above):
    p = dict(base, quality_grade='research', order_by='id', order='asc', per_page=200, id_above=above)
    if V2[0]:
        try:
            j = get('/v2/observations', dict(p, fields=FIELDS))
            if not any((not o.get('geojson') and not o.get('obscured')) or 'observed_on' not in o for o in j.get('results', [])): return j
        except Exception as e:
            print('  v2 API failed, using v1:', e)
        V2[0] = False
    return get('/v1/observations', p)

def build(sp, project, T):
    tx = taxon_id(sp['sci'])
    base = {'taxon_id': tx}
    if project: base['project_id'] = project
    streams = [[3, T['bd']], [1, T['fl']]] if sp['kind'] == 'plant' else [[4, T['ad']], [5, None]] if sp['kind'] == 'adult' else [[5, None]]
    pts, top, total, drop, kept = [], {}, None, {}, {}
    for stage, tv in streams:
        q = dict(base)
        if tv: q.update(term_id=tv[0], term_value_id=tv[1])
        above, n0 = 0, len(pts)
        for _ in range(1000):
            j = page(q, above); res = j.get('results', [])
            if stage == 5 and total is None: total = j.get('total_results')
            for o in res:
                ll, d = keep(o), doy(o.get('observed_on') or '')
                if ll and d: pts.append([d, int(str(o['observed_on'])[:4]), stage, ll[0], ll[1], o['id']])
                else: drop[str(stage)] = drop.get(str(stage), 0) + 1   # hidden (obscured or private) or missing location or date
            if res: above = res[-1]['id']
            if len(res) < 200: break
        top[str(stage)] = above; kept[str(stage)] = len(pts) - n0
        print(f'  stage {stage}: {len(pts) - n0} records kept', flush=True)
    out = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'sci': sp['sci'], 'taxon': tx, 'top': top, 'kept': kept, 'drop': drop, 'pts': pts}
    if sp['pest']:
        if total is None:
            total = get('/v1/observations', dict(base, quality_grade='research', per_page=0)).get('total_results', 0)
        out['cnt'] = total
        out['nid'] = get('/v1/observations', dict(base, quality_grade='needs_id', per_page=0)).get('total_results', 0)
    return out

# ---------------------------------------------------------------- EDDMapS
EDD_SETS = ('pinv', 'pest')

def edd_names(sp):
    """the names a species may carry in EDDMapS: its own, and every lookup name (SCI_NAME, INAT_NAME) of the same species"""
    import build_inat_ebird as B
    canon, _ = B.load_canon(); k = B.ckey(sp['sci'], canon); out = {B.binomial(sp['sci'])}
    for r in csv.DictReader(open(os.path.join(HERE, 'invasive_lookup.csv'), encoding='utf-8-sig')):
        for n in (r.get('SCI_NAME'), r.get('INAT_NAME')):
            if n and B.ckey(n, canon) == k: out.add(B.binomial(n.replace('×', 'x')))
    return {n for n in out if len(n.split()) >= 2}

def edd_post(params, tries=6):
    import build_inat_ebird as B
    body = urllib.parse.urlencode(params).encode()
    for i in range(tries):
        try:
            req = urllib.request.Request(B.EDD_URL, data=body, headers={'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req, timeout=180) as r:
                j = json.loads(r.read().decode())
            if 'error' in j: raise RuntimeError(j['error'])
            return j
        except Exception as e:
            if i == tries - 1: raise
            print(f'  EDDMapS retry {i + 1} after {e}', flush=True); time.sleep(10 * (i + 1))

def edd_fetch(species):
    """EDDMapS reports of these species in the HUC10 shell cells, by species key: [(ordinal day, lat, lon, EDDMapS id)]"""
    import build_inat_ebird as B
    from concurrent.futures import ThreadPoolExecutor
    levels = B.load_huc() or B.load_grid()[1]; canon, _ = B.load_canon(); want, pats = {}, set()
    for sp in species:
        for n in edd_names(sp):
            want.setdefault(B.ckey(n, canon), sp['key']); pats.add(n)
    if not want: return {}
    like = ' OR '.join("Scientific_Name LIKE '" + n.replace("'", "''") + "%'" for n in sorted(pats))
    where = f'(hidden IS NULL OR hidden = 0) AND ({like})'; rects = B.area_rects(levels)
    def one(rc):
        s_, n_, w_, e_ = rc; out, off = [], 0
        while True:
            j = edd_post({'where': where, 'geometry': f'{w_:.4f},{s_:.4f},{e_:.4f},{n_:.4f}', 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
                          'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'OBJECTID_1,ObjectID,Scientific_Name,ObservationDate', 'returnGeometry': 'true',
                          'outSR': 4326, 'orderByFields': 'OBJECTID_1', 'resultOffset': off, 'resultRecordCount': B.EDD_PAGE, 'f': 'json'})
            fs = j.get('features') or []; out += fs; off += len(fs)
            if not fs or not (j.get('exceededTransferLimit') or len(fs) >= B.EDD_PAGE): return out
    got = {}
    with ThreadPoolExecutor(4) as pool:
        for fs in pool.map(one, rects):
            for f in fs:
                a = f.get('attributes') or {}; got[a.get('OBJECTID_1') or a.get('ObjectID')] = f
    res, seen, skip = {}, set(), {'other species': 0, 'no date': 0, 'outside the cells': 0, 'repeat rows': 0}
    for f in got.values():
        a, g = f.get('attributes') or {}, f.get('geometry') or {}
        key = want.get(B.ckey(a.get('Scientific_Name') or '', canon))
        if not key: skip['other species'] += 1; continue
        ms = a.get('ObservationDate')
        if not isinstance(ms, (int, float)): skip['no date'] += 1; continue
        try: la, lo = round(float(g['y']), 5), round(float(g['x']), 5)
        except (KeyError, TypeError, ValueError): skip['outside the cells'] += 1; continue
        if B.cell_of(levels['hex'], la, lo) < 0: skip['outside the cells'] += 1; continue
        o = datetime.fromtimestamp(ms / 1000, timezone.utc).date().toordinal()
        k = (key, o, round(la, 4), round(lo, 4))
        if k in seen: skip['repeat rows'] += 1; continue
        seen.add(k); res.setdefault(key, []).append((o, la, lo, a.get('ObjectID') or a.get('OBJECTID_1')))
    print(f'EDDMapS: {len(got):,} points fetched; ' + ', '.join(f'{v:,} {k}' for k, v in skip.items()) +
          f'; {sum(len(v) for v in res.values()):,} reports of {len(res)} species', flush=True)
    return res

def edd_attach(out, reps):
    """the species' EDDMapS reports, less those that match one of its iNaturalist records (within a day and 50 m)"""
    import build_inat_ebird as B
    near = {}
    for p in out['pts']:
        near.setdefault(date(p[1], 1, 1).toordinal() + p[0] - 1, []).append((p[3], p[4]))
    keep, dup = [], 0
    for o, la, lo, i in sorted(reps):
        cl = math.cos(math.radians(la))
        if any(math.hypot((pla - la) * 111320, (plo - lo) * 111320 * cl) <= B.DUP_M
               for oo in range(o - B.DUP_DAYS, o + B.DUP_DAYS + 1) for pla, plo in near.get(oo, ())):
            dup += 1; continue
        d = date.fromordinal(o); keep.append([d.timetuple().tm_yday, d.year, la, lo, i])
    out['edd'], out['edd_dup'] = keep, dup

def main():
    project, species = read_config()
    only = sys.argv[1].lower() if len(sys.argv) > 1 else ''
    if only: species = [s for s in species if only in s['key']]
    os.makedirs(OUT, exist_ok=True)
    ipath = os.path.join(OUT, 'index.json')
    try: index = json.load(open(ipath, encoding='utf-8'))
    except Exception: index = {}
    if index.get('project') != project: index = {}
    spx = index.get('species', {})
    T = terms(); failed = []
    print(f'Project {project or "(all iNaturalist)"}; {len(species)} species', flush=True)
    try:
        EDD = edd_fetch([s for s in species if s['set'] in EDD_SETS])
    except Exception as e:
        print('EDDMapS not reached; species keep their previous EDDMapS reports:', e, flush=True); EDD = None
    for sp in species:
        print(sp['common'], '(' + sp['sci'] + ')', flush=True)
        fpath = os.path.join(OUT, sp['key'] + '.json')
        try: prev = json.load(open(fpath, encoding='utf-8'))
        except Exception: prev = {}
        try:
            out = build(sp, project, T)
        except Exception as e:
            print('  FAILED, keeping the previous file:', e, flush=True); failed.append(sp['common'])
            if EDD is None or sp['set'] not in EDD_SETS or not prev.get('pts'): continue
            out = prev                                     # the old iNaturalist records, with this week's EDDMapS reports
        if sp['set'] in EDD_SETS:
            if EDD is not None:
                edd_attach(out, EDD.get(sp['key'], []))
                print(f"  EDDMapS: {len(out['edd'])} reports kept, {out['edd_dup']} matched iNaturalist records", flush=True)
            elif 'edd' in prev:
                out['edd'], out['edd_dup'] = prev['edd'], prev.get('edd_dup', 0)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(out, f, separators=(',', ':'))
        if out is prev:                                    # its index entry stays as it was, but for the EDDMapS count
            if sp['key'] in spx and 'edd' in out: spx[sp['key']].update(edd=len(out['edd']), edd_dup=out.get('edd_dup', 0))
            continue
        e = {'at': out['at'], 'n': len(out['pts']), 'top': out['top'], 'taxon': out['taxon'], 'kept': out['kept'], 'drop': out['drop'],
             'common': sp['common'], 'sci': sp['sci'], 'set': sp['set']}
        if sp.get('tier'): e['tier'] = sp['tier']
        for k in ('cnt', 'nid'):
            if k in out: e[k] = out[k]
        if 'edd' in out: e['edd'], e['edd_dup'] = len(out['edd']), out.get('edd_dup', 0)
        spx[sp['key']] = e
    keys = {s['key'] for s in species}
    for k, e in spx.items():   # keep tier and names current even for a species whose download failed this time
        s = next((x for x in species if x['key'] == k), None)
        if s and s.get('tier'): e.update(tier=s['tier'], common=s['common'])
    if not only:   # a full run drops species no longer on any list, and their files
        for k in [k for k in spx if k not in keys]:
            del spx[k]
            try: os.remove(os.path.join(OUT, k + '.json'))
            except OSError: pass
    index = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'project': project, 'species': spx}
    with open(ipath, 'w', encoding='utf-8') as f: json.dump(index, f, separators=(',', ':'), indent=None)
    print(f'Done. {len(species) - len(failed)} built' + (f'; failed: {", ".join(failed)}' if failed else ''))
    if failed and len(failed) == len(species): sys.exit(1)

if __name__ == '__main__':
    main()
