"""
Quarterly iNaturalist and eBird summaries for the A.T. Resource Grid, without ArcGIS.

  1. Requests GBIF downloads (iNaturalist research-grade observations; eBird Observation Dataset) for the corridor,
     waits for GBIF to prepare them and downloads them. Each download has its own DOI, logged in the output.
  2. Places every record in its 1, 7 and 49 sq mi corridor cells (the grid read from index.html).
  3. Summarizes each cell the way the ArcGIS notebooks did: counts, observers, species, coverage-based richness,
     taxon groups, invasive / priority (EDRR) / forest pest lists from invasive_lookup.csv, the ten most-recorded
     species; for birds, checklists, habitat guild counts and lists (bird_guilds.csv) and species of concern
     (bird_lookup.csv: federal listing, Birds of Conservation Concern, Partners in Flight for A.T. BCRs).
  4. Writes inat_ebird.json, which the dashboard loads in place of the summaries built into index.html,
     and prints a comparison with those built-in summaries.

Usage: python build_inat_ebird.py [inat|ebird|both]      (GBIF_USER and GBIF_PWD in the environment)
Re-running with a dataset left out keeps that dataset's part of the existing inat_ebird.json.
Standard library only.
"""
import base64, csv, io, json, math, os, re, sys, time, urllib.request, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'inat_ebird.json')
NAMES = os.path.join(HERE, 'common_names.json')    # cache of common names looked up on GBIF, kept between runs
INDEX = os.path.join(HERE, 'index.html')
API = 'https://api.gbif.org/v1'
DATASETS = {'inat': '50c9509d-22c7-4a22-a47d-8c48425ef4a7',    # iNaturalist Research-grade Observations
            'ebird': '4fa7b334-ce0d-4e88-aaae-2e0c138d049e'}   # EOD - eBird Observation Dataset
WAIT_HOURS = 4                  # how long to wait for GBIF to prepare a download
MAX_UNCERTAINTY_M = 400         # iNaturalist: drop records located less precisely than this
LOW_SAMPLE = {'inat': 25, 'ebird': 10}   # below this (observations / checklists) a cell is "Low sample"
COVERAGE_TARGET, MIN_UNITS = 0.90, 10    # coverage-based richness (Chao & Jost 2012), as in the notebooks
RECENT_YEARS = 3
AT_BCRS = {13, 14, 28, 29, 30}
PESTS = {'Adelges tsugae': 'Hemlock woolly adelgid', 'Agrilus planipennis': 'Emerald ash borer', 'Fiorinia externa': 'Elongate hemlock scale',
         'Litylenchus crenatae': 'Beech leaf disease nematode', 'Lycorma delicatula': 'Spotted lanternfly', 'Lymantria dispar': 'Spongy moth'}
GUILDS = {'Forest Interior': 'FOREST_INT', 'Forest Generalist': 'FOREST_GEN', 'High-elevation Conifer': 'CONIFER', 'Shrub-dependent': 'SHRUB',
          'Grassland Obligate': 'GRASS', 'Edge Generalist': 'EDGE', 'Wetland': 'WETLAND', 'Riparian': 'RIPARIAN', 'Waterbird': 'WATERBIRD',
          'Shorebirds': 'SHORE', 'Seabirds': 'SEABIRD'}
GROUPS = [('PLANT_SPP', lambda r: r['kingdom'] == 'Plantae'), ('BIRD_SPP', lambda r: r['class'] == 'Aves'), ('INSECT_SPP', lambda r: r['class'] == 'Insecta'),
          ('FUNGI_SPP', lambda r: r['kingdom'] == 'Fungi'), ('MAMMAL_SPP', lambda r: r['class'] == 'Mammalia'), ('AMPHIB_SPP', lambda r: r['class'] == 'Amphibia'),
          ('REPTILE_SPP', lambda r: r['class'] in ('Reptilia', 'Squamata', 'Testudines', 'Crocodylia'))]
csv.field_size_limit(10 ** 8)


# ---------------------------------------------------------------- grid (from the dashboard itself)
def load_grid():
    h = open(INDEX, encoding='utf-8').read()
    m = re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S)
    D = json.loads(m.group(1)); levels = {}
    for lv in ('hex', 'cog', 'wheel'):
        L = D['levels'][lv]; rings = []
        for g in L['g']:
            la, lo = g[0], g[1]; r = [(la / 1e5, lo / 1e5)]
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; r.append((la / 1e5, lo / 1e5))
            rings.append(r)
        levels[lv] = {'id': L['id'], 'mi': L['mi'], 'rings': rings, 'bins': bins(rings)}
    return D, levels


