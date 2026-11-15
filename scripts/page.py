"""Reads the dashboard page for the build scripts.
The page is split into index.html, data/grid.json (the grid), data/inat.js and data/app.js (the code). This puts them back
together as one text, the way index.html used to hold them, so the scripts read the grid and the species lists as before."""
import os

def read_page(index):
    h = open(index, encoding='utf-8').read()
    if '<script id="payload"' in h:          # the one-file page
        return h
    d = os.path.join(os.path.dirname(index), 'data')
    part = lambda f: open(os.path.join(d, f), encoding='utf-8').read()
    joined = ('<script id="payload" type="application/json">' + part('grid.json') + '</script>\n<script>' + part('inat.js') +
              '</script>\n<script>' + part('app.js') + '</script>\n')
    at = h.find('<script>\n/* loads the grid data and the app')   # where the loader stands in for them
    return h[:at] + joined + h[at:] if at >= 0 else h + joined
