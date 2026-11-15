"""
Forest height and biomass for the A.T. Resource Grid ("What shape is the forest in?"), from NASA's GEDI lidar on the
International Space Station, in its 1 km gridded products (ORNL DAAC):
  - GEDI L3 Gridded Land Surface Metrics, Version 2 (doi:10.3334/ORNLDAAC/1952), April 2019 to March 2023:
    rh100_mean (average height of the top of the canopy in each 1 km square) and counts (GEDI footprints in the square).
  - GEDI L4B Gridded Aboveground Biomass Density, Version 2.1 (doi:10.3334/ORNLDAAC/2299), April 2019 to March 2023:
    MU (mean aboveground biomass density, Mg/ha) and NS (high-quality footprints used).
GEDI samples strips of 25 m footprints, so 1 km squares off its tracks are empty, and some cells hold only a few footprints.

For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi) it writes, from the 1 km squares whose centers fall in the cell
(or the square under its center, for small cells), weighted by the number of footprints:
  FS_H     average top-of-canopy height, m (all land, forest and open)
  FS_HN    GEDI footprints behind FS_H
  FS_AGB   aboveground biomass density, Mg/ha
  FS_BN    footprints behind FS_AGB
Cells with fewer than MIN_SHOTS footprints are left empty (FS_HN and FS_BN still say how many there were).

  python scripts/build_forest_structure.py
Needs the EARTHDATA_TOKEN secret (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD). Writes data/forest_structure.json and
data/forest_structure_huc10.json. Runs yearly in GitHub Actions (.github/workflows/forest_structure.yml), in case a new release appears.
"""
import os, re, shutil, tempfile, warnings
from datetime import date
import numpy as np
warnings.filterwarnings('ignore')
from nasa_common import grids, footprint, login, Labeler, write, log, rnd, LEVELS

NAME, THEME = 'forest_structure', 'gedi'
L3_DOI = '10.3334/ORNLDAAC/1952'
L4B_DOIS = ('10.3334/ORNLDAAC/2299', '10.3334/ORNLDAAC/2017')   # Version 2.1 (to March 2023), then Version 2 (to August 2021)
MIN_SHOTS = 20


def newest(files, layer):
    """the file for one layer, from the release that runs latest (L3 file names end in <start>_<end>_<release>_<version>.tif)"""
    c = [f for f in files if re.search(r'[_-]' + layer + r'[_.]', os.path.basename(f)) or os.path.basename(f).endswith('_' + layer + '.tif')]
    c = [f for f in c if f.endswith('.tif')]
    if not c: return None
    def key(f):
        d = re.findall(r'(\d{7})_(\d{7})', os.path.basename(f)); w = re.findall(r'MW(\d{3})MW(\d{3})', os.path.basename(f))
        return (int(d[-1][1]) if d else 0, int(w[-1][1]) if w else 0, os.path.basename(f))
    return sorted(c, key=key)[-1]


def links(ea, doi):
    out = []
    for g in ea.search_data(doi=doi):
        out += [u for u in (g.data_links(access='external') or g.data_links()) if u.endswith('.tif')]
    log(f'{doi}: {len(out)} files')
    return out


def read_window(path, fp):
    """the part of a global 1 km raster around the cells"""
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    with rasterio.open(path) as src:
        b = transform_bounds('EPSG:4326', src.crs, *fp.bounds)
        w = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        a = src.read(1, window=w, boundless=True, fill_value=src.nodata if src.nodata is not None else -9999).astype('float64')
        return a, src.crs, src.window_transform(w), src.nodata


def main():
    G = grids(); fp = footprint(G); ea = login(); tmp = tempfile.mkdtemp()
    try:
        l3 = links(ea, L3_DOI); l4 = []
        for d in L4B_DOIS:
            l4 = links(ea, d)
            if l4: break
        want = {'h': newest(l3, 'rh100_mean'), 'hn': newest(l3, 'counts'), 'b': newest(l4, 'MU'), 'bn': newest(l4, 'NS')}
        for k, u in want.items(): log(k, u)
        if not want['h'] or not want['hn']: raise SystemExit('GEDI L3 canopy height files not found.')
        got = ea.download([u for u in want.values() if u], local_path=tmp, show_progress=False)
        local = {os.path.basename(str(p)): str(p) for p in got}
        R = {k: read_window(local[os.path.basename(u)], fp) if u and os.path.basename(u) in local else None for k, u in want.items()}
        fields = {ext: {lv: {} for lv in LEVELS} for ext in G}
        for (val, cnt, fv, fn) in (('h', 'hn', 'FS_H', 'FS_HN'), ('b', 'bn', 'FS_AGB', 'FS_BN')):
            if not R[val] or not R[cnt]: log(f'{fv}: not available'); continue
            v, crs, tr, nd = R[val]; n, _, _, nd2 = R[cnt]
            ok = np.isfinite(v) & (v != (nd if nd is not None else -9999)) & (v >= 0) & (n > 0) & (n < 60000)
            if val == 'h' and np.nanmedian(v[ok]) > 100: v = v / 100        # in case heights come in centimeters
            lab = Labeler(G, crs, tr, v.shape, coarse=True)
            for ext in G:
                for lv in LEVELS:
                    sw, _ = lab.sums(ext, lv, v * n, ok); sn, _ = lab.sums(ext, lv, n, ok)
                    mean = np.where(sn >= MIN_SHOTS, sw / np.maximum(sn, 1), np.nan)
                    fields[ext][lv][fv] = [rnd(x, 1) for x in mean]
                    fields[ext][lv][fn] = [int(x) if x > 0 else 0 for x in sn]
                    m = [x for x in fields[ext][lv][fv] if x is not None]
                    log(f'{ext} {lv} {fv}: {len(m)} of {len(sn)} cells with {MIN_SHOTS}+ footprints, median {np.median(m) if m else 0:.1f}')
        meta = {'built': date.today().isoformat(), 'min_shots': MIN_SHOTS,
                'files': {k: os.path.basename(u) for k, u in want.items() if u},
                'source': 'GEDI L3 Gridded Land Surface Metrics, Version 2 (Dubayah et al. 2021, ORNL DAAC, doi:10.3334/ORNLDAAC/1952), April 2019 to March 2023; GEDI L4B Gridded Aboveground Biomass Density, Version 2.1 (Dubayah et al. 2023, ORNL DAAC, doi:10.3334/ORNLDAAC/2299), April 2019 to March 2023. 1 km.'}
        write(NAME, THEME, G, fields, meta)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
