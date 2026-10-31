"""
Forest pest and disease risk for the A.T. Resource Grid ("Where are forest pests turning up?").

From the USDA Forest Service 2024 National Insect and Disease Risk Map (NIDRM), composite risk, 240 m, coterminous U.S.
(Forest Health Assessment and Applied Sciences Team, 2025). A 240 m cell is "at risk" where 25 percent or more of the standing live
basal area of trees over 1 inch in diameter is expected to die from insects and diseases over 2024 to 2038, without remediation;
the map integrates 172 insect and disease hazard models. Its values: 1 at risk, 0 treed but not at risk, 3 not treed (no data).

For each grid cell (hex, cog and wheel, in the A.T. corridor and in the HUC10 shell) the 240 m cells whose centers fall inside it
are counted, and it writes:
  FHR_PCT    share of the treed area at risk, %          (empty where the map shows no trees)
  FHR_AC     acres at risk
  FHR_TAC    treed acres (at risk or not)

  python scripts/build_forest_risk.py     reads inputs/nidrm2024_composite_risk.tif (or the zip from the Forest Service)
Writes data/forest_risk.json (corridor) and data/forest_risk_huc10.json (HUC10 shell). Needs geopandas, shapely, rasterio, numpy.
The map is updated every few years; run this again when a new one comes out.
"""
import glob, json, os, re, zipfile
from datetime import date
import numpy as np, geopandas as gpd, rasterio
from rasterio import features, windows
from shapely.geometry import Polygon

SCRIPTS = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.dirname(SCRIPTS)
DATA, INPUTS = os.path.join(HERE, 'data'), os.path.join(HERE, 'inputs')
INDEX, HUCFILE = os.path.join(HERE, 'index.html'), os.path.join(DATA, 'soils_wetlands_huc10.json')
OUT = {'corr': os.path.join(DATA, 'forest_risk.json'), 'huc': os.path.join(DATA, 'forest_risk_huc10.json')}
ACRES_PER_PX = 240 * 240 / 4046.8564224


def risk_path():
    for p in [os.path.join(INPUTS, 'nidrm2024_composite_risk.tif')] + sorted(glob.glob(os.path.join(INPUTS, '*.tif'))):
        if os.path.exists(p): return p
    for z in sorted(glob.glob(os.path.join(INPUTS, '*composite*.zip'))):
        with zipfile.ZipFile(z) as f:
            n = [x for x in f.namelist() if x.endswith('risk.tif')]
            if n: return '/vsizip/' + z + '/' + n[0]
    raise SystemExit('No NIDRM composite risk raster in inputs/ (nidrm2024_composite_risk.tif, or the Forest Service zip).')


def rings_of(L):
    out = []
    for g in L['g']:
        la, lo = g[0], g[1]; r = [(lo / 1e5, la / 1e5)]
        for k in range(2, len(g), 2):
            la += g[k]; lo += g[k + 1]; r.append((lo / 1e5, la / 1e5))
        out.append(Polygon(r))
    return out


def load_grids():
    h = open(INDEX, encoding='utf-8').read()
    P = json.loads(re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S).group(1))
    g = {'corr': {lv: gpd.GeoDataFrame({'id': P['levels'][lv]['id']}, geometry=rings_of(P['levels'][lv]), crs=4326) for lv in ('hex', 'cog', 'wheel')}}
    if os.path.exists(HUCFILE):
        H = json.load(open(HUCFILE, encoding='utf-8'))
        g['huc'] = {lv: gpd.GeoDataFrame({'id': H['levels'][lv]['id']}, geometry=rings_of(H['levels'][lv]), crs=4326) for lv in ('hex', 'cog', 'wheel')}
    return g


def summarize(src, cells):
    c = cells.to_crs(src.crs); n = len(c)
    win = windows.from_bounds(*c.total_bounds, transform=src.transform).round_offsets().round_lengths()
    a = src.read(1, window=win, boundless=True, fill_value=src.nodata if src.nodata is not None else 3)
    lab = features.rasterize(((geom, i + 1) for i, geom in enumerate(c.geometry)), out_shape=a.shape, transform=src.window_transform(win), fill=0, dtype='int32')
    lab = lab.ravel(); a = a.ravel()
    tot = np.bincount(lab, minlength=n + 1)[1:]
    risk = np.bincount(lab[a == 1], minlength=n + 1)[1:]
    treed = risk + np.bincount(lab[a == 0], minlength=n + 1)[1:]
    pct = [round(100 * r / t, 1) if t else None for r, t in zip(risk, treed)]
    ac = [round(r * ACRES_PER_PX) if t else None for r, t in zip(risk, treed)]
    tac = [round(t * ACRES_PER_PX) if t else None for t in treed]
    return {'FHR_PCT': pct, 'FHR_AC': ac, 'FHR_TAC': tac}


def main():
    path = risk_path(); grids = load_grids()
    meta = {'built': date.today().isoformat(), 'source': 'USDA Forest Service, Forest Health Assessment and Applied Sciences Team (2025). 2024 National Insect and Disease Risk Map: composite risk of tree mortality from insects and diseases, 2024-2038, 240 m.',
            'definition': 'At risk: 25 percent or more of the standing live basal area of trees over 1 inch in diameter expected to die from insects and diseases over 2024-2038, without remediation.'}
    with rasterio.open(path) as src:
        for ext, L in grids.items():
            themes = {}
            for lv, cells in L.items():
                f = summarize(src, cells); themes[lv] = {'ids': cells['id'].tolist(), 'f': f}
                v = [x for x in f['FHR_PCT'] if x is not None]
                print(f'{ext} {lv}: {len(cells)} cells, {len(v)} with trees, median {np.median(v) if v else 0:.1f}% of treed area at risk', flush=True)
            json.dump({'run': date.today().isoformat(), 'meta': meta, 'themes': {'fhr': themes}}, open(OUT[ext], 'w', encoding='utf-8'), separators=(',', ':'))
            print('wrote', OUT[ext], f'{os.path.getsize(OUT[ext]) / 1e6:.1f} MB', flush=True)


if __name__ == '__main__':
    main()
