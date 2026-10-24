"""
Quarterly iNaturalist and eBird summaries for the A.T. Resource Grid, without ArcGIS.

  1. Requests GBIF downloads (iNaturalist research-grade observations; eBird Observation Dataset) for the corridor,
     waits for GBIF to prepare them and downloads them. Each download has its own DOI, logged in the output.
  2. Places every record in its 1, 7 and 49 sq mi cells, twice: the A.T. corridor grid (read from index.html) and the HUC10 shell
     grid (read from soils_wetlands_huc10.json).
  3. Summarizes each cell the way the ArcGIS notebooks did: counts, observers, species, coverage-based richness,
     taxon groups, invasive / priority (EDRR) / forest pest lists from invasive_lookup.csv, plants of cultural significance
     from cultural_plants.csv, the ten most-recorded species; for birds, checklists, habitat guild counts and lists (bird_guilds.csv) and species of concern
     (bird_lookup.csv: federal listing, Birds of Conservation Concern, Partners in Flight for A.T. BCRs).
  4. Adds EDDMapS invasive species points (the public EDDMapS feature service), placed in the same cells and counted for the
     invasive plants and forest pests on the same lists. Duplicates are dropped: EDDMapS rows for the same species, date and spot
     (treatment and monitoring rows of one report), and EDDMapS records of a species that iNaturalist has on the same day (one day
     either way) within 50 m, which are counted once, as iNaturalist records. Runs with every iNaturalist rebuild.
  5. Writes inat_ebird.json (corridor) and inat_ebird_huc10.json (HUC10 shell), which the dashboard loads in place of the summaries built into index.html,
     and prints a comparison with those built-in summaries.

Usage: python build_inat_ebird.py [inat|ebird|both]      (GBIF_USER and GBIF_PWD in the environment)
inat rebuilds iNaturalist and EDDMapS; ebird rebuilds eBird; both rebuilds all three.
Re-running with a dataset left out keeps that dataset's part of the existing inat_ebird.json. If EDDMapS cannot be reached,
its previous summaries are kept and the rest of the build goes on.
Standard library only.
"""
import base64, csv, io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'inat_ebird.json')                 # A.T. corridor cells
OUT_HUC = os.path.join(HERE, 'inat_ebird_huc10.json')       # HUC10 shell cells
HUCFILE = os.path.join(HERE, 'soils_wetlands_huc10.json')
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
          ('REPTILE_SPP', lambda r: r['class'] in ('Reptilia', 'Squamata', 'Testudines', 'Crocodylia')), ('ARACHNID_SPP', lambda r: r['class'] == 'Arachnida'),
          ('MOLLUSK_SPP', lambda r: r['phylum'] == 'Mollusca')]
# EDDMapS: public points service (EDDMapS, University of Georgia Center for Invasive Species and Ecosystem Health)
EDD_URL = 'https://services2.arcgis.com/PYn6bWCjT6bhw1z3/arcgis/rest/services/EDDMapSPoints/FeatureServer/0/query'
EDD_FIELDS = 'OBJECTID_1,ObjectID,Scientific_Name,SUB_name,ObservationDate,Treatment,Abundance_Name,Infested_Area,Area_Units,InfestedAreaAcres'
AREA_UNITS = {'acre': 1, 'acres': 1, 'ac': 1, 'square feet': 1 / 43560, 'square foot': 1 / 43560, 'sq ft': 1 / 43560, 'sqft': 1 / 43560, 'hectare': 2.47105, 'hectares': 2.47105, 'ha': 2.47105,
              'square meters': 0.000247105, 'square meter': 0.000247105, 'square metres': 0.000247105, 'sq m': 0.000247105, 'square miles': 640, 'square mile': 640,
              'square kilometers': 247.105, 'square kilometer': 247.105, 'square yards': 1 / 4840, 'square yard': 1 / 4840}
EDD_PAGE = 2000                 # the service's page size
DUP_M, DUP_DAYS = 50, 1         # an EDDMapS record this close to an iNaturalist record of the same species, this many days apart, is the same record
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