def bins(rings, size=.05):
    b = defaultdict(list)
    for c, r in enumerate(rings):
        s_, n_ = min(p[0] for p in r), max(p[0] for p in r); w_, e_ = min(p[1] for p in r), max(p[1] for p in r)
        for i in range(int(s_ // size), int(n_ // size) + 1):
            for j in range(int(w_ // size), int(e_ // size) + 1):
                b[(i, j)].append((c, s_, n_, w_, e_))
    return b


def in_ring(la, lo, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        yi, xi = ring[i]; yj, xj = ring[j]
        if (yi > la) != (yj > la) and lo < (xj - xi) * (la - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def cell_of(L, la, lo, size=.05):
    for c, s_, n_, w_, e_ in L['bins'].get((int(la // size), int(lo // size)), ()):
        if s_ <= la <= n_ and w_ <= lo <= e_ and in_ring(la, lo, L['rings'][c]):
            return c
    return -1


# ---------------------------------------------------------------- GBIF download
def gbif(path, data=None, auth=None, method=None):
    req = urllib.request.Request(API + path, data=data, method=method, headers={'Content-Type': 'application/json', 'User-Agent': 'AT-Resource-Grid'})
    if auth:
        req.add_header('Authorization', 'Basic ' + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode()


def area_predicate(levels):
    # rectangles around stretches of ten 49 sq mi cells, counter-clockwise as GBIF requires; records are trimmed to the cells afterwards
    W = levels['wheel']; order = sorted(range(len(W['id'])), key=lambda c: W['mi'][c]); polys = []
    for i in range(0, len(order), 10):
        pts = [p for c in order[i:i + 10] for p in W['rings'][c]]
        s_, n_ = min(p[0] for p in pts) - .01, max(p[0] for p in pts) + .01; w_, e_ = min(p[1] for p in pts) - .01, max(p[1] for p in pts) + .01
        polys.append({'type': 'within', 'geometry': f'POLYGON(({w_:.4f} {s_:.4f},{e_:.4f} {s_:.4f},{e_:.4f} {n_:.4f},{w_:.4f} {n_:.4f},{w_:.4f} {s_:.4f}))'})
    return {'type': 'or', 'predicates': polys}


def download(kind, levels):
    user, pwd = os.environ.get('GBIF_USER'), os.environ.get('GBIF_PWD')
    if not user or not pwd:
        sys.exit('GBIF_USER and GBIF_PWD are not set (repository secrets)')
    body = {'creator': user, 'sendNotification': False, 'format': 'SIMPLE_CSV',
            'predicate': {'type': 'and', 'predicates': [
                {'type': 'equals', 'key': 'DATASET_KEY', 'value': DATASETS[kind]},
                {'type': 'equals', 'key': 'HAS_COORDINATE', 'value': 'true'},
                {'type': 'equals', 'key': 'HAS_GEOSPATIAL_ISSUE', 'value': 'false'},
                {'type': 'equals', 'key': 'OCCURRENCE_STATUS', 'value': 'PRESENT'},
                area_predicate(levels)]}}
    key = gbif('/occurrence/download/request', json.dumps(body).encode(), f'{user}:{pwd}', 'POST').strip()
    print(f'{kind}: GBIF download {key} requested', flush=True)
    stop = time.time() + WAIT_HOURS * 3600
    while True:
        info = json.loads(gbif(f'/occurrence/download/{key}'))
        st = info.get('status')
        if st == 'SUCCEEDED':
            break
        if st in ('FAILED', 'KILLED', 'CANCELLED') or time.time() > stop:
            sys.exit(f'{kind}: GBIF download {key} {st or "timed out"}')
        print(f'   {st}, {info.get("totalRecords") or "?"} records so far; checking again in 2 minutes', flush=True)
        time.sleep(120)
    path = os.path.join(HERE, f'{kind}_{key}.zip')
    with urllib.request.urlopen(urllib.request.Request(info['downloadLink'], headers={'User-Agent': 'AT-Resource-Grid'}), timeout=600) as r, open(path, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    print(f'{kind}: {info.get("totalRecords")} records, {os.path.getsize(path) // (1 << 20)} MB, DOI {info.get("doi")}', flush=True)
    return path, {'key': key, 'doi': info.get('doi'), 'records': info.get('totalRecords'), 'created': info.get('created')}


def rows(zpath):
    z = zipfile.ZipFile(zpath)
    name = next(n for n in z.namelist() if n.endswith('.csv'))
    with z.open(name) as f:
        rd = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8', errors='replace', newline=''), delimiter='\t', quoting=csv.QUOTE_NONE)
        for r in rd:
            yield r


# ---------------------------------------------------------------- lookups and names
def norm(s):
    s = re.sub(r'\s+(var\.|subsp\.|ssp\.|f\.)\s+', ' ', (s or '').strip())
    return re.sub(r'\s+', ' ', s.replace('×', 'x')).lower()


def binomial(s):
    w = (s or '').split()
    return ' '.join(w[:2]) if len(w) >= 2 and w[1] not in ('x', '×') else (s or '').strip()


def load_invasive():
    inv = {}
    for r in csv.DictReader(open(os.path.join(HERE, 'invasive_lookup.csv'), encoding='utf-8-sig')):
        v = (r['INV_CLASS'], r.get('APP_EDRR') == '1', r.get('COMMON_NAME') or '')
        for n in (r['SCI_NAME'], r.get('INAT_NAME')):
            if n:
                inv.setdefault(norm(n), v)
    return inv


def load_birds():
    look = {}
    for r in csv.DictReader(open(os.path.join(HERE, 'bird_lookup.csv'), encoding='utf-8-sig')):
        look[norm(r['SCI_NAME'])] = r
        for a in (r.get('SOURCE_NAMES') or '').split(';'):
            if a.strip():
                look.setdefault(norm(a), r)
    guild = {}
    for r in csv.DictReader(open(os.path.join(HERE, 'bird_guilds.csv'), encoding='utf-8-sig')):
        guild[norm(r['SCI_NAME'])] = r
        for a in re.split(r'[;,]', r.get('ALT_SCI_NAMES') or ''):
            if a.strip():
                guild.setdefault(norm(a), r)
    common = {norm(r['SCI_NAME']): r['COMMON_NAME'] for r in csv.DictReader(open(os.path.join(HERE, 'ebird_common_names.csv'), encoding='utf-8-sig'))}
    return look, guild, common


def bcrs(s):
    return {int(x) for x in re.findall(r'\b(\d{1,3})\b', s or '')}


def soc_tags(r):
    if not r:
        return []
    t = []
    if r.get('FED_STATUS') and r.get('FED_APPLIES_AT') == 'Y':
        t.append('ESA ' + r['FED_STATUS'])
    rw = (r.get('BCC_RANGEWIDE') or '').strip()
    if rw.startswith('Yes') or bcrs(r.get('BCC_BCR_BREED')) & AT_BCRS or bcrs(r.get('BCC_BCR_NONBREED')) & AT_BCRS:
        t.append('BCC ssp.' if rw.startswith('Yes -') else 'BCC')
    if bcrs(r.get('PIF_BCRS')) & AT_BCRS:
        t.append('PIF')
    return t


# ---------------------------------------------------------------- statistics (incidence data, Chao & Jost 2012, as in the notebooks)
def lchoose(n, k):
    return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1) if 0 <= k <= n else None


def cov_richness(inc, T, target=COVERAGE_TARGET):
    """species expected at 90% sample coverage; None with fewer than MIN_UNITS units or past twice the effort"""
    Q = [q for q in inc.values() if q > 0]
    if T < MIN_UNITS or not Q:
        return None, None
    U = sum(Q); q1 = sum(1 for q in Q if q == 1); q2 = sum(1 for q in Q if q == 2); S = len(Q)
    A = (T - 1) * q1 / ((T - 1) * q1 + 2 * q2) if q1 else 0
    if q1 and not q2:
        A = (T - 1) * (q1 - 1) / ((T - 1) * (q1 - 1) + 2) if q1 > 1 else 0
    def C(t):
        if t < T:
            tot = 0.0
            for q in Q:
                a, b = lchoose(T - q, t), lchoose(T - 1, t)
                if a is not None and b is not None:
                    tot += q / U * math.exp(a - b)
            return 1 - tot
        return 1 - q1 / U * A ** (t - T + 1)
    def Sx(t):
        if t <= T:
            tot = 0.0
            for q in Q:
                a, b = lchoose(T - q, t), lchoose(T, t)
                tot += 1 - (math.exp(a - b) if a is not None and b is not None else 0)
            return tot
        q0 = (T - 1) / T * (q1 * q1 / (2 * q2) if q2 else q1 * (q1 - 1) / 2)
        return S + (q0 * (1 - (1 - q1 / (T * q0 + q1)) ** (t - T)) if q0 > 0 else 0)
    sc = C(T)
    if sc >= target:
        lo_, hi_ = 1, T
        if C(1) >= target:
            return round(Sx(1), 1), round(100 * sc, 1)
        while hi_ - lo_ > 1:
            mid = (lo_ + hi_) // 2
            if C(mid) >= target: hi_ = mid
            else: lo_ = mid
        c0, c1 = C(lo_), C(hi_); f = (target - c0) / (c1 - c0) if c1 > c0 else 0
        return round(Sx(lo_) + f * (Sx(hi_) - Sx(lo_)), 1), round(100 * sc, 1)
    if not q1 or A <= 0 or A >= 1:
        return None, round(100 * sc, 1)
    t = T - 1 + math.log((1 - target) * U / q1) / math.log(A)
    if t > 2 * T:
        return None, round(100 * sc, 1)
    return round(Sx(t), 1), round(100 * sc, 1)


# ---------------------------------------------------------------- common names from GBIF
def vernacular(spp, keys, budget=25 * 60):
    try:
        cache = json.load(open(NAMES))
    except Exception:
        cache = {}
    todo = [x for x in spp if norm(x) not in cache and keys.get(x)]
    print(f'common names: {len(spp)} species without one in the dashboard or lookups; {len(todo)} to look up on GBIF', flush=True)
    stop = time.time() + budget
    def one(x):
        if time.time() > stop:
            return x, None
        try:
            j = json.loads(gbif(f'/species/{keys[x]}/vernacularNames?limit=200'))
        except Exception:
            return x, None
        en = [v for v in j.get('results', []) if (v.get('language') or '').lower() in ('eng', 'en')]
        if not en:
            return x, ''
        pick = next((v['vernacularName'] for v in en if 'inaturalist' in (v.get('source') or '').lower()), None)
        if not pick:
            pick = Counter(v['vernacularName'].strip() for v in en).most_common(1)[0][0]
        return x, pick.strip()
    with ThreadPoolExecutor(8) as pool:
        for x, v in pool.map(one, todo):
            if v is not None:
                cache[norm(x)] = v
    json.dump(cache, open(NAMES, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    got = {k: v for k, v in cache.items() if v}
    print(f'common names: {sum(1 for x in spp if got.get(norm(x)))} of {len(spp)} found', flush=True)
    return got


# ---------------------------------------------------------------- summaries
def new_cell():
    return {'n': 0, 'users': set(), 'units': set(), 'spp': defaultdict(int), 'inc': defaultdict(set), 'last': '', 'recent': 0, 'grp': defaultdict(set),
            'inv': defaultdict(int), 'pest': defaultdict(int), 'nonnat': set(), 'breed': set()}


def summarize(kind, zpath, levels, names):
    inv = load_invasive() if kind == 'inat' else None
    look, guild, common = load_birds() if kind == 'ebird' else (None, None, None)
    cells = {lv: defaultdict(new_cell) for lv in levels}
    cutoff = str(date.today().year - RECENT_YEARS)
    n_in = n_all = 0; t0 = time.time(); keys = {}
    for r in rows(zpath):
        n_all += 1
        try:
            la, lo = float(r['decimalLatitude']), float(r['decimalLongitude'])
        except (TypeError, ValueError):
            continue
        if kind == 'inat':
            u = r.get('coordinateUncertaintyInMeters')
            if u and u.replace('.', '', 1).isdigit() and float(u) > MAX_UNCERTAINTY_M:
                continue
        hit = {lv: cell_of(levels[lv], la, lo) for lv in levels}
        if hit['wheel'] < 0 and hit['cog'] < 0 and hit['hex'] < 0:
            continue
        n_in += 1
        d = (r.get('eventDate') or '')[:10]; who = (r.get('recordedBy') or '').strip().lower()
        if kind == 'ebird':
            sp = binomial(r.get('verbatimScientificName') or r.get('species'))
            if not sp or '/' in sp or ' sp.' in sp or ' x ' in sp.lower() or len(sp.split()) < 2:
                sp = None
            unit = f'{who}|{d}|{la:.3f}|{lo:.3f}'     # checklist: observer, date and place
        else:
            sp = (r.get('species') or '').strip() or None
            unit = f'{who}|{d}'                        # visit: observer and date
        for lv, c in hit.items():
            if c < 0:
                continue
            s = cells[lv][c]; s['n'] += 1
            if who: s['users'].add(who)
            if d: s['units'].add(unit); s['last'] = max(s['last'], d)
            if d[:4] >= cutoff: s['recent'] += 1
            if not sp:
                continue
            s['spp'][sp] += 1
            if d: s['inc'][sp].add(unit)
            if sp not in keys and r.get('speciesKey'): keys[sp] = r['speciesKey']
            if kind == 'inat':
                for g, test in GROUPS:
                    if test(r): s['grp'][g].add(sp)
                if sp in PESTS or binomial(r.get('verbatimScientificName')) in PESTS:
                    s['pest'][sp] += 1
                v = inv.get(norm(r.get('verbatimScientificName'))) or inv.get(norm(sp))
                if v and r['kingdom'] == 'Plantae':
                    s['nonnat'].add(sp)
                    if v[0] == 'Priority':
                        s['inv'][sp] += 1
            elif d[5:7] in ('06', '07'):
                s['breed'].add(sp)
        if n_all % 500000 == 0:
            print(f'   {kind}: {n_all:,} rows read, {n_in:,} in corridor cells ({time.time() - t0:.0f} s)', flush=True)
    print(f'{kind}: {n_all:,} rows, {n_in:,} in corridor cells', flush=True)
    # every species gets a common name: dashboard and lookup names first, then GBIF's English vernacular names (cached)
    have = lambda x: names.get(norm(x)) or (common or {}).get(norm(x)) or (inv.get(norm(x), (0, 0, ''))[2] if inv else '') or PESTS.get(x)
    missing = sorted({sp for lv in cells for c in cells[lv].values() for sp in c['spp'] if not have(sp)})
    names.update(vernacular(missing, keys))

    def nm(sp, tags=None):
        k = norm(sp); c = names.get(k) or (common.get(k) if common else None) or (inv.get(k, (0, 0, ''))[2] if inv else '') or PESTS.get(sp, '')
        c = c[:1].upper() + c[1:] if c else ''
        return (f'{c} ({sp})' if c else sp) + (f' [{", ".join(tags)}]' if tags else '')
    out = {}
    for lv in levels:
        ids, F = [], defaultdict(list)
        for c in sorted(cells[lv]):
            s = cells[lv][c]; T = len(s['units']); inc = {k: len(v) for k, v in s['inc'].items()}
            cr, sc = cov_richness(inc, T)
            v = {'N_OBSERVERS': len(s['users']), 'N_SPP': len(s['spp']), 'COV_RICHNESS': None if cr is None else int(round(cr)),
                 'SAMPLE_COVERAGE': None if sc is None else int(round(sc)), 'LAST_OBS': s['last'] or None}
            top = sorted(s['spp'].items(), key=lambda kv: (-kv[1], kv[0]))[:10]
            if kind == 'inat':
                n = s['n']; ed = sorted(sp for sp in s['inv'] if inv.get(norm(sp), (0, False))[1])
                v.update(DATA_STATUS='Adequate' if n >= LOW_SAMPLE['inat'] else 'Low sample', N_OBS=n, N_OBS_RECENT=s['recent'],
                         N_NONNATIVE_SPP=len(s['nonnat']), N_INV_SPP=len(s['inv']), N_INV_OBS=sum(s['inv'].values()),
                         PCT_INV_OBS=round(100 * sum(s['inv'].values()) / n, 1) if n else 0, N_EDRR_SPP=len(ed), N_PEST_OBS=sum(s['pest'].values()),
                         INVASIVE_LIST=sorted((nm(x) for x in s['inv']), key=str.lower), EDRR_LIST=sorted((nm(x) for x in ed), key=str.lower),
                         PEST_LIST=sorted((nm(x) for x in s['pest']), key=str.lower), TOP10_SPECIES=[nm(x) for x, _ in top], TOP10_COUNTS=[k for _, k in top])
                for g, _ in GROUPS:
                    v[g] = len(s['grp'][g])
            else:
                spp = list(s['spp']); info = {x: (look.get(norm(x)), guild.get(norm(x))) for x in spp}
                soc = [(x, soc_tags(info[x][0])) for x in spp]; soc = [(x, t) for x, t in soc if t]
                v.update(DATA_STATUS='Adequate' if T >= LOW_SAMPLE['ebird'] else 'Low sample', N_CHECKLISTS=T, N_RECORDS=s['n'],
                         BREED_SEASON_SPP=len(s['breed']), N_SOC_SPP=len(soc), N_BCC_SPP=sum(1 for _, t in soc if any(x.startswith('BCC') for x in t)),
                         N_PIF_SPP=sum(1 for _, t in soc if 'PIF' in t), SOC_LIST=sorted((nm(x, t) for x, t in soc), key=str.lower),
                         N_NEOTROP_SPP=sum(1 for x in spp if (info[x][1] or info[x][0] or {}).get('MIGRATION') == 'Neotropical migrant'))
                for gname, g in GUILDS.items():
                    L = [x for x in spp if ((info[x][1] or info[x][0] or {}).get('HABITAT_GUILD') or '') == gname]
                    v[g + '_SPP'] = len(L); v[g + '_LIST'] = sorted((nm(x) for x in L), key=str.lower)
            ids.append(levels[lv]['id'][c])
            for k, x in v.items():
                F[k].append(x)
        out[lv] = {'ids': ids, 'f': dict(F)}
        print(f'   {kind} {lv}: {len(ids)} cells with records', flush=True)
    return out


def pack(themes):
    """species strings into one shared list (lists hold indices), DATA_STATUS into a category index, as index.html does"""
    spp, si, cats = [], {}, ['Low sample', 'Adequate', 'Incidental only']
    def ix(s):
        if s not in si:
            si[s] = len(spp); spp.append(s)
        return si[s]
    for th in themes.values():
        for t in th.values():
            for k, col in t['f'].items():
                if k == 'DATA_STATUS':
                    t['f'][k] = [cats.index(x) for x in col]
                elif k.endswith('_LIST') or k == 'TOP10_SPECIES':
                    t['f'][k] = [[ix(s) for s in L] if L else [] for L in col]
    return spp, {'DATA_STATUS': cats}


def compare(D, themes):
    """how the new summaries line up with the ones built into index.html"""
    for th, t in themes.items():
        for lv in ('hex', 'wheel'):
            old = D['themes'].get(th, {}).get(lv)
            if not old:
                continue
            oid = {D['levels'][lv]['id'][c]: k for k, c in enumerate(old['ix'])}
            f = 'N_OBS' if th == 'inat' else 'N_CHECKLISTS'
            pairs = [(old['f'][f][oid[i]], t[lv]['f'][f][k]) for k, i in enumerate(t[lv]['ids']) if i in oid]
            if pairs:
                a = sum(p[0] for p in pairs); b = sum(p[1] for p in pairs)
                print(f'compare {th} {lv}: {len(t[lv]["ids"])} cells now, {len(old["ix"])} before, {len(pairs)} in both; {f} total {b:,} now vs {a:,} before', flush=True)


def main():
    which = (sys.argv[1] if len(sys.argv) > 1 else 'inat').lower()
    kinds = ['inat', 'ebird'] if which == 'both' else [which]
    D, levels = load_grid()
    names = {}
    for s in D['spp']:
        m = re.match(r'^(.*?)\s*\(([^)]*)\)', s)
        if m: names.setdefault(norm(m.group(2)), m.group(1))
    prev = {}
    try:
        prev = json.load(open(OUT))
    except Exception:
        pass
    themes, meta = {}, prev.get('meta', {})
    # keep the other dataset from the previous file (unpacked back to strings)
    for th, t in (prev.get('themes') or {}).items():
        if th in kinds:
            continue
        for lv in t.values():
            for k, col in lv['f'].items():
                if k == 'DATA_STATUS':
                    lv['f'][k] = [prev['cats']['DATA_STATUS'][x] for x in col]
                elif k.endswith('_LIST') or k == 'TOP10_SPECIES':
                    lv['f'][k] = [[prev['spp'][i] for i in L] if L else [] for L in col]
        themes[th] = t
    for k in kinds:
        path, info = download(k, levels)
        themes[k] = summarize(k, path, levels, names)
        meta[k] = dict(info, built=datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        os.remove(path)
    compare(D, themes)
    spp, cats = pack(themes)
    q = (date.today().month - 1) // 3 + 1
    json.dump({'run': f'{date.today().year} Q{q}', 'meta': meta, 'spp': spp, 'cats': cats, 'themes': themes},
              open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
