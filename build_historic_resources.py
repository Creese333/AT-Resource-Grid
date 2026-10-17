"""
Builds historic_resources.json for the A.T. Resource Grid.

Fetches, for the A.T. corridor (the 49 sq mi grid cells in at_wheel_cells.json):
  - National Register of Historic Places points (National Park Service)
  - Historic sites / points of interest and cemeteries (USGS National Structures Dataset)
  - Cemeteries from OpenStreetMap (Overpass API)
  - the A.T. administrative area (AT_Lands tract) each record falls in, for the dashboard's Administrative filter
merges USGS and OpenStreetMap cemeteries (same place within 300 m, or same name within 1.5 km),
and writes historic_resources.json next to this script. The dashboard reads that file.

Standard library only. Runs in GitHub Actions (see .github/workflows/historic_resources.yml) or anywhere with Python 3.
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CELLS = os.path.join(HERE, 'at_wheel_cells.json')
OUT = os.path.join(HERE, 'historic_resources.json')
UA = {'User-Agent': 'AT-Resource-Grid historic resources build (NPS Appalachian National Scenic Trail)'}

SRC = {
    'nr': {'urls': ['https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0',
                    'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhpTest/MapServer/0'],
           'fields': 'OBJECTID,RESNAME,ResType,NRIS_Refnum,CertDate,Is_NHL,NARA_URL,Address,City,County,State,MultiName,IS_EXTANT'},
    'hs': {'urls': ['https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/46'], 'fields': 'OBJECTID,NAME,GNIS_ID,ADDRESS,CITY,STATE'},
    'cem': {'urls': ['https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/37'], 'fields': 'OBJECTID,NAME,GNIS_ID,ADDRESS,CITY,STATE'},
}
LANDS = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/AT_Lands/FeatureServer/1'
# public Overpass servers; each stretch tries them in turn
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']


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


def osm_query(ch, rounds=1, pause=5):
    box = f"{ch['s']},{ch['w']},{ch['n']},{ch['e']}"
    q = f'[out:json][timeout:120];(nwr["landuse"="cemetery"]({box});nwr["amenity"="grave_yard"]({box}););out center tags;'
    data = urllib.parse.urlencode({'data': q}).encode()
    last = None
    for r in range(rounds):
        for ep in OVERPASS:
            try:
                req = urllib.request.Request(ep, data=data, headers=dict(UA, **{'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'}))
                with urllib.request.urlopen(req, timeout=150) as resp:
                    j = json.load(resp)
                res = []
                for e in j.get('elements', []):
                    la = e.get('lat', (e.get('center') or {}).get('lat')); lo = e.get('lon', (e.get('center') or {}).get('lon'))
                    if la is not None:
                        res.append({'id': f"{e['type']}/{e['id']}", 'la': la, 'lo': lo, 'tags': e.get('tags') or {}})
                return res
            except Exception as e:
                last = f'{ep.split("/")[2]}: {e}'
                print(f'   Overpass {last}', flush=True)
                time.sleep(pause)
        time.sleep(pause * 4)
    raise RuntimeError(last or 'Overpass did not answer')


STOP = re.compile(r'\b(cemetery|cemeteries|cem|graveyard|grave yard|burying ground|burial ground|burial site|family|the|of|memorial gardens?)\b')
norm = lambda s: re.sub(r'[^a-z0-9]+', '', STOP.sub('', (s or '').lower()))
def dist(a, b):
    k = math.cos(math.radians(a['la']))
    return math.hypot((a['lo'] - b['lo']) * k * 111320, (a['la'] - b['la']) * 110540)


def merge_cem(us, osm):
    out = [{'t': 'cem', 'nm': u['a'].get('NAME') or '', 'la': u['la'], 'lo': u['lo'],
            'a': {'source': 'USGS', 'gnis_id': u['a'].get('GNIS_ID') or '', 'city': u['a'].get('CITY') or '', 'state': u['a'].get('STATE') or ''}} for u in us]
    used = set()
    for o in osm:
        nm = o['tags'].get('name', ''); nn = norm(nm); best, bd = -1, 1e18
        for i, u in enumerate(out):
            if i in used or u['a']['source'] == 'OpenStreetMap':
                continue
            d = dist(u, o)
            if (d <= 300 or (nn and norm(u['nm']) == nn and d <= 1500)) and d < bd:
                best, bd = i, d
        if best >= 0:
            used.add(best); u = out[best]; u['a']['source'] = 'USGS and OpenStreetMap'; u['a']['osm'] = o['id']
            if not u['nm'] and nm: u['nm'] = nm
            if o['tags'].get('denomination'): u['a']['denomination'] = o['tags']['denomination']
        else:
            out.append({'t': 'cem', 'nm': nm, 'la': o['la'], 'lo': o['lo'],
                        'a': {'source': 'OpenStreetMap', 'osm': o['id'], 'denomination': o['tags'].get('denomination', ''), 'operator': o['tags'].get('operator', '')}})
    return out


def main():
    cells = json.load(open(CELLS))           # [{mi, ring:[[lat, lon], ...]}], sorted by trail mile
    chunks = []
    for i in range(0, len(cells), 8):
        rings = [c['ring'] for c in cells[i:i + 8]]; pts = [p for r in rings for p in r]
        chunks.append({'rings': rings, 's': min(p[0] for p in pts) - .01, 'n': max(p[0] for p in pts) + .01,
                       'w': min(p[1] for p in pts) - .01, 'e': max(p[1] for p in pts) + .01})
    found = {'nr': {}, 'hs': {}, 'cem': {}}; osm = {}; err = {}
    def inside(ch, p):
        return any(in_ring(p['la'], p['lo'], r) for r in ch['rings'])
    def arc_job(args):
        k, n, ch = args
        try:
            return k, ch, arc_query(SRC[k], ch), None
        except Exception as e:
            return k, ch, [], str(e)
    def osm_job(args):
        n, ch = args
        try:
            return ch, osm_query(ch), None
        except Exception as e:
            return ch, [], str(e)
    t0 = time.time()
    with ThreadPoolExecutor(4) as arc_pool, ThreadPoolExecutor(2) as osm_pool:
        arc_f = arc_pool.map(arc_job, [(k, n, ch) for n, ch in enumerate(chunks, 1) for k in SRC])
        osm_f = osm_pool.map(osm_job, list(enumerate(chunks, 1)))
        done = 0
        for k, ch, pts, e in arc_f:
            if e: err[k] = e
            for p in pts:
                if inside(ch, p):
                    found[k][p['a'].get('OBJECTID', (p['la'], p['lo']))] = p
            done += 1
            if done % len(SRC) == 0:
                print(f'NPS and USGS: stretch {done // len(SRC)} of {len(chunks)} ({time.time() - t0:.0f} s)', flush=True)
        done = 0; failed = []
        for ch, pts, e in osm_f:
            if e: failed.append(ch)
            for p in pts:
                if inside(ch, p):
                    osm[p['id']] = p
            done += 1
            print(f'OpenStreetMap: stretch {done} of {len(chunks)}{" (will retry)" if e else ""} ({time.time() - t0:.0f} s)', flush=True)
    # second pass: stretches Overpass refused, one at a time, more patiently
    still = []
    for n, ch in enumerate(failed, 1):
        print(f'OpenStreetMap retry {n} of {len(failed)}', flush=True); time.sleep(15)
        try:
            for p in osm_query(ch, rounds=3, pause=10):
                if inside(ch, p):
                    osm[p['id']] = p
        except Exception as e:
            still.append(ch); print(f'   gave up: {e}', flush=True)
    # stretches never reached: keep the OpenStreetMap cemeteries from the previous file there
    if still:
        kept = 0
        try:
            prev = json.load(open(OUT))
            for x in prev.get('items', []):
                o = x.get('a', {}).get('osm')
                if x.get('t') == 'cem' and o and any(inside(ch, x) for ch in still):
                    osm[o] = {'id': o, 'la': x['la'], 'lo': x['lo'], 'tags': {'name': x.get('nm', ''), 'denomination': x['a'].get('denomination', ''), 'operator': x['a'].get('operator', '')}}; kept += 1
        except Exception:
            pass
        err['osm'] = f'{len(still)} of {len(chunks)} stretches not reached' + (f'; {kept} OpenStreetMap cemeteries kept from the previous build there' if kept else '')
    items = []
    for p in found['nr'].values():
        a = p['a']; cd = a.get('CertDate')
        items.append({'t': 'nr', 'nm': a.get('RESNAME') or '', 'la': p['la'], 'lo': p['lo'],
                      'a': {'type': a.get('ResType') or '', 'refnum': a.get('NRIS_Refnum') or '',
                            'listed': datetime.fromtimestamp(cd / 1000, timezone.utc).strftime('%Y-%m-%d') if isinstance(cd, (int, float)) else '',
                            'nhl': str(a.get('Is_NHL') or '').lower().startswith('y'), 'nara': a.get('NARA_URL') or '', 'address': a.get('Address') or '',
                            'city': a.get('City') or '', 'county': a.get('County') or '', 'state': a.get('State') or '', 'multiple': a.get('MultiName') or '', 'extant': a.get('IS_EXTANT') or ''}})
    for p in found['hs'].values():
        a = p['a']
        items.append({'t': 'hs', 'nm': a.get('NAME') or '', 'la': p['la'], 'lo': p['lo'],
                      'a': {'gnis_id': a.get('GNIS_ID') or '', 'address': a.get('ADDRESS') or '', 'city': a.get('CITY') or '', 'state': a.get('STATE') or ''}})
    items += merge_cem(list(found['cem'].values()), list(osm.values()))
    for x in items:
        x['la'] = round(x['la'], 5); x['lo'] = round(x['lo'], 5)
    if all(k in err for k in ('nr', 'hs', 'cem', 'osm')):
        sys.exit('Every source failed; keeping the existing file. ' + json.dumps(err))
    le = tag_lands(items, chunks)
    if le:
        err['lands'] = le
    json.dump({'at': int(time.time() * 1000), 'items': items, 'err': err, 'lands': not le}, open(OUT, 'w'), separators=(',', ':'))
    counts = {t: sum(1 for x in items if x['t'] == t) for t in ('nr', 'hs', 'cem')}
    print('wrote', OUT, counts, 'errors:', err or 'none')


if __name__ == '__main__':
    main()