def area_rects(levels):
    # rectangles (south, north, west, east) around stretches of ten 49 sq mi cells; records are trimmed to the cells afterwards
    W = levels['wheel']; order = sorted(range(len(W['id'])), key=lambda c: W['mi'][c]); out = []
    for i in range(0, len(order), 10):
        pts = [p for c in order[i:i + 10] for p in W['rings'][c]]
        out.append((min(p[0] for p in pts) - .01, max(p[0] for p in pts) + .01, min(p[1] for p in pts) - .01, max(p[1] for p in pts) + .01))
    return out


def area_predicate(levels):
    # the rectangles counter-clockwise, as GBIF requires
    polys = [{'type': 'within', 'geometry': f'POLYGON(({w_:.4f} {s_:.4f},{e_:.4f} {s_:.4f},{e_:.4f} {n_:.4f},{w_:.4f} {n_:.4f},{w_:.4f} {s_:.4f}))'}
             for s_, n_, w_, e_ in area_rects(levels)]
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
        # priority invasive: Appalachian EDRR list, or marked in the APPA_PRIORITY column (1, Y, Yes, Priority or High)
        pri = r.get('APP_EDRR') == '1' or (r.get('APPA_PRIORITY') or '').strip().lower() in ('1', 'y', 'yes', 'true', 'priority', 'high')
        v = (r['INV_CLASS'], pri, r.get('COMMON_NAME') or '')
        for n in (r['SCI_NAME'], r.get('INAT_NAME')):
            if n:
                inv.setdefault(norm(n), v)
    return inv


def load_canon():
    """any name on the invasive lookup (SCI_NAME or INAT_NAME) or the pest list -> one key per species, and that key's lookup name"""
    canon, sci = {}, {}
    for r in csv.DictReader(open(os.path.join(HERE, 'invasive_lookup.csv'), encoding='utf-8-sig')):
        k = norm(r['SCI_NAME']); sci.setdefault(k, r['SCI_NAME'].strip())
        for n in (r['SCI_NAME'], r.get('INAT_NAME')):
            if n:
                canon.setdefault(norm(n), k); canon.setdefault(norm(binomial(n)), k)
    for p in PESTS:
        canon.setdefault(norm(p), norm(p)); sci.setdefault(norm(p), p)
    return canon, sci


def load_cultural():
    """cultural_plants.csv: any name (SCI_NAME or ALT_NAMES) -> (lookup name, sensitive); 'Genus spp.' rows match the whole genus"""
    out, genus = {}, {}
    path = os.path.join(HERE, 'cultural_plants.csv')
    if not os.path.exists(path):
        print('cultural_plants.csv not found: plants of cultural significance are left out', flush=True)
        return out, genus
    for r in csv.DictReader(open(path, encoding='utf-8-sig')):
        sci = r['SCI_NAME'].strip(); sens = (r.get('SENSITIVE') or '').strip().upper() == 'Y'
        if sci.endswith(' spp.'):
            genus.setdefault(sci.split()[0].lower(), (sci, sens)); continue
        for n in [sci] + [x for x in (r.get('ALT_NAMES') or '').split(';')]:
            if n.strip():
                out.setdefault(norm(n), (sci, sens)); out.setdefault(norm(binomial(n)), (sci, sens))
    return out, genus


def cult_of(r, sp, cult):
    """the cultural-plant lookup entry for an iNaturalist plant record, or None"""
    look, genus = cult
    if not sp or r.get('kingdom') != 'Plantae':
        return None
    for n in (r.get('verbatimScientificName'), sp):
        if n and (look.get(norm(n)) or look.get(norm(binomial(n)))):
            return look.get(norm(n)) or look.get(norm(binomial(n)))
    return genus.get(sp.split()[0].lower())


def ckey(s, canon):
    return canon.get(norm(s)) or canon.get(norm(binomial(s))) or norm(binomial(s))


def nm_common(sp, names, inv, common=None, tags=None):
    """'Common name (Scientific name)', the same string for a species whichever source it comes from"""
    k = norm(sp); c = names.get(k) or (common.get(k) if common else None) or (inv.get(k, (0, 0, ''))[2] if inv else '') or PESTS.get(sp, '')
    c = c[:1].upper() + c[1:] if c else ''
    return (f'{c} ({sp})' if c else sp) + (f' [{", ".join(tags)}]' if tags else '')


