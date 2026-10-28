# A.T. Resource Grid

**[grid.trailassessment.org](https://grid.trailassessment.org)** An interactive dashboard of natural and cultural resources along the Appalachian National Scenic Trail, summarized on a grid of 1, 7 and 49 square mile cells (NatureServe hex, cog and wheel) for the A.T. corridor and the HUC10 watersheds around it.

Built for the Appalachian National Scenic Trail to screen where to look more closely: restoration targets, invasive species and forest pests, birds, vegetation, geology, soils, wetlands, facilities, historic resources, visitation, land administration, weather and climate, and where the trail is most vulnerable to damage. Pick a question, a measure and a stretch of trail; select cells for their details and export them to CSV or Excel.

> The summaries are generalized to the grid and are for screening and planning. They are not site assessments, boundary determinations or a trail condition survey.

## Automatic updates

Each dataset is rebuilt by a GitHub Actions workflow, which commits the new file; the site picks it up. Run any of them by hand from the **Actions** tab ("Run workflow").

| Workflow | Status | Builds | Runs |
|---|---|---|---|
| iNaturalist, eBird and EDDMapS | [![iNaturalist, eBird and EDDMapS](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/inat_ebird.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/inat_ebird.yml) | `data/inat_ebird.json`, `data/inat_ebird_huc10.json.gz` | Quarterly |
| Phenology and forest pests | [![Phenology and forest pests](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/phenology.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/phenology.yml) | `data/phen/` | Weekly (Mondays) |
| Historic resources | [![Historic resources](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/historic_resources.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/historic_resources.yml) | `data/historic_resources.json`, `data/place_names.json` | Monthly |
| Place names | [![Place names](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/place_names.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/place_names.yml) | `data/place_names.json` | On demand |
| Geology | [![Geology](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/geology.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/geology.yml) | `data/geology.json`, `data/geology_huc10.json` | Yearly (January) |
| Weather | [![Weather](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/weather.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/weather.yml) | `data/weather.json`, `data/weather_huc10.json` | Yearly (January); storm events quarterly |
| Trail slope | [![Trail slope](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/trailslope.yml/badge.svg)](https://github.com/Creese333/AT-Resource-Grid/actions/workflows/trailslope.yml) | `data/trail_slope.json`, `data/trail_slope_huc10.json` | Yearly (February) |

The vegetation, soils, wetlands, facilities, land administration and rare species summaries are built in ArcGIS Pro and stored in `index.html` and `data/soils_wetlands_huc10.json`.

## Data sources

| Topic | Source |
|---|---|
| Species records | iNaturalist research-grade observations and the eBird Observation Dataset (via GBIF); EDDMapS |
| Flowering and forest pests | iNaturalist (weekly); EDDMapS |
| Vegetation | APPA vegetation map; NLCD |
| Soils | NRCS gSSURGO |
| Wetlands | USFWS National Wetlands Inventory |
| Geology | USGS State Geologic Map Compilation; NPS Geologic Resources Inventory map footprints |
| Historic resources | NPS National Register of Historic Places; cemeteries from OpenStreetMap |
| Place names | USGS Geographic Names Information System |
| Weather and climate | PRISM 1991–2020 normals (Oregon State University); NOAA nClimGrid-Daily, Atlas 14 and Storm Events; gridMET wind (University of Idaho, research data) |
| Trail slope | A.T. centerline with USGS 3DEP elevation |
| Land, facilities, rare species | NPS APPA and ATC data |

Full citations, methods and caveats are under **About the data** on the dashboard.

## Repository layout

```
index.html          the dashboard (GitHub Pages serves it at grid.trailassessment.org; see CNAME)
data/               files the dashboard loads, written by the workflows
  phen/             flowering and forest pest records, one file per species
scripts/            the build scripts the workflows run (build_*.py)
inputs/             tables kept by hand that the builds read: bird guilds, invasive and cultural plant lists,
                    geologic map footprints; put at_centerline.zip here to override the trail line for Trail slope
cache/              kept between runs so later builds can reuse them; the dashboard never loads these
tools/              stand-alone helper pages (phenology checks)
images/             screenshots for this page
.github/workflows/  the scheduled builds
```

To run a build on your own computer, from the repository folder: `pip install geopandas pyogrio shapely pyproj rasterio xarray netCDF4`, then for example `python scripts/build_weather.py`. The iNaturalist and eBird build needs a GBIF account in the `GBIF_USER` and `GBIF_PWD` environment variables (repository secrets on GitHub).
