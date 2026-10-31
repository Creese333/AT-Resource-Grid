"""
Builds historic_resources.json for the A.T. Resource Grid.

Fetches, out to the HUC10 shell (the 49 sq mi watershed grid cells in soils_wetlands_huc10.json; the corridor cells in
at_wheel_cells.json when that file is missing):
  - National Register of Historic Places points (National Park Service)
  - Cemeteries from OpenStreetMap, with Find a Grave cemetery IDs where OpenStreetMap or Wikidata has one. They are read
    from the Geofabrik state extracts (one download per state the trail's watersheds touch), filtered with osmium-tool,
    so the whole HUC10 shell is covered in every run. (The public Overpass servers turned the GitHub runners away so
    often that a run reached only a few dozen of the 300 stretches, from Georgia north.) If a state's extract cannot be
    read, the cemeteries the previous file had are kept, and the file's err note names the state.
  - Historic American Buildings Survey, Historic American Engineering Record and Historic American Landscapes Survey
    documentation (HABS/HAER/HALS, Library of Congress), the records the Library has coordinates for, read from the loc.gov
    JSON API state by state. If the API cannot be read, the previous file's records are kept.
  - Mining features from historical USGS topographic maps (USMIN: mines, shafts, adits, prospects, quarries, pits, dumps;
    San and Horton 2025, consolidated from Horton and San Juan 2016), read from the USGS ScienceBase data release. Polygons
    are kept as a point inside them. If the release cannot be read, the previous file's features are kept.
  - the A.T. administrative area (AT_Lands tract) each record falls in, for the dashboard's scale filter
and writes data/historic_resources.json. The dashboard reads that file.

Needs osmium-tool (apt) and shapely (pip) for the cemeteries; geopandas and pyogrio (pip) for the mining features. Runs in GitHub Actions (see .github/workflows/historic_resources.yml) or anywhere with Python 3.
"""
import json, math, os, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

SCRIPTS = os.path.dirname(os.path.abspath(__file__))          # scripts/
HERE = os.path.dirname(SCRIPTS)                                  # the repository: index.html
DATA = os.path.join(HERE, 'data')                                # what the dashboard loads
INPUTS = os.path.join(HERE, 'inputs')                            # tables kept by hand
CACHE = os.path.join(HERE, 'cache')                              # kept between runs; the dashboard never loads these
for _d in (DATA, INPUTS, CACHE): os.makedirs(_d, exist_ok=True)
CELLS = os.path.join(INPUTS, 'at_wheel_cells.json')
HUC = os.path.join(DATA, 'soils_wetlands_huc10.json')
OUT = os.path.join(DATA, 'historic_resources.json')
UA = {'User-Agent': 'AT-Resource-Grid historic resources build (NPS Appalachian National Scenic Trail)'}

SRC = {
    'nr': {'urls': ['https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0',
                    'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhpTest/MapServer/0'],
           'fields': 'OBJECTID,RESNAME,ResType,NRIS_Refnum,CertDate,Is_NHL,NARA_URL,Address,City,County,State,MultiName,IS_EXTANT'},
}
LANDS = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/AT_Lands/FeatureServer/1'
# OpenStreetMap state extracts from Geofabrik: every state (and D.C.) with grid cells in the trail's HUC10 watersheds
GEOFABRIK = 'https://download.geofabrik.de/north-america/us/{}-latest.osm.pbf'
OSM_STATES = ['georgia', 'north-carolina', 'tennessee', 'virginia', 'west-virginia', 'maryland', 'district-of-columbia', 'pennsylvania',
              'new-jersey', 'new-york', 'connecticut', 'massachusetts', 'vermont', 'new-hampshire', 'maine']


def get_json(url, data=None, tries=3, timeout=90):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            print(f'   retry {k + 1}: {e}', flush=True)
            time.sleep(3 * (k + 1))
    raise RuntimeError('no answer from ' + url.split('?')[0])