# iNaturalist's invasive and pest records, kept for matching EDDMapS records: (species key, day) -> [(lat, lon)]; species key -> name used
INAT_PTS, INAT_SP = defaultdict(list), {}


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
def new_cell(kind):
    return {'n': 0, 'users': set(), 'units': set(), 'spp': defaultdict(int), 'inc': defaultdict(set) if kind == 'inat' else defaultdict(int),
            'last': '', 'recent': 0, 'grp': defaultdict(set), 'gobs': defaultdict(int), 'inv': defaultdict(int), 'pest': defaultdict(int),
            'nonnat': set(), 'nnplant': set(), 'breed': set(), 'yr': defaultdict(int), 'pyr': defaultdict(int), 'cult': defaultdict(int)}


YEARS_FROM = '2010'   # first year counted in OBS_BY_YEAR and PLANT_OBS_BY_YEAR (the dashboard's year buttons start in 2010)


def summarize(kind, zpath, grids, names):
    """grids: {'corr': corridor levels, 'huc': HUC10 shell levels}. A record counts in a grid when it falls in one of that grid's
    1 sq mi cells; its 7 and 49 sq mi cells then add up those square miles (as the ArcGIS summaries did)."""
    inv = load_invasive() if kind == 'inat' else None
    canon = load_canon()[0] if kind == 'inat' else None
    cult = load_cultural() if kind == 'inat' else None
    sens = set()     # dug or poached plants: listed only in 49 sq mi cells
    look, guild, common = load_birds() if kind == 'ebird' else (None, None, None)
    cells = {g: {lv: defaultdict(lambda: new_cell(kind)) for lv in L} for g, L in grids.items()}
    cutoff = str(date.today().year - RECENT_YEARS)
    n_in = {g: 0 for g in grids}; n_all = 0; t0 = time.time(); keys = {}; uid = {}; wid = {}
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
        hits = {}
        for g, L in grids.items():
            hx = cell_of(L['hex'], la, lo)
            if hx >= 0:
                hits[g] = {'hex': hx, 'cog': cell_of(L['cog'], la, lo), 'wheel': cell_of(L['wheel'], la, lo)}
                n_in[g] += 1
        if not hits:
            continue
        d = (r.get('eventDate') or '')[:10]; who = (r.get('recordedBy') or '').strip().lower()
        if kind == 'ebird':
            sp = binomial(r.get('verbatimScientificName') or r.get('species'))
            if not sp or '/' in sp or ' sp.' in sp or ' x ' in sp.lower() or len(sp.split()) < 2:
                sp = None
            ukey = f'{who}|{d}|{la:.3f}|{lo:.3f}'     # checklist: observer, date and place
        else:
            sp = (r.get('species') or '').strip() or None
            ukey = f'{who}|{d}'                        # visit: observer and date
        unit = uid.setdefault(ukey, len(uid)) if d else None
        w = wid.setdefault(who, len(wid)) if who else None
        if sp and sp not in keys and r.get('speciesKey'):
            keys[sp] = r['speciesKey']
        if kind == 'inat':
            grp = [g for g, test in GROUPS if test(r)]
            pest = sp and (sp in PESTS or binomial(r.get('verbatimScientificName')) in PESTS)
            iv = sp and r['kingdom'] == 'Plantae' and (inv.get(norm(r.get('verbatimScientificName'))) or inv.get(norm(sp)))
            cu = cult_of(r, sp, cult)
            if cu and cu[1]: sens.add(sp)
            if (pest or iv) and sp:
                ck = ckey(sp, canon); INAT_SP.setdefault(ck, sp)
                if len(d) == 10 and d[4] == '-':
                    INAT_PTS[(ck, date.fromisoformat(d).toordinal())].append((la, lo))
        for g, hit in hits.items():
            for lv, c in hit.items():
                if c < 0:
                    continue
                s = cells[g][lv][c]; s['n'] += 1
                if w is not None: s['users'].add(w)
                if unit is not None: s['units'].add(unit); s['last'] = max(s['last'], d)
                if d[:4] >= cutoff: s['recent'] += 1
                if kind == 'inat':
                    for gg in grp: s['gobs'][gg] += 1
                    if d[:4].isdigit() and d[:4] >= YEARS_FROM:   # records per year: the effort behind the dashboard's share-of-records measure
                        s['yr'][d[:4]] += 1
                        if 'PLANT_SPP' in grp: s['pyr'][d[:4]] += 1
                if not sp:
                    continue
                s['spp'][sp] += 1
                if kind == 'inat':
                    if unit is not None: s['inc'][sp].add(unit)
                    for gg in grp: s['grp'][gg].add(sp)
                    if pest: s['pest'][sp] += 1
                    if cu: s['cult'][sp] += 1
                    if iv:
                        s['nonnat'].add(sp)
                        if 'PLANT_SPP' in grp: s['nnplant'].add(sp)
                        if iv[0] == 'Priority': s['inv'][sp] += 1
                else:
                    if unit is not None: s['inc'][sp] += 1    # one record per species per checklist
                    if d[5:7] in ('06', '07'): s['breed'].add(sp)
        if n_all % 500000 == 0:
            print(f'   {kind}: {n_all:,} rows read, {n_in["corr"]:,} in corridor cells, {n_in.get("huc", 0):,} in HUC10 cells ({time.time() - t0:.0f} s)', flush=True)
    print(f'{kind}: {n_all:,} rows, {n_in["corr"]:,} in corridor cells, {n_in.get("huc", 0):,} in HUC10 cells', flush=True)
    # every species gets a common name: dashboard and lookup names first, then GBIF's English vernacular names (cached)
    have = lambda x: names.get(norm(x)) or (common or {}).get(norm(x)) or (inv.get(norm(x), (0, 0, ''))[2] if inv else '') or PESTS.get(x)
    missing = sorted({sp for g in cells for lv in cells[g] for c in cells[g][lv].values() for sp in c['spp'] if not have(sp)})
    names.update(vernacular(missing, keys))

    nm = lambda sp, tags=None: nm_common(sp, names, inv, common, tags)
    out = {}
    for g, L in grids.items():
        out[g] = {}
        for lv in L:
            ids, F = [], defaultdict(list)
            for c in sorted(cells[g][lv]):
                s = cells[g][lv][c]; T = len(s['units'])
                inc = {k: (len(v) if kind == 'inat' else v) for k, v in s['inc'].items()}
                cr, sc = cov_richness(inc, T)
                v = {'N_OBSERVERS': len(s['users']), 'N_SPP': len(s['spp']), 'COV_RICHNESS': None if cr is None else int(round(cr)),
                     'SAMPLE_COVERAGE': None if sc is None else int(round(sc)), 'LAST_OBS': s['last'] or None}
                top = sorted(s['spp'].items(), key=lambda kv: (-kv[1], kv[0]))[:10]
                if kind == 'inat':
                    n = s['n']; ed = sorted(sp for sp in s['inv'] if inv.get(norm(sp), (0, False))[1])
                    v.update(DATA_STATUS='Adequate' if n >= LOW_SAMPLE['inat'] else 'Low sample', N_OBS=n, N_OBS_RECENT=s['recent'], N_VISITS=T,
                             N_NONNATIVE_SPP=len(s['nonnat']), N_NONNATIVE_PLANT_SPP=len(s['nnplant']), N_INV_SPP=len(s['inv']), N_INV_OBS=sum(s['inv'].values()),
                             PCT_INV_OBS=round(100 * sum(s['inv'].values()) / n, 1) if n else 0, N_EDRR_SPP=len(ed), N_PEST_OBS=sum(s['pest'].values()),
                             INVASIVE_LIST=sorted((nm(x) for x in s['inv']), key=str.lower), EDRR_LIST=sorted((nm(x) for x in ed), key=str.lower),
                             PEST_LIST=sorted((nm(x) for x in s['pest']), key=str.lower), TOP10_SPECIES=[nm(x) for x, _ in top], TOP10_COUNTS=[k for _, k in top])
                    cu = {x: k for x, k in s['cult'].items() if lv == 'wheel' or x not in sens}   # sensitive plants only in 49 sq mi cells
                    v.update(N_CULT_SPP=len(cu), N_CULT_OBS=sum(cu.values()), CULT_LIST=sorted((nm(x) for x in cu), key=str.lower))
                    for gg, _ in GROUPS:
                        v[gg] = len(s['grp'][gg]); v[gg.replace('_SPP', '_OBS')] = s['gobs'][gg]
                    if not (g == 'huc' and lv == 'hex'):   # [year, records, year, records, ...]; left off the HUC10 square miles to keep that file small
                        v['OBS_BY_YEAR'] = [x for y in sorted(s['yr']) for x in (int(y), s['yr'][y])]
                        v['PLANT_OBS_BY_YEAR'] = [x for y in sorted(s['pyr']) for x in (int(y), s['pyr'][y])]
                else:
                    spp = list(s['spp']); info = {x: (look.get(norm(x)), guild.get(norm(x))) for x in spp}
                    soc = [(x, soc_tags(info[x][0])) for x in spp]; soc = [(x, t) for x, t in soc if t]
                    v.update(DATA_STATUS='Adequate' if T >= LOW_SAMPLE['ebird'] else 'Low sample', N_CHECKLISTS=T, N_RECORDS=s['n'],
                             BREED_SEASON_SPP=len(s['breed']), N_SOC_SPP=len(soc), N_BCC_SPP=sum(1 for _, t in soc if any(x.startswith('BCC') for x in t)),
                             N_PIF_SPP=sum(1 for _, t in soc if 'PIF' in t), SOC_LIST=sorted((nm(x, t) for x, t in soc), key=str.lower),
                             N_NEOTROP_SPP=sum(1 for x in spp if (info[x][1] or info[x][0] or {}).get('MIGRATION') == 'Neotropical migrant'))
                    for gname, gg in GUILDS.items():
                        Ls = [x for x in spp if ((info[x][1] or info[x][0] or {}).get('HABITAT_GUILD') or '') == gname]
                        v[gg + '_SPP'] = len(Ls); v[gg + '_LIST'] = sorted((nm(x) for x in Ls), key=str.lower)
                ids.append(L[lv]['id'][c])
                for k, x in v.items():
                    F[k].append(x)
            out[g][lv] = {'ids': ids, 'f': dict(F)}
            print(f'   {kind} {g} {lv}: {len(ids)} cells with records', flush=True)
        cells[g] = None    # free memory before the next grid
    return out


