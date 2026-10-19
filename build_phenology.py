"""Pre-builds the iNaturalist records behind two questions on the A.T. Resource Grid:
"When does it flower here?" and "Where are forest pests turning up?".

The dashboard used to page through the iNaturalist API in each visitor's browser, 200 records at a time, the first time a
species was picked. This script runs the same queries once (weekly, from the GitHub Action) and writes:

  phen/index.json        when it ran, the project, and per species: records kept, research-grade count, newest record ids
  phen/<species key>.json the records themselves: [day of year, year, stage, lat, lon, iNaturalist id]

The dashboard loads phen/<key>.json from the site, then asks iNaturalist only for records newer than the file
(usually one small request). Species not in the files still load live, as before.

The species list is read from index.html (the PHEN list), so adding a species there is enough; the next run picks it up.
Stages: 1 flowers, 3 flower buds (plants); 4 adults, 5 any record (insects and pathogens).
Records with obscured or private locations are left out, as on the dashboard.

Standard library only. Run:  python build_phenology.py           (every species)
                             python build_phenology.py bloodroot  (species whose key contains the text)
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

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
            species.append({'common': common, 'sci': sci, 'key': re.sub(r'[^a-z]+', '-', sci.lower()), 'kind': kind,
                            'pest': group == 'Forest pests'})
    return project, species

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
    for sp in species:
        print(sp['common'], '(' + sp['sci'] + ')', flush=True)
        try:
            out = build(sp, project, T)
        except Exception as e:
            print('  FAILED, keeping the previous file:', e, flush=True); failed.append(sp['common']); continue
        with open(os.path.join(OUT, sp['key'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, separators=(',', ':'))
        e = {'at': out['at'], 'n': len(out['pts']), 'top': out['top'], 'taxon': out['taxon'], 'kept': out['kept'], 'drop': out['drop']}
        for k in ('cnt', 'nid'):
            if k in out: e[k] = out[k]
        spx[sp['key']] = e
    index = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'project': project, 'species': spx}
    with open(ipath, 'w', encoding='utf-8') as f: json.dump(index, f, separators=(',', ':'), indent=None)
    print(f'Done. {len(species) - len(failed)} built' + (f'; failed: {", ".join(failed)}' if failed else ''))
    if failed and len(failed) == len(species): sys.exit(1)

if __name__ == '__main__':
    main()
