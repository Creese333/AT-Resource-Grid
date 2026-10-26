"""
State lines for the A.T. Resource Grid's map: states.json, the boundaries of the states around the trail as lines.

Source: U.S. Census Bureau cartographic boundary file of states, 1:500,000 (the newest year that downloads). The lines are
clipped to a box around the trail's HUC10 watersheds (or the corridor cells when that file is missing), with shared borders
drawn once, lightly simplified (about 5 m), and written as GeoJSON next to this script. The dashboard reads states.json.

State lines hardly ever change: run it once from the Actions tab ("State lines", Run workflow), and again only if needed.
Needs geopandas (with pyogrio) and shapely.
"""
import json, os, sys, urllib.parse, urllib.request
import geopandas as gpd
from shapely.geometry import box
from shapely.ops import linemerge, unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'states.json')
HUC = os.path.join(HERE, 'soils_wetlands_huc10.json')
CELLS = os.path.join(HERE, 'at_wheel_cells.json')
# an ArcGIS feature layer of state boundaries to use first, e.g. https://services.arcgis.com/.../FeatureServer/0 (leave '' for the Census file)
ARCGIS = os.environ.get('STATES_ARCGIS', '')
SRC = [os.environ['STATES_SRC']] if os.environ.get('STATES_SRC') else \
      [f'https://www2.census.gov/geo/tiger/GENZ{y}/shp/cb_{y}_us_state_500k.zip' for y in (2024, 2023, 2022, 2021)]
PAD = 0.75          # degrees of map around the cells
SIMPLIFY = 0.00005  # degrees (about 5 m)


def extent():
    """lon/lat box around the grid cells"""
    pts = []
    try:
        w = json.load(open(HUC))['levels']['wheel']
        for g in w['g']:
            la, lo = g[0], g[1]; pts.append((la / 1e5, lo / 1e5))
            for k in range(2, len(g), 2):
                la += g[k]; lo += g[k + 1]; pts.append((la / 1e5, lo / 1e5))
        print(f'extent from the HUC10 shell ({len(w["g"])} cells)', flush=True)
    except Exception as e:
        print(f'HUC10 cells not read ({e}); using the corridor cells', flush=True)
        for c in json.load(open(CELLS)):
            pts += [tuple(p) for p in c['ring']]
    las = [p[0] for p in pts]; los = [p[1] for p in pts]
    return box(min(los) - PAD, min(las) - PAD, max(los) + PAD, max(las) + PAD)


def arcgis_states(layer, bx):
    """the states from an ArcGIS feature layer that touch the box, as a GeoDataFrame (paged, GeoJSON)"""
    feats, off = [], 0
    while True:
        q = {'where': '1=1', 'outFields': '*', 'outSR': 4326, 'f': 'geojson', 'resultOffset': off, 'resultRecordCount': 50, 'maxAllowableOffset': SIMPLIFY, 'geometryPrecision': 6,
             'geometry': ','.join(str(round(v, 4)) for v in bx.bounds), 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects'}
        req = urllib.request.Request(layer.rstrip('/') + '/query?' + urllib.parse.urlencode(q), headers={'User-Agent': 'AT-Resource-Grid state lines build'})
        with urllib.request.urlopen(req, timeout=180) as r:
            j = json.load(r)
        if 'error' in j:
            raise RuntimeError(j['error'].get('message', 'service error'))
        got = j.get('features') or []; feats += got
        if not got or not (j.get('exceededTransferLimit') or (j.get('properties') or {}).get('exceededTransferLimit')):
            break
        off += len(got)
    if not feats:
        raise RuntimeError('no states returned')
    return gpd.GeoDataFrame.from_features(feats, crs=4326)


def main():
    bx = extent()
    gdf = None
    if ARCGIS:
        try:
            gdf = arcgis_states(ARCGIS, bx); url = ARCGIS; print('read', ARCGIS, len(gdf), 'states', flush=True)
        except Exception as e:
            print(f'   {ARCGIS}: {e}; trying the Census file', flush=True)
    for url in ([] if gdf is not None else SRC):
        try:
            gdf = gpd.read_file(url).to_crs(4326); print('read', url, len(gdf), 'states', flush=True); break
        except Exception as e:
            print(f'   {url}: {e}', flush=True)
    if gdf is None:
        sys.exit('No Census state file could be read; states.json left as it was.')
    gdf = gdf[gdf.intersects(bx)]
    ab = next((k for k in ('STUSPS', 'STATE_ABBR', 'STUSAB', 'ABBR', 'STATE_NAME', 'NAME') if k in gdf), None)
    print('states in the box:', ', '.join(sorted(map(str, gdf[ab]))) if ab else len(gdf), flush=True)
    lines = unary_union([g.boundary for g in gdf.geometry])     # shared borders once
    lines = linemerge(lines.intersection(bx)).simplify(SIMPLIFY, preserve_topology=False)
    geoms = list(getattr(lines, 'geoms', [lines]))

    def rnd(c):
        return [[round(x, 5), round(y, 5)] for x, y in c]
    feats = [{'type': 'Feature', 'properties': {}, 'geometry': {'type': 'LineString', 'coordinates': rnd(g.coords)}}
             for g in geoms if g.geom_type == 'LineString' and len(g.coords) > 1]
    json.dump({'type': 'FeatureCollection', 'source': url if url == ARCGIS else 'U.S. Census Bureau cartographic boundary file, states, 1:500,000 (' + os.path.basename(url) + ')',
               'features': feats}, open(OUT, 'w'), separators=(',', ':'))
    print(f'wrote {OUT}: {len(feats)} lines, {sum(len(f["geometry"]["coordinates"]) for f in feats)} points, {os.path.getsize(OUT) // 1024} KB', flush=True)


if __name__ == '__main__':
    main()