# ---------------------------------------------------------------- EDDMapS
def arc(params, tries=6):
    url = EDD_URL + '?' + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'AT-Resource-Grid'}), timeout=180) as r:
                j = json.loads(r.read().decode())
            if 'error' in j:
                raise RuntimeError(j['error'])
            return j
        except Exception as e:
            if i == tries - 1:
                raise
            print(f'   EDDMapS: retry {i + 1} after {e}', flush=True); time.sleep(10 * (i + 1))


def edd_fetch(levels):
    """every visible EDDMapS point in the rectangles around the cells, paged; a point in two rectangles is kept once"""
    rects = area_rects(levels); got = {}; t0 = time.time()
    def one(rc):
        s_, n_, w_, e_ = rc; out, off = [], 0
        while True:
            j = arc({'where': 'hidden IS NULL OR hidden = 0', 'geometry': f'{w_:.4f},{s_:.4f},{e_:.4f},{n_:.4f}', 'geometryType': 'esriGeometryEnvelope',
                     'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects', 'outFields': EDD_FIELDS, 'returnGeometry': 'true', 'outSR': 4326,
                     'orderByFields': 'OBJECTID_1', 'resultOffset': off, 'resultRecordCount': EDD_PAGE, 'f': 'json'})
            fs = j.get('features') or []; out += fs; off += len(fs)
            if not fs or not (j.get('exceededTransferLimit') or len(fs) >= EDD_PAGE):
                return out
    with ThreadPoolExecutor(4) as pool:
        for k, fs in enumerate(pool.map(one, rects)):
            for f in fs:
                a = f.get('attributes') or {}; got[a.get('OBJECTID_1') or a.get('ObjectID')] = f
            if (k + 1) % 20 == 0:
                print(f'   EDDMapS: {k + 1} of {len(rects)} areas, {len(got):,} points ({time.time() - t0:.0f} s)', flush=True)
    print(f'EDDMapS: {len(got):,} points in {len(rects)} areas around the cells', flush=True)
    return list(got.values())


