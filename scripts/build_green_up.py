"""
Green-up and leaf-off for the A.T. Resource Grid ("What shape is the forest in?"), from NASA's MODIS Land Cover Dynamics
(MCD12Q2, Version 6.1, LP DAAC): yearly dates of green-up and dormancy at 500 m, from 2001, found from the seasonal rise and fall of
the EVI2 vegetation index in Terra and Aqua imagery.

For each year it reads the first vegetation cycle of every 500 m pixel with overall quality good to fair (QA_Overall 0 to 2):
Greenup (the date the index first passes 15% of its seasonal rise) and Dormancy (the date it falls back to 15%), as days of the year.
For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi), from the pixels whose centers fall in it (or the pixel under its
center, for small cells), it writes
  LSP_GU    green-up, average day of the year over the latest five years
  LSP_DO    leaf-off (dormancy), average day of the year over the latest five years
  LSP_GS    growing season, days from green-up to dormancy, latest five years
  LSP_GUD   change in green-up, days: the latest five years minus 2001-2005 (negative is earlier)
  LSP_DOD   change in leaf-off, days, the same way
  LSP_GU_Y  green-up by year from 2001 (corridor cells only, for the chart)

  python scripts/build_green_up.py
Needs the EARTHDATA_TOKEN secret (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD). Writes data/green_up.json and
data/green_up_huc10.json. Runs yearly in GitHub Actions (.github/workflows/green_up.yml); NASA adds a year about 18 months after it ends.
MODIS on Terra and Aqua is near its end; when MCD12Q2 stops, the VIIRS product VNP22Q2 continues the record and can be added here.
"""
import os, re, shutil, tempfile, warnings
from datetime import date
import numpy as np
warnings.filterwarnings('ignore')
from nasa_common import grids, footprint, login, Labeler, write, log, rnd, LEVELS

NAME, THEME = 'green_up', 'lsp'
SHORT, VERSION = 'MCD12Q2', '061'
TILE = 1111950.5196666666; PX = TILE / 2400
SINU = '+proj=sinu +lon_0=0 +x_0=0 +y_0=0 +R=6371007.181 +units=m +no_defs'
FIRST = (2001, 2005)
FILL = 32767


def tile_transform(h, v):
    from rasterio.transform import from_origin
    return from_origin(-20015109.354 + h * TILE, 10007554.677 - v * TILE, PX, PX)


def read_hdf(path):
    from pyhdf.SD import SD, SDC
    f = SD(path, SDC.READ)
    def get(name):
        a = f.select(name).get(); return a[0] if a.ndim == 3 else a      # first vegetation cycle
    out = {k: get(k).astype('int32') for k in ('Greenup', 'Dormancy', 'QA_Overall')}
    f.end(); return out


