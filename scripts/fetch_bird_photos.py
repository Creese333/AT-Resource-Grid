"""Downloads the bird profile photos listed in inputs/bird_photos.csv and saves each as
images/birds/<species-key>.webp (800 px wide), for the cards on "When are birds migrating here?".
Also writes images/birds/credits.json (photographer, license, source page) for the card's photo credit.

download_from can be:
  a direct image link (federal photos)   -> uses the credit and license columns
  inat                                   -> the species' iNaturalist featured photo, or its next photo, that is CC BY, CC0 or public domain
  inat:<photo id>                        -> that iNaturalist photo (it must be CC BY, CC0 or public domain)
  blank                                  -> no photo (the card shows "Photo wanted")
Existing photos are kept unless the workflow is run with "redo"."""
import csv, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

OUT = 'images/birds'
CRED = f'{OUT}/credits.json'
OPEN = {'cc-by': 'CC BY', 'cc0': 'CC0', 'pd': 'Public domain'}
redo = len(sys.argv) > 1 and sys.argv[1] == 'redo'
os.makedirs(OUT, exist_ok=True)
credits = json.load(open(CRED)) if os.path.exists(CRED) else {}
UA = {'User-Agent': 'AT-Resource-Grid bird photos (github.com/Creese333/AT-Resource-Grid)'}

def get(url, raw=False):
    time.sleep(1)                                   # stay well inside iNaturalist's rate limit
    b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
    return b if raw else json.loads(b)

def who(p):
    a = p.get('attribution') or ''
    m = re.match(r'\(c\)\s*([^,]+),', a)
    return (m.group(1) if m else a.split(',')[0]).strip() or 'iNaturalist user'

def inat_pick(sci, pid):
    if pid:
        p = get(f'https://api.inaturalist.org/v1/photos/{pid}')['results'][0]
        if p.get('license_code') not in OPEN:
            raise ValueError(f'photo {pid} is {p.get("license_code")}, not CC BY/CC0')
        return p
    t = get('https://api.inaturalist.org/v1/taxa?' + urllib.parse.urlencode({'q': sci, 'rank': 'species', 'per_page': 5}))['results']
    t = next((x for x in t if x['name'].lower() == sci.lower()), t[0] if t else None)
    if not t:
        raise ValueError('species not found on iNaturalist')
    full = get(f'https://api.inaturalist.org/v1/taxa/{t["id"]}')['results'][0]
    cands = ([full['default_photo']] if full.get('default_photo') else []) + [tp['photo'] for tp in full.get('taxon_photos', [])]
    for p in cands:
        if p.get('license_code') in OPEN:
            return p
    raise ValueError('no CC BY / CC0 photo among its featured photos')

def save(img_bytes, dst):
    im = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    if im.width > 800:
        im = im.resize((800, round(im.height * 800 / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=80, method=6)

ok, bad = [], []
for r in csv.DictReader(open('inputs/bird_photos.csv', newline='', encoding='utf-8')):
    key = r['save_as'].rsplit('.', 1)[0]
    src = (r.get('download_from') or '').strip()
    dst = f'{OUT}/{key}.webp'
    if not src:
        continue
    if os.path.exists(dst) and key in credits and credits[key].get('src_in') == src and not redo:
        continue
    try:
        if src.startswith('inat'):
            p = inat_pick(r['species_sci'], src.split(':', 1)[1] if ':' in src else '')
            save(get(p['url'].replace('/square.', '/large.'), raw=True), dst)
            credits[key] = {'cr': f'{who(p)} / iNaturalist', 'lic': OPEN[p['license_code']],
                            'page': f'https://www.inaturalist.org/photos/{p["id"]}', 'src_in': src}
        else:
            save(get(src, raw=True), dst)
            credits[key] = {'cr': r['credit'], 'lic': r['license'], 'page': src, 'src_in': src}
        ok.append(key)
    except Exception as e:
        bad.append(f'{key}: {e}')
json.dump(credits, open(CRED, 'w'), indent=1, ensure_ascii=False)
print(f'saved {len(ok)}:', ', '.join(ok))
if bad:
    print('failed:\n  ' + '\n  '.join(bad))