def edd_acres(a):
    """infested area in acres: EDDMapS's own conversion (InfestedAreaAcres), else Infested_Area in its Area_Units"""
    for v in (a.get('InfestedAreaAcres'),):
        try:
            v = float(v)
            if v > 0: return v
        except (TypeError, ValueError):
            pass
    try:
        v, u = float(a.get('Infested_Area')), AREA_UNITS.get((a.get('Area_Units') or '').strip().lower())
        return v * u if v > 0 and u else None
    except (TypeError, ValueError):
        return None


def edd_summarize(feats, grids, names):
    """EDDMapS points of listed invasive plants and forest pests, by cell, with duplicates dropped (see the top of this file)"""
    inv = load_invasive(); canon, sci = load_canon(); pestn = {norm(p): p for p in PESTS}
    cells = {g: {lv: defaultdict(lambda: {'n': 0, 'dup': 0, 'treat': 0, 'last': '', 'inv': set(), 'pest': set(), 'det': {}}) for lv in L} for g, L in grids.items()}
    seen = set(); st = Counter(); other = Counter(); edd_names = {}
    for f in feats:
        a = f.get('attributes') or {}; g_ = f.get('geometry') or {}
        try:
            la, lo = float(g_['y']), float(g_['x'])
        except (KeyError, TypeError, ValueError):
            st['no location'] += 1; continue
        name = (a.get('Scientific_Name') or '').strip()
        if not name:
            st['no species'] += 1; continue
        ck = ckey(name, canon); b = norm(binomial(name))
        iv = inv.get(norm(name)) or inv.get(b) or inv.get(ck)
        pest = pestn.get(b) or pestn.get(ck)
        if not pest and not (iv and iv[0] == 'Priority'):
            other[name] += 1; continue
        hits = {}
        for g, L in grids.items():
            hx = cell_of(L['hex'], la, lo)
            if hx >= 0:
                hits[g] = {'hex': hx, 'cog': cell_of(L['cog'], la, lo), 'wheel': cell_of(L['wheel'], la, lo)}
        if not hits:
            st['outside the cells'] += 1; continue
        ms = a.get('ObservationDate'); d = datetime.fromtimestamp(ms / 1000, timezone.utc).strftime('%Y-%m-%d') if isinstance(ms, (int, float)) else ''
        k = (ck, d, round(la, 4), round(lo, 4))                     # about 10 m: the rows of one report (treatment, monitoring)
        if k in seen:
            st['repeat rows'] += 1; continue
        seen.add(k)
        dup = False
        if d:
            o = date.fromisoformat(d).toordinal(); cl = math.cos(math.radians(la))
            for oo in range(o - DUP_DAYS, o + DUP_DAYS + 1):
                for pla, plo in INAT_PTS.get((ck, oo), ()):
                    if math.hypot((pla - la) * 111320, (plo - lo) * 111320 * cl) <= DUP_M:
                        dup = True; break
                if dup:
                    break
        sp = pest or INAT_SP.get(ck) or sci.get(ck) or binomial(name)
        if a.get('SUB_name') and not names.get(norm(sp)):
            edd_names.setdefault(norm(sp), a['SUB_name'].strip())
        st['also on iNaturalist' if dup else 'counted'] += 1
        treated = str(a.get('Treatment') or '').strip() not in ('', '0', 'None', 'null')
        acres = edd_acres(a); ab = (a.get('Abundance_Name') or '').strip(); spot = (round(la, 4), round(lo, 4))
        if ab.lower() in ('unknown', 'none', 'null', 'n/a', 'na'):
            ab = ''
        for g, hit in hits.items():
            for lv, c in hit.items():
                if c < 0:
                    continue
                s = cells[g][lv][c]
                # per species: every EDDMapS report (those matching iNaturalist too: the table describes EDDMapS), infested acres
                # (each spot once, its latest report with an area) and the latest abundance
                e = s['det'].setdefault(sp, {'n': 0, 'spots': {}, 'ab': None})
                e['n'] += 1
                if acres and (spot not in e['spots'] or d >= e['spots'][spot][0]):
                    e['spots'][spot] = (d, acres)
                if ab and (not e['ab'] or d >= e['ab'][0]):
                    e['ab'] = (d, ab)
                if dup:
                    s['dup'] += 1; continue
                s['n'] += 1; s['last'] = max(s['last'], d); s['treat'] += treated
                (s['pest'] if pest else s['inv']).add(sp)
    print('EDDMapS: ' + ', '.join(f'{v:,} {k}' for k, v in st.most_common()), flush=True)
    print(f'EDDMapS: {sum(other.values()):,} points of {len(other)} species not on the invasive or pest lists, not counted; most reported: ' +
          ', '.join(f'{k} ({v:,})' for k, v in other.most_common(12)), flush=True)
    def nm(sp):        # the same name iNaturalist's lists give a species; EDDMapS's own common name only when there is no other
        x = nm_common(sp, names, inv); c = edd_names.get(norm(sp))
        return f'{c[:1].upper() + c[1:]} ({sp})' if x == sp and c else x
    out = {}
    for g, L in grids.items():
        out[g] = {}
        for lv in L:
            ids, F = [], defaultdict(list)
            for c in sorted(cells[g][lv]):
                s = cells[g][lv][c]
                v = {'N_EDD_OBS': s['n'], 'N_EDD_DUP': s['dup'], 'N_EDD_TREATED': s['treat'], 'EDD_LAST': s['last'] or None,
                     'EDD_INV_LIST': sorted((nm(x) for x in s['inv']), key=str.lower),
                     'EDD_EDRR_LIST': sorted((nm(x) for x in s['inv'] if inv.get(norm(x), (0, False))[1] or inv.get(ckey(x, canon), (0, False))[1]), key=str.lower),
                     'EDD_PEST_LIST': sorted((nm(x) for x in s['pest']), key=str.lower),
                     # [species, EDDMapS reports, infested acres or None, latest abundance or None, its year or None]
                     'EDD_SPP_DETAIL': sorted(([nm(x), e['n'], round(sum(v[1] for v in e['spots'].values()), 3) if e['spots'] else None,
                                                e['ab'][1] if e['ab'] else None, int(e['ab'][0][:4]) if e['ab'] and e['ab'][0] else None]
                                               for x, e in s['det'].items()), key=lambda r: r[0].lower())}
                ids.append(L[lv]['id'][c])
                for k, x in v.items():
                    F[k].append(x)
            out[g][lv] = {'ids': ids, 'f': dict(F)}
            print(f'   EDDMapS {g} {lv}: {len(ids)} cells with records', flush=True)
    return out, {'points': len(feats), 'counted': st['counted'], 'also_inat': st['also on iNaturalist'], 'repeat_rows': st['repeat rows']}


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
                elif k == 'EDD_SPP_DETAIL':
                    t['f'][k] = [[[ix(r[0])] + r[1:] for r in L] if L else [] for L in col]
    return spp, {'DATA_STATUS': cats}