def main():
    G = grids(); fp = footprint(G); ea = login()
    res = ea.search_data(short_name=SHORT, version=VERSION, bounding_box=tuple(fp.bounds))
    by = {}
    for g in res:
        nm = g['umm']['GranuleUR']; m = re.search(r'\.A(\d{4})\d{3}\.h(\d{2})v(\d{2})\.', nm)
        if m: by.setdefault(int(m.group(1)), []).append((int(m.group(2)), int(m.group(3)), g))
    years = sorted(by); log(f'{len(res)} files, years {years[0]}-{years[-1]}' if years else 'no files')
    if not years: raise SystemExit('No MCD12Q2 files found.')
    Y = len(years); y0 = years[0]
    acc = {k: {ext: {lv: np.zeros((len(G[ext][lv]), Y)) for lv in LEVELS} for ext in G} for k in ('gu', 'gun', 'do', 'don')}
    labs = {}
    for yi, yr in enumerate(years):
        jan1 = (np.datetime64(f'{yr}-01-01') - np.datetime64('1970-01-01')).astype(int)
        tmp = tempfile.mkdtemp()
        try:
            try:
                paths = ea.download([g for _, _, g in by[yr]], local_path=tmp, show_progress=False)   # the year's tiles, in parallel
            except Exception as ex:
                log(f'  {yr}: not downloaded ({str(ex)[:90]})'); paths = []
            byname = {os.path.basename(str(p)): str(p) for p in paths}
            for h, v, g in by[yr]:
                p = next((byname[k] for k in byname if f'.h{h:02d}v{v:02d}.' in k), None)
                if not p: log(f'  {yr} h{h:02d}v{v:02d}: missing'); continue
                try:
                    d = read_hdf(p)
                except Exception as ex:
                    log(f'  {yr} h{h:02d}v{v:02d}: not read ({str(ex)[:90]})'); continue
                if (h, v) not in labs: labs[(h, v)] = Labeler(G, SINU, tile_transform(h, v), (2400, 2400), coarse=True)
                lab = labs[(h, v)]; qa = (d['QA_Overall'] >= 0) & (d['QA_Overall'] <= 2)
                gu = d['Greenup'] - jan1; do = d['Dormancy'] - jan1
                okg = qa & (d['Greenup'] != FILL) & (gu > 0) & (gu < 250)
                okd = qa & (d['Dormancy'] != FILL) & (do > 150) & (do < 450)
                for ext in G:
                    for lv in LEVELS:
                        s, k = lab.sums(ext, lv, gu, okg); acc['gu'][ext][lv][:, yi] += s; acc['gun'][ext][lv][:, yi] += k
                        s, k = lab.sums(ext, lv, do, okd); acc['do'][ext][lv][:, yi] += s; acc['don'][ext][lv][:, yi] += k
            log(f'{yr}: {len(by[yr])} tiles')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    yrs = np.array(years); last5 = yrs >= yrs.max() - 4; first = (yrs >= FIRST[0]) & (yrs <= FIRST[1])
    fields = {}
    with np.errstate(invalid='ignore', divide='ignore'):
        for ext in G:
            fields[ext] = {}
            for lv in LEVELS:
                gu = acc['gu'][ext][lv] / acc['gun'][ext][lv]; do = acc['do'][ext][lv] / acc['don'][ext][lv]
                m = lambda a, sel: np.where(np.isfinite(a[:, sel]).sum(1) >= max(2, sel.sum() - 2), np.nanmean(a[:, sel], 1), np.nan)
                GU, DO, GU0, DO0 = m(gu, last5), m(do, last5), m(gu, first), m(do, first)
                f = {'LSP_GU': [rnd(x, 0) for x in GU], 'LSP_DO': [rnd(x, 0) for x in DO], 'LSP_GS': [rnd(x, 0) for x in DO - GU],
                     'LSP_GUD': [rnd(x, 1) for x in GU - GU0], 'LSP_DOD': [rnd(x, 1) for x in DO - DO0]}
                if ext == 'corr': f['LSP_GU_Y'] = [[rnd(x, 0) for x in row] if np.isfinite(row).any() else None for row in gu]
                fields[ext][lv] = f
                v = [x for x in f['LSP_GUD'] if x is not None]
                log(f'{ext} {lv}: green-up for {sum(x is not None for x in f["LSP_GU"])} of {len(GU)} cells; median change since {FIRST[0]}-{FIRST[1]} {np.median(v) if v else 0:+.1f} days')
    meta = {'built': date.today().isoformat(), 'y0': y0, 'y1': int(yrs.max()), 'years': years, 'first': list(FIRST), 'last': [int(yrs.max()) - 4, int(yrs.max())],
            'source': 'MODIS/Terra+Aqua Land Cover Dynamics Yearly L3 Global 500m SIN Grid, Version 6.1 (MCD12Q2.061; Friedl, Gray and Sulla-Menashe), NASA LP DAAC.'}
    write(NAME, THEME, G, fields, meta)


if __name__ == '__main__':
    main()
