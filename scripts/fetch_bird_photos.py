"""Downloads the bird profile photos listed in inputs/bird_photos.csv and saves each as
images/birds/<species-key>.webp (800 px wide, for the cards on "When are birds migrating here?").
Rows with no link are skipped. A Flickr page link is skipped too (download that one by hand).
Existing webp files are kept unless the workflow is run with "redo"."""
import csv, io, os, sys, urllib.request
from PIL import Image

OUT = 'images/birds'
redo = len(sys.argv) > 1 and sys.argv[1] == 'redo'
os.makedirs(OUT, exist_ok=True)
ok, bad = [], []
for r in csv.DictReader(open('inputs/bird_photos.csv', newline='', encoding='utf-8')):
    url, key = (r.get('download_from') or '').strip(), r['save_as'].rsplit('.', 1)[0]
    dst = f'{OUT}/{key}.webp'
    if not url or 'flickr.com/photos' in url:
        continue
    if os.path.exists(dst) and not redo:
        continue
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AT-Resource-Grid photo fetch (github action)'})
        im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGB')
        if im.width > 800:
            im = im.resize((800, round(im.height * 800 / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=80, method=6)
        ok.append(key)
    except Exception as e:
        bad.append(f'{key}: {e}')
print(f'saved {len(ok)}:', ', '.join(ok))
if bad:
    print('failed:\n  ' + '\n  '.join(bad))