def unpack(prev, keep):
    """the datasets not being rebuilt, from the previous file, with species back to strings"""
    out = {}
    for th, t in (prev.get('themes') or {}).items():
        if th not in keep:
            continue
        for lv in t.values():
            for k, col in lv['f'].items():
                if k == 'DATA_STATUS':
                    lv['f'][k] = [prev['cats']['DATA_STATUS'][x] for x in col]
                elif k.endswith('_LIST') or k == 'TOP10_SPECIES':
                    lv['f'][k] = [[prev['spp'][i] for i in L] if L else [] for L in col]
                elif k == 'EDD_SPP_DETAIL':
                    lv['f'][k] = [[[prev['spp'][r[0]]] + r[1:] for r in L] if L else [] for L in col]
        out[th] = t
    return out


def compare(D, themes):
    """how the new summaries line up with the ones built into index.html"""
    for th, t in themes.items():
        for lv in ('hex', 'wheel'):
            old = D['themes'].get(th, {}).get(lv)
            if not old or lv not in t:
                continue
            oid = {D['levels'][lv]['id'][c]: k for k, c in enumerate(old['ix'])}
            f = 'N_OBS' if th == 'inat' else 'N_CHECKLISTS'
            pairs = [(old['f'][f][oid[i]], t[lv]['f'][f][k]) for k, i in enumerate(t[lv]['ids']) if i in oid]
            if pairs:
                a = sum(p[0] for p in pairs); b = sum(p[1] for p in pairs)
                print(f'compare {th} {lv}: {len(t[lv]["ids"])} cells now, {len(old["ix"])} before, {len(pairs)} in both; {f} total {b:,} now vs {a:,} before', flush=True)