def in_ring(la, lo, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        yi, xi = ring[i]; yj, xj = ring[j]
        if (yi > la) != (yj > la) and lo < (xj - xi) * (la - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_poly(la, lo, rings):
    # ArcGIS polygon rings are [x, y]; even-odd over all rings handles holes
    inside = False
    for ring in rings:
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
            if (yi > la) != (yj > la) and lo < (xj - xi) * (la - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


def lands_query(ch):
    out, off = [], 0
    while True:
        q = urllib.parse.urlencode({'where': '1=1', 'geometry': json.dumps({'xmin': ch['w'], 'ymin': ch['s'], 'xmax': ch['e'], 'ymax': ch['n'], 'spatialReference': {'wkid': 4326}}),
                                    'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'ADMIN,TRACT1,LEGEND3',
                                    'returnGeometry': 'true', 'outSR': 4326, 'geometryPrecision': 6, 'resultOffset': off, 'resultRecordCount': 1000, 'f': 'json'})
        j = get_json(LANDS + '/query?' + q)
        if 'error' in j:
            raise RuntimeError(j['error'].get('message', 'service error'))
        feats = j.get('features') or []
        for f in feats:
            rings = (f.get('geometry') or {}).get('rings') or []
            if not rings:
                continue
            xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
            out.append({'box': (min(ys), max(ys), min(xs), max(xs)), 'rings': rings, 'a': f.get('attributes') or {}})
        if not j.get('exceededTransferLimit') or not feats:
            return out
        off += len(feats)


def tag_lands(items, chunks):
    # each record gets ld (the tract's LEGEND3 class, '' outside every tract), adm and tract; APPA tracts win where tracts overlap
    def job(ch):
        try:
            return ch, lands_query(ch), None
        except Exception as e:
            return ch, None, str(e)
    todo, res = list(chunks), {}
    for attempt in range(2):
        with ThreadPoolExecutor(4) as pool:
            got = list(pool.map(job, todo))
        todo = []
        for ch, polys, e in got:
            if e:
                todo.append(ch); print(f'   AT_Lands: {e}', flush=True)
            else:
                res[id(ch)] = (ch, polys)
        print(f'A.T. administrative areas: {len(res)} of {len(chunks)} stretches', flush=True)
        if not todo:
            break
        time.sleep(20)
    if todo:
        return f'{len(todo)} of {len(chunks)} stretches not reached'
    for x in items:
        hits = []
        for ch, polys in res.values():
            if not (ch['s'] <= x['la'] <= ch['n'] and ch['w'] <= x['lo'] <= ch['e']):
                continue
            for p in polys:
                b = p['box']
                if b[0] <= x['la'] <= b[1] and b[2] <= x['lo'] <= b[3] and in_poly(x['la'], x['lo'], p['rings']):
                    hits.append(p['a'])
        hits.sort(key=lambda a: 0 if str(a.get('LEGEND3') or '').startswith('FEDERAL LAND - NPS - APPA') else 1)
        a = hits[0] if hits else {}
        x['ld'] = str(a.get('LEGEND3') or ('OTHER' if hits else '')).strip()
        if hits:
            x['adm'] = str(a.get('ADMIN') or '').strip(); x['tract'] = str(a.get('TRACT1') or '').strip()
    return None


def arc_query(src, ch):
    out, off = [], 0
    for url in src['urls']:
        try:
            while True:
                q = urllib.parse.urlencode({'where': '1=1', 'geometry': json.dumps({'xmin': ch['w'], 'ymin': ch['s'], 'xmax': ch['e'], 'ymax': ch['n'], 'spatialReference': {'wkid': 4326}}),
                                            'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects', 'outFields': src['fields'],
                                            'returnGeometry': 'true', 'outSR': 4326, 'resultOffset': off, 'resultRecordCount': 1000, 'f': 'json'})
                j = get_json(url + '/query?' + q)
                if 'error' in j:
                    raise RuntimeError(j['error'].get('message', 'service error'))
                feats = j.get('features') or []
                for f in feats:
                    g = f.get('geometry') or {}
                    if g.get('x') is not None:
                        out.append({'a': f.get('attributes') or {}, 'la': g['y'], 'lo': g['x']})
                if not j.get('exceededTransferLimit') or not feats:
                    return out
                off += len(feats)
        except Exception as e:
            print(f'   {url.split("/services/")[1]}: {e}', flush=True)
            out, off = [], 0
    raise RuntimeError('all URLs failed')


def osm_cem(osm):
    out = []
    for o in osm:
        t = o['tags']
        out.append({'t': 'cem', 'nm': t.get('name', ''), 'la': o['la'], 'lo': o['lo'],
                    'a': {'source': 'OpenStreetMap', 'osm': o['id'], 'denomination': t.get('denomination', ''), 'operator': t.get('operator', ''),
                          'fag': re.sub(r'\D', '', t.get('ref:find_a_grave', '') or t.get('ref:findagrave', '')), 'wikidata': t.get('wikidata', '')}})
    return out


def wikidata_fag(items):
    # Find a Grave cemetery ID (Wikidata property P2025) for cemeteries whose OpenStreetMap record links a Wikidata item
    need = [x for x in items if x['t'] == 'cem' and not x['a'].get('fag') and re.fullmatch(r'Q\d+', x['a'].get('wikidata') or '')]
    ids = sorted({x['a']['wikidata'] for x in need}); got = {}
    for i in range(0, len(ids), 50):
        try:
            j = get_json('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(ids[i:i + 50]), 'props': 'claims', 'format': 'json'}))
            for q, ent in (j.get('entities') or {}).items():
                for c in (ent.get('claims') or {}).get('P2025', []):
                    v = ((c.get('mainsnak') or {}).get('datavalue') or {}).get('value')
                    if v:
                        got[q] = str(v); break
        except Exception as e:
            print(f'   Wikidata: {e}', flush=True)
    for x in need:
        if x['a']['wikidata'] in got:
            x['a']['fag'] = got[x['a']['wikidata']]
    n = sum(1 for x in items if x['t'] == 'cem' and x['a'].get('fag'))
    print(f'Find a Grave IDs: {n} cemeteries ({len(got)} from Wikidata)', flush=True)


def load_cells():
    # the HUC10 shell's 49 sq mi cells (delta-encoded rings, as the dashboard stores them); otherwise the corridor cells
    try:
        w = json.load(open(HUC))['levels']['wheel']
        cells = []
        for g, mi, cid in zip(w['g'], w['mi'], w['id']):
            la, lo = g[0], g[1]; ring = [[la / 1e5, lo / 1e5]]
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; ring.append([la / 1e5, lo / 1e5])
            cells.append({'mi': mi, 'ring': ring, 'id': cid})
        print(f'{len(cells)} HUC10 shell cells', flush=True)
        return sorted(cells, key=lambda c: (c['mi'], c['id'])), 'huc'
    except Exception as e:
        print(f'HUC10 cells not read ({e}); using the corridor cells', flush=True)
        return json.load(open(CELLS)), 'corridor'


def fetch_file(url, path, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
                shutil.copyfileobj(r, f, 1 << 20)
            return
        except Exception as e:
            print(f'   {url.rsplit("/", 1)[1]}: {e}', flush=True)
            time.sleep(20 * (k + 1))
    raise RuntimeError('download failed')


def cemeteries_from_pbf(pbf, work):
    """[{id, la, lo, tags}] for every landuse=cemetery and amenity=grave_yard node, way and relation in an .osm.pbf file
    (areas at a point inside them, as Overpass's "center" would be)."""
    from shapely.geometry import shape
    flt, gj = os.path.join(work, 'cem.osm.pbf'), os.path.join(work, 'cem.geojsonseq')
    subprocess.run(['osmium', 'tags-filter', pbf, 'nwr/landuse=cemetery', 'nwr/amenity=grave_yard', '-o', flt, '--overwrite', '--no-progress'], check=True)
    subprocess.run(['osmium', 'export', flt, '-f', 'geojsonseq', '-a', 'type,id', '-o', gj, '--overwrite', '--no-progress'], check=True)
    out = {}
    with open(gj, encoding='utf-8') as f:
        for line in f:
            line = line.strip().lstrip('\x1e')
            if not line:
                continue
            ft = json.loads(line); p = ft.get('properties') or {}
            tags = {k: v for k, v in p.items() if not k.startswith('@')}
            if tags.get('landuse') != 'cemetery' and tags.get('amenity') != 'grave_yard':
                continue                                   # member ways and nodes pulled in only to build an area
            try:
                g = shape(ft['geometry']); pt = g if g.geom_type == 'Point' else g.representative_point()
            except Exception:
                continue
            oid = f"{p.get('@type', 'way')}/{p.get('@id')}"
            if oid not in out or g.geom_type in ('Polygon', 'MultiPolygon'):   # an area beats a stray line for the same object
                out[oid] = {'id': oid, 'la': pt.y, 'lo': pt.x, 'tags': tags}
    return list(out.values())


def osm_extracts(cells, fetch=fetch_file):
    """cemeteries from the Geofabrik state extracts, kept when they fall in a grid cell. Returns {osm id: point}, error note."""
    from shapely.geometry import Point, Polygon
    from shapely.strtree import STRtree
    polys = [Polygon([(lo, la) for la, lo in c['ring']]) for c in cells]; tree = STRtree(polys)
    osm, failed, t0 = {}, [], time.time()
    work = tempfile.mkdtemp(prefix='osm_')
    try:
        for st in OSM_STATES:
            pbf = os.path.join(work, st + '.osm.pbf')
            try:
                fetch(GEOFABRIK.format(st), pbf)
                pts = cemeteries_from_pbf(pbf, work); n = 0
                for p in pts:
                    if len(tree.query(Point(p['lo'], p['la']), predicate='intersects')):
                        osm[p['id']] = p; n += 1
                print(f'OpenStreetMap {st}: {len(pts)} cemeteries in the state extract, {n} in the grid ({time.time() - t0:.0f} s)', flush=True)
            except Exception as e:
                failed.append(st); print(f'OpenStreetMap {st}: not read ({e})', flush=True)
            finally:
                for x in os.listdir(work):
                    os.remove(os.path.join(work, x))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    if len(failed) == len(OSM_STATES):
        raise RuntimeError('no state extract could be read')
    note = ''
    if failed:   # keep the previous file's cemeteries (there is no state outline to tell which ones lie in the states missed)
        try:
            prev = json.load(open(OUT))
        except Exception:
            prev = {}
        kept = 0
        for x in prev.get('items', []):
            o = x.get('a', {}).get('osm')
            if x.get('t') == 'cem' and o and o not in osm:
                osm[o] = {'id': o, 'la': x['la'], 'lo': x['lo'], 'tags': {'name': x.get('nm', ''), 'denomination': x['a'].get('denomination', ''), 'operator': x['a'].get('operator', ''),
                                                                'ref:find_a_grave': x['a'].get('fag', ''), 'wikidata': x['a'].get('wikidata', '')}}; kept += 1
        note = f"state extracts not read: {', '.join(failed)}; {kept} cemeteries kept from the previous build"
    return osm, note


# ---------------------------------------------------------------- HABS/HAER/HALS (Library of Congress)
LOC = 'https://www.loc.gov/collections/historic-american-buildings-landscapes-and-engineering-records/'
LOC_STATES = ['georgia', 'north carolina', 'tennessee', 'virginia', 'west virginia', 'maryland', 'district of columbia', 'pennsylvania',
              'new jersey', 'new york', 'connecticut', 'massachusetts', 'vermont', 'new hampshire', 'maine']


def loc_coords(r):
    """latitude and longitude from a loc.gov result, wherever the API puts them"""
    for src in (r, r.get('item') or {}):
        for k in ('latlong', 'coordinates', 'location_coordinates', 'lat_long'):
            v = src.get(k)
            if not v:
                continue
            if isinstance(v, dict):
                v = [v.get('lat') or v.get('latitude'), v.get('lon') or v.get('lng') or v.get('longitude')]
                txt = ','.join(str(x) for x in v if x is not None)
            elif isinstance(v, (list, tuple)):
                txt = ','.join(str(x) for x in v)
            else:
                txt = str(v)
            nums = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', txt)]
            if len(nums) >= 2:
                a, b = nums[0], nums[1]
                if 24 <= a <= 50 and -100 <= b <= -60: return a, b
                if 24 <= b <= 50 and -100 <= a <= -60: return b, a
    return None


def loc_get(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            wait = 75 if e.code == 429 else 10 * (k + 1)
            print(f'   loc.gov {e.code}; waiting {wait} s', flush=True); time.sleep(wait)
        except Exception as e:
            print(f'   loc.gov: {e}', flush=True); time.sleep(10 * (k + 1))
    raise RuntimeError('loc.gov did not answer')


def habs_items(inside):
    """HABS/HAER/HALS records with coordinates inside the cells (inside(la, lo) -> bool)"""
    out, seen, shown = [], set(), False
    for st in LOC_STATES:
        url = LOC + '?' + urllib.parse.urlencode({'fa': 'location_state:' + st, 'fo': 'json', 'c': 100, 'sp': 1})
        n = got = 0
        while url:
            j = loc_get(url); time.sleep(3)          # loc.gov asks for no more than about 20 requests a minute on collections
            res = j.get('results') or []
            for r in res:
                n += 1
                xy = loc_coords(r)
                if not xy:
                    if not shown:
                        print('   first record without coordinates has keys:', sorted(r.keys())[:40], flush=True); shown = True
                    continue
                la, lo = xy
                if not inside(la, lo):
                    continue
                link = str(r.get('url') or r.get('id') or '')
                if link in seen:
                    continue
                seen.add(link); got += 1
                blob = ' '.join(str(x) for x in (r.get('number') or []) + (r.get('other_title') or []) + [r.get('title') or '', link])
                m = re.search(r'\b(HABS|HAER|HALS)\b', blob, re.I) or re.search(r'\b(HABS|HAER|HALS)\b', json.dumps(r), re.I)
                city = r.get('location_city') or []
                out.append({'t': 'habs', 'nm': re.sub(r'\s+', ' ', str(r.get('title') or '')).strip().rstrip(','), 'la': la, 'lo': lo,
                            'a': {'kind': m.group(1).upper() if m else 'HABS', 'url': link, 'date': str(r.get('date') or ''),
                                  'city': (city[0] if isinstance(city, list) and city else str(city or '')).title()}})
            nxt = (j.get('pagination') or {}).get('next')
            url = nxt if nxt and res else None
        print(f'HABS/HAER/HALS {st}: {n} records read, {got} inside the cells', flush=True)
    return out


# ---------------------------------------------------------------- mining features (USGS USMIN, from historical topographic maps)
SB = 'https://www.sciencebase.gov/catalog/'
USMIN_ITEMS = ['64dfc0efd34e5f6cd553c265',     # consolidated release, San and Horton 2025 (one point and one polygon layer)
               '5a1492c3e4b09fc93dcfd574']     # the compilation it was made from, Horton and San Juan 2016, ver. 10.0


def sb_files(item):
    """(name, url) of the files on a ScienceBase item and its child items"""
    out = []
    def add(j):
        for f in (j.get('files') or []) + [x for x in (j.get('distributionLinks') or []) if x.get('uri')]:
            nm = f.get('name') or f.get('title') or ''; u = f.get('url') or f.get('downloadUri') or f.get('uri') or ''
            if u: out.append((nm, u))
    add(get_json(SB + 'item/' + item + '?format=json', timeout=120))
    try:
        kids = get_json(SB + 'items?' + urllib.parse.urlencode({'parentId': item, 'format': 'json', 'max': 50, 'fields': 'files,distributionLinks,title'}), timeout=120)
        for k in kids.get('items') or []:
            add(k)
    except Exception as e:
        print(f'   ScienceBase children of {item}: {e}', flush=True)
    return out


def usmin_items(cells):
    """mine-related features inside the cells, as points"""
    import zipfile, glob
    import numpy as np, shapely, pyogrio, geopandas as gpd
    from shapely.geometry import Polygon
    from pyproj import Transformer
    polys = [Polygon([(p[1], p[0]) for p in c['ring']]) for c in cells]
    tree = shapely.STRtree(polys)
    w = min(p.bounds[0] for p in polys); s = min(p.bounds[1] for p in polys); e = max(p.bounds[2] for p in polys); n = max(p.bounds[3] for p in polys)
    work = tempfile.mkdtemp(prefix='usmin_')
    last = None
    for item in USMIN_ITEMS:
        try:
            files = sb_files(item)
            print(f'USMIN ScienceBase {item}: {len(files)} files: ' + ', '.join(nm for nm, _ in files)[:600], flush=True)
            data = [(nm, u) for nm, u in files if re.search(r'\.(zip|gpkg)$', nm, re.I) and not re.search(r'metadata|xml|readme|pdf', nm, re.I)]
            data.sort(key=lambda f: (0 if re.search(r'gpkg|gdb|point', f[0], re.I) else 1, f[0]))
            if not data:
                raise RuntimeError('no data files on the item')
            sets = []
            for nm, u in data:
                path = os.path.join(work, re.sub(r'[^\w.-]', '_', nm))
                print(f'   downloading {nm}', flush=True); fetch_file(u, path)
                if path.lower().endswith('.zip'):
                    d = path[:-4]; zipfile.ZipFile(path).extractall(d); os.remove(path)
                    sets += glob.glob(os.path.join(d, '**', '*.gdb'), recursive=True) + glob.glob(os.path.join(d, '**', '*.gpkg'), recursive=True) + glob.glob(os.path.join(d, '**', '*.shp'), recursive=True)
                else:
                    sets.append(path)
                if sets:
                    break
            if not sets:
                raise RuntimeError('no geodatabase, GeoPackage or shapefile in the download')
            frames = []
            for ds in sets:
                for lyr, gt in pyogrio.list_layers(ds):
                    if not gt or not re.search(r'point|polygon', str(gt), re.I):
                        continue
                    info = pyogrio.read_info(ds, layer=lyr); crs = info.get('crs') or 'EPSG:4326'
                    t = Transformer.from_crs('EPSG:4326', crs, always_xy=True); xs, ys = t.transform([w, e, w, e], [s, s, n, n])
                    g = pyogrio.read_dataframe(ds, layer=lyr, bbox=(min(xs), min(ys), max(xs), max(ys)))
                    if not len(g):
                        continue
                    g = g.set_crs(crs, allow_override=True) if g.crs is None else g
                    g = g.to_crs(4326); g['geometry'] = g.geometry.representative_point()
                    frames.append(g); print(f'   {os.path.basename(ds)} / {lyr}: {len(g)} features in the area', flush=True)
            if not frames:
                raise RuntimeError('no point or polygon layers read')
            g = gpd.GeoDataFrame(pd_concat(frames), crs=4326)
            cols = {c.lower(): c for c in g.columns}
            col = lambda *names: next((cols[x] for x in names if x in cols), None)
            ft, fn, td, tn = col('ftr_type', 'feature_type', 'ftrtype', 'type'), col('ftr_name', 'feature_name', 'name'), col('topo_date', 'map_date', 'date'), col('topo_name', 'map_name', 'quad_name')
            if not ft:
                raise RuntimeError('no feature type field; fields: ' + ', '.join(g.columns))
            x, y = shapely.get_x(g.geometry.values), shapely.get_y(g.geometry.values)
            hit = np.zeros(len(g), bool)
            pi, ci = tree.query(g.geometry.values, predicate='within')
            hit[pi] = True
            out, seen = [], set()
            for i in np.flatnonzero(hit):
                typ = str(g.iat[i, g.columns.get_loc(ft)] or '').strip()
                key = (round(float(y[i]), 4), round(float(x[i]), 4), typ.lower())
                if key in seen:
                    continue
                seen.add(key)
                v = lambda c: ('' if c is None else str(g.iat[i, g.columns.get_loc(c)] or '').strip())
                dt = re.search(r'(18|19|20)\d\d', v(td)) if td else None
                out.append({'t': 'mine', 'nm': v(fn) if fn else '', 'la': float(y[i]), 'lo': float(x[i]),
                            'a': {'type': typ or 'Unidentified Feature', 'topo': v(tn) if tn else '', 'year': dt.group(0) if dt else ''}})
            print(f'USMIN: {len(out)} mine-related features inside the cells (from item {item})', flush=True)
            shutil.rmtree(work, ignore_errors=True)
            return out
        except Exception as ex:
            last = ex; print(f'USMIN item {item}: {ex}', flush=True)
    shutil.rmtree(work, ignore_errors=True)
    raise RuntimeError(f'mining features not read ({last})')


def pd_concat(frames):
    import pandas as pd
    return pd.concat(frames, ignore_index=True)


def main():
    cells, scope = load_cells()           # [{mi, ring:[[lat, lon], ...]}], sorted by trail mile
    chunks = []
    for i in range(0, len(cells), 10):
        rings = [c['ring'] for c in cells[i:i + 10]]; pts = [p for r in rings for p in r]
        chunks.append({'rings': rings, 's': min(p[0] for p in pts) - .01, 'n': max(p[0] for p in pts) + .01,
                       'w': min(p[1] for p in pts) - .01, 'e': max(p[1] for p in pts) + .01})
    found = {'nr': {}}; osm = {}; err = {}
    def inside(ch, p):
        return any(in_ring(p['la'], p['lo'], r) for r in ch['rings'])
    def arc_job(args):
        k, n, ch = args
        try:
            return k, ch, arc_query(SRC[k], ch), None
        except Exception as e:
            return k, ch, [], str(e)
    t0 = time.time()
    with ThreadPoolExecutor(4) as arc_pool:
        done = 0
        for k, ch, pts, e in arc_pool.map(arc_job, [(k, n, ch) for n, ch in enumerate(chunks, 1) for k in SRC]):
            if e: err[k] = e
            for p in pts:
                if inside(ch, p):
                    found[k][p['a'].get('OBJECTID', (p['la'], p['lo']))] = p
            done += 1
            if done % 10 == 0 or done == len(chunks) * len(SRC):
                print(f'National Register: stretch {done // len(SRC)} of {len(chunks)} ({time.time() - t0:.0f} s)', flush=True)
    try:
        osm, oe = osm_extracts(cells)
    except Exception as e:
        # no extract at all: keep every cemetery the previous file had
        print(f'OpenStreetMap: {e}; keeping the previous cemeteries', flush=True)
        try:
            prev = json.load(open(OUT))
        except Exception:
            prev = {}
        osm = {x['a']['osm']: {'id': x['a']['osm'], 'la': x['la'], 'lo': x['lo'], 'tags': {'name': x.get('nm', ''), 'denomination': x['a'].get('denomination', ''),
               'operator': x['a'].get('operator', ''), 'ref:find_a_grave': x['a'].get('fag', ''), 'wikidata': x['a'].get('wikidata', '')}}
               for x in prev.get('items', []) if x.get('t') == 'cem' and x.get('a', {}).get('osm')}
        oe = f'{e}; {len(osm)} cemeteries kept from the previous build'
    if oe:
        err['osm'] = oe
    items = []
    for p in found['nr'].values():
        a = p['a']; cd = a.get('CertDate')
        items.append({'t': 'nr', 'nm': a.get('RESNAME') or '', 'la': p['la'], 'lo': p['lo'],
                      'a': {'type': a.get('ResType') or '', 'refnum': a.get('NRIS_Refnum') or '',
                            'listed': datetime.fromtimestamp(cd / 1000, timezone.utc).strftime('%Y-%m-%d') if isinstance(cd, (int, float)) else '',
                            'nhl': str(a.get('Is_NHL') or '').lower().startswith('y'), 'nara': a.get('NARA_URL') or '', 'address': a.get('Address') or '',
                            'city': a.get('City') or '', 'county': a.get('County') or '', 'state': a.get('State') or '', 'multiple': a.get('MultiName') or '', 'extant': a.get('IS_EXTANT') or ''}})
    items += osm_cem(list(osm.values()))
    wikidata_fag(items)
    try:
        prev_items = json.load(open(OUT)).get('items', [])
    except Exception:
        prev_items = []
    def keep_prev(t, why):
        old = [x for x in prev_items if x.get('t') == t]
        for x in old:
            x.pop('ld', None); x.pop('adm', None); x.pop('tract', None)
        err[t] = f'{why}; {len(old)} kept from the previous build'; print(f'{t}: {err[t]}', flush=True); return old
    def in_cells(la, lo):
        return any(c['s'] <= la <= c['n'] and c['w'] <= lo <= c['e'] and any(in_ring(la, lo, r) for r in c['rings']) for c in chunks)
    try:
        hb = habs_items(in_cells)
        items += hb if hb else keep_prev('habs', 'no HABS/HAER/HALS records with coordinates were read')
    except Exception as e:
        items += keep_prev('habs', str(e))
    try:
        items += usmin_items(cells)
    except Exception as e:
        items += keep_prev('mine', str(e))
    for x in items:
        x['la'] = round(x['la'], 5); x['lo'] = round(x['lo'], 5)
    if all(k in err for k in ('nr', 'osm')):
        sys.exit('Every source failed; keeping the existing file. ' + json.dumps(err))
    le = tag_lands(items, chunks)
    if le:
        err['lands'] = le
    json.dump({'at': int(time.time() * 1000), 'items': items, 'err': err, 'lands': not le, 'scope': scope}, open(OUT, 'w'), separators=(',', ':'))
    counts = {t: sum(1 for x in items if x['t'] == t) for t in ('nr', 'cem', 'habs', 'mine')}
    print('wrote', OUT, counts, 'errors:', err or 'none')


if __name__ == '__main__':
    main()