def load_huc():
    """the HUC10 shell's cells, from soils_wetlands_huc10.json (same layout as the payload in index.html)"""
    try:
        Hj = json.load(open(HUCFILE))['levels']
    except Exception as e:
        print('HUC10 cells not read:', e, flush=True); return None
    levels = {}
    for lv in ('hex', 'cog', 'wheel'):
        L = Hj[lv]; rings = []
        for g in L['g']:
            la, lo = g[0], g[1]; r = [(la / 1e5, lo / 1e5)]
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; r.append((la / 1e5, lo / 1e5))
            rings.append(r)
        levels[lv] = {'id': L['id'], 'mi': L['mi'], 'rings': rings, 'bins': bins(rings)}
    print(f'HUC10 shell: {len(levels["hex"]["id"]):,} / {len(levels["cog"]["id"]):,} / {len(levels["wheel"]["id"]):,} cells', flush=True)
    return levels


def main():
    which = (sys.argv[1] if len(sys.argv) > 1 else 'inat').lower()
    kinds = ['inat', 'ebird'] if which == 'both' else [which]
    D, levels = load_grid(); huc = load_huc()
    grids = {'corr': levels}
    if huc:
        grids['huc'] = huc
    names = {}
    for s in D['spp']:
        m = re.match(r'^(.*?)\s*\(([^)]*)\)', s)
        if m: names.setdefault(norm(m.group(2)), m.group(1))
    prev = {}
    for g, path in (('corr', OUT), ('huc', OUT_HUC)):
        try:
            prev[g] = json.load(open(path))
        except Exception:
            prev[g] = {}
    keep = [k for k in ('inat', 'ebird') if k not in kinds] + ([] if 'inat' in kinds else ['edd'])
    themes = {g: unpack(prev[g], keep) for g in grids}
    meta = prev['corr'].get('meta', {})
    for k in kinds:
        path, info = download(k, huc or levels)        # one download covers both grids
        res = summarize(k, path, grids, names)
        for g in grids:
            themes[g][k] = res[g]
        meta[k] = dict(info, built=datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        os.remove(path)
        if k == 'inat':        # EDDMapS rides with iNaturalist: its duplicates are found against the iNaturalist records just read
            try:
                res, info = edd_summarize(edd_fetch(huc or levels), grids, names)
                for g in grids:
                    themes[g]['edd'] = res[g]
                meta['edd'] = dict(info, source=EDD_URL.rsplit('/query', 1)[0], built=datetime.now(timezone.utc).strftime('%Y-%m-%d'))
            except Exception as e:
                print(f'EDDMapS not rebuilt ({e}); keeping its previous summaries', flush=True)
                for g in grids:
                    old = unpack(prev[g], ['edd'])
                    if old:
                        themes[g].update(old)
    compare(D, themes['corr'])
    q = (date.today().month - 1) // 3 + 1
    for g, path in (('corr', OUT), ('huc', OUT_HUC)):
        if g not in grids:
            continue
        spp, cats = pack(themes[g])
        json.dump({'run': f'{date.today().year} Q{q}', 'extent': g, 'meta': meta, 'spp': spp, 'cats': cats, 'themes': themes[g]},
                  open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
        print('wrote', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()
