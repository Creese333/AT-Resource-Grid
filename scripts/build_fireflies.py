"""Builds data/fireflies.json: every iNaturalist firefly record (family Lampyridae) in the trail's iNaturalist project
(appalachian-national-scenic-trail-huc10, the HUC10 watersheds along the A.T.), sorted onto the firefly species checklist
(Firefly_species_checklist-2024-updates: 181 species of the US and Canada, with their recent synonyms).

Fireflies are often identified only to genus, so the file keeps every record, at whatever level it was identified:
  taxa   the names records are filed under, one entry each:
         {"n": name, "r": "species" | "genus" | "family" | ..., "c": common name, "ck": 1 when the name is on the checklist,
          "k": records, "rg": research-grade records}
         A record is filed under its checklist name: a synonym (an Ellychnia name, say) goes to the checklist species it
         belongs to, and a subspecies to its species unless the checklist lists the subspecies itself.
  pts    the records: [day of year, year, taxa index, lat, lon, iNaturalist id, 1 research grade / 0 needs ID]
  notes  species names iNaturalist used that are not on the checklist (each kept as its own taxon, "ck": 0)
Records with obscured or private locations are left out, as on the dashboard; casual records are left out too.

Standard library only. Run:  python scripts/build_fireflies.py
A test server can stand in for iNaturalist: INAT_API=http://localhost:8800 python scripts/build_fireflies.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
HERE = os.path.dirname(SCRIPTS)
OUT = os.path.join(HERE, 'data', 'fireflies.json')
API = os.environ.get('INAT_API', 'https://api.inaturalist.org')
PAUSE = float(os.environ.get('INAT_PAUSE', '1.1'))   # iNaturalist asks for about one request a second
PROJECT = os.environ.get('INAT_PROJECT', 'appalachian-national-scenic-trail-huc10')
UA = 'AT-Resource-Grid firefly build (github.com/Creese333/AT-Resource-Grid)'
FIELDS = ('(id:!t,observed_on:!t,quality_grade:!t,obscured:!t,geoprivacy:!t,taxon_geoprivacy:!t,geojson:all,'
          'taxon:(id:!t,name:!t,rank:!t,preferred_common_name:!t,ancestor_ids:!t))')

# The firefly species checklist (Firefly_species_checklist-2024-updates.xlsx): name, recent synonyms
CHECKLIST = [
    ("Aspisoma ignitum", []),
    ("Aspisoma quasidiaphanum", ["Aspisoma quasidiaphana"]),
    ("Bicellonycha wickershamorum", []),
    ("Bicellonycha wickershamorum piceum", []),
    ("Bicellonycha wickershamorum wickershamorum", []),
    ("Brachylampis blaisdelli", []),
    ("Brachylampis sanguinicollis", []),
    ("Chespirito milleri", []),
    ("Lucidota atra", []),
    ("Lucidota luteicollis", []),
    ("Lucidota punctata", []),
    ("Micronaspis floridana", []),
    ("Microphotus angustus", []),
    ("Microphotus chiricahuae", []),
    ("Microphotus dilatatus", []),
    ("Microphotus fragilis", []),
    ("Microphotus octarthrus", []),
    ("Microphotus pecosensis", []),
    ("Nelsonphotus aridus", []),
    ("Paraphausis eximius", []),
    ("Phausis branhami", []),
    ("Phausis californica", []),
    ("Phausis christineae", []),
    ("Phausis dorothae", []),
    ("Phausis inaccensa", []),
    ("Phausis luminosa", []),
    ("Phausis marina", []),
    ("Phausis milleri", []),
    ("Phausis nigra", []),
    ("Phausis reticulata", []),
    ("Phausis rhombica", []),
    ("Phausis riversi", []),
    ("Phausis skelleyi", []),
    ("Photinus acuminatus", []),
    ("Photinus alexanderi", ["Ellychnia alexanderi"]),
    ("Photinus aquilonius", []),
    ("Photinus ardens", []),
    ("Photinus arizonensis", []),
    ("Photinus australis", []),
    ("Photinus autumnalis", ["Ellychnia autumnalis"]),
    ("Photinus bivulnerus", ["Ellychnia bivulnerus"]),
    ("Photinus brimleyi", []),
    ("Photinus californicus", ["Ellychnia californica", "Photinus californica"]),
    ("Photinus captiosus", ["Ellychnia captiosa", "Photinus captiosa"]),
    ("Photinus carolinus", []),
    ("Photinus collustrans", []),
    ("Photinus concisus", []),
    ("Photinus consanguineus", []),
    ("Photinus consimilis", []),
    ("Photinus cookii", []),
    ("Photinus corruscus", ["Ellychnia corrusca", "Photinus corrusca"]),
    ("Photinus curtatus", []),
    ("Photinus dimissus", []),
    ("Photinus faculus", ["Ellychnia facula", "Photinus facula"]),
    ("Photinus fenderi", ["Ellychnia obscurevittatus"]),
    ("Photinus flavicollis", ["Ellychnia flavicollis"]),
    ("Photinus floridanus", []),
    ("Photinus frosti", []),
    ("Photinus granulatus", []),
    ("Photinus granulicollis", ["Ellychnia granulicollis"]),
    ("Photinus greeni", ["Ellychnia greeni"]),
    ("Photinus hatchi", ["Ellychnia hatchi"]),
    ("Photinus ignitus", []),
    ("Photinus immaculatus", []),
    ("Photinus indictus", []),
    ("Photinus irroratus", ["Ellychnia irrorota"]),
    ("Photinus jamesi", ["Photinus greeni"]),
    ("Photinus knulli", []),
    ("Photinus lacustris", ["Ellychnia lacustris"]),
    ("Photinus lawrencei", ["Ellychnia simplex", "Pyropyga simplex"]),
    ("Photinus lineellus", []),
    ("Photinus macdermotti", []),
    ("Photinus marginellus", []),
    ("Photinus megistus", ["Ellychnia megista"]),
    ("Photinus obscurellus", []),
    ("Photinus punctulatus", []),
    ("Photinus pyralis", []),
    ("Photinus sabulosus", []),
    ("Photinus scintillans", []),
    ("Photinus stellaris", []),
    ("Photinus tanytoxus", []),
    ("Photinus tenuicinctus", []),
    ("Photinus texanus", []),
    ("Photinus umbratus", []),
    ("Photuris alexanderi", []),
    ("Photuris alleganiensis", []),
    ("Photuris anna", []),
    ("Photuris appalachianensis", []),
    ("Photuris asacoa", []),
    ("Photuris aureolucens", []),
    ("Photuris barberi", []),
    ("Photuris beanii", []),
    ("Photuris bethaniensis", []),
    ("Photuris billbrowni", []),
    ("Photuris branhami", []),
    ("Photuris bridgeniensis", []),
    ("Photuris caerulucens", []),
    ("Photuris campestra", []),
    ("Photuris carrorum", []),
    ("Photuris chenangoa", []),
    ("Photuris cinctipennis", []),
    ("Photuris congener", []),
    ("Photuris cowaseloniensis", []),
    ("Photuris darwini", []),
    ("Photuris divisa", []),
    ("Photuris dorothae", []),
    ("Photuris douglasae", []),
    ("Photuris eliza", []),
    ("Photuris eureka", []),
    ("Photuris fairchildi", []),
    ("Photuris falli", ["Photuris flavicollis", "Photuris brunipennis falli"]),
    ("Photuris figuramuto", []),
    ("Photuris floridana", ["Photuris brunnipennis floridana"]),
    ("Photuris forresti", []),
    ("Photuris frontalis", []),
    ("Photuris gentrae", []),
    ("Photuris harrannorum", []),
    ("Photuris hebes", []),
    ("Photuris hiawasseensis", []),
    ("Photuris katrinae", []),
    ("Photuris lamarcki", []),
    ("Photuris lineaticollis", []),
    ("Photuris lloydi", []),
    ("Photuris lucicrescens", []),
    ("Photuris lynfaustae", []),
    ("Photuris maicoi", []),
    ("Photuris margotooleae", []),
    ("Photuris mcavoyi", []),
    ("Photuris missouriensis", []),
    ("Photuris moorei", []),
    ("Photuris mysticalampas", []),
    ("Photuris paludivulpes", []),
    ("Photuris patriei", []),
    ("Photuris pensylvanica", []),
    ("Photuris polacekae", []),
    ("Photuris potomaca", []),
    ("Photuris pyralomima", []),
    ("Photuris quadrifulgens", []),
    ("Photuris salina", ["Photuris salinus"]),
    ("Photuris sellicki", []),
    ("Photuris sheckscheri", []),
    ("Photuris sivinskii", []),
    ("Photuris stanleyi", []),
    ("Photuris stevensae", []),
    ("Photuris tasunkowitcoi", []),
    ("Photuris tremulans", []),
    ("Photuris versicolor", []),
    ("Photuris walkeri", []),
    ("Photuris walldoxeyi", []),
    ("Photuris whistlerae", []),
    ("Photuris witmeri", []),
    ("Pleotomodes knulli", []),
    ("Pleotomodes needhami", []),
    ("Pleotomus davisii", []),
    ("Pleotomus nigripennis", []),
    ("Pleotomus pallens", []),
    ("Pollaclasis bifaria", []),
    ("Prolutacea pulsator", []),
    ("Pterotus curticornis", []),
    ("Pterotus obscuripennis", []),
    ("Pyractomena angulata", []),
    ("Pyractomena angustata", []),
    ("Pyractomena barberi", []),
    ("Pyractomena borealis", []),
    ("Pyractomena dispersa", []),
    ("Pyractomena ecostata", []),
    ("Pyractomena floridana", []),
    ("Pyractomena limbicollis", []),
    ("Pyractomena linearis", []),
    ("Pyractomena lucifera", []),
    ("Pyractomena marginalis", []),
    ("Pyractomena palustris", []),
    ("Pyractomena punctiventris", []),
    ("Pyractomena similis", []),
    ("Pyractomena sinuata", []),
    ("Pyractomena vexillaria", []),
    ("Pyropyga decipiens", []),
    ("Pyropyga minuta", []),
    ("Pyropyga modesta", []),
    ("Pyropyga nigricans", []),
    ("Tenaspis angularis", []),
]

_last = [0.0]
def get(path, params):
    """GET a JSON page from the iNaturalist API, politely paced, with a few retries."""
    url = API + path + '?' + urllib.parse.urlencode(params, safe='(),:!')
    for attempt in range(6):
        wait = PAUSE - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            if getattr(e, 'code', None) in (400, 404, 422): raise
            print(f'  retry {attempt + 1} after {e}', flush=True)
            time.sleep(min(60, 5 * 2 ** attempt))
    raise RuntimeError('iNaturalist did not answer: ' + url)

def family_id():
    res = get('/v1/taxa', {'q': 'Lampyridae', 'rank': 'family', 'per_page': 10}).get('results', [])
    t = next((x for x in res if (x.get('name') or '') == 'Lampyridae'), None)
    if not t: raise RuntimeError('iNaturalist has no family named Lampyridae')
    return t['id']

def norm(n):
    return ' '.join(re.sub(r'\b(var|subsp|ssp)\.\s*', '', n or '').split()).lower()

def lookup():
    """name (lower case) -> the checklist name it is filed under. Checklist names win over synonyms: a name that is both
    (Photinus greeni is a species on the list and a synonym of Photinus jamesi) stays its own species."""
    own = {norm(n): n for n, _ in CHECKLIST}
    syn = {}
    for n, ss in CHECKLIST:
        for s in ss:
            k = norm(s)
            if k not in own: syn.setdefault(k, n)
    return own, syn

def file_under(t, own, syn):
    """(name, rank, on the checklist) for a record's taxon"""
    name, rank = t.get('name') or '', t.get('rank') or ''
    k = norm(name)
    if k in own: return own[k], rank if rank in ('species', 'subspecies') else 'species', 1
    if k in syn: return syn[k], 'species', 1
    if rank in ('subspecies', 'variety', 'form'):
        b = ' '.join(k.split()[:2])
        if b in own: return own[b], 'species', 1
        if b in syn: return syn[b], 'species', 1
        return ' '.join(name.split()[:2]), 'species', 0
    return name, rank, 0

def keep(o):
    """[lat, lon] for a record with an open location, else None (the dashboard's rule)"""
    if o.get('obscured') or o.get('geoprivacy') in ('obscured', 'private') or o.get('taxon_geoprivacy') in ('obscured', 'private'): return None
    c = (o.get('geojson') or {}).get('coordinates')
    return [round(float(c[1]), 5), round(float(c[0]), 5)] if c else None

def doy(d):
    try: return datetime.strptime(d[:10], '%Y-%m-%d').timetuple().tm_yday
    except Exception: return None

V2 = [True]
def page(base, above):
    p = dict(base, order_by='id', order='asc', per_page=200, id_above=above)
    if V2[0]:
        try:
            j = get('/v2/observations', dict(p, fields=FIELDS))
            if not any('taxon' not in o or 'observed_on' not in o for o in j.get('results', [])): return j
        except Exception as e:
            print('  v2 API failed, using v1:', e)
        V2[0] = False
    return get('/v1/observations', p)

def main():
    fam = family_id(); own, syn = lookup()
    print(f'Fireflies (Lampyridae, taxon {fam}) in the {PROJECT} project; checklist of {len(CHECKLIST)} species', flush=True)
    taxa, tix, pts, drop = [], {}, [], {'hidden or no location': 0, 'no date': 0}
    for grade in ('research', 'needs_id'):
        above, n0 = 0, len(pts)
        for _ in range(2000):
            j = page({'taxon_id': fam, 'project_id': PROJECT, 'quality_grade': grade}, above)
            res = j.get('results', [])
            for o in res:
                ll, d = keep(o), doy(o.get('observed_on') or '')
                if not ll: drop['hidden or no location'] += 1; continue
                if not d: drop['no date'] += 1; continue
                t = o.get('taxon') or {}
                name, rank, ck = file_under(t, own, syn)
                if name not in tix:
                    tix[name] = len(taxa)
                    taxa.append({'n': name, 'r': rank, 'c': (t.get('preferred_common_name') or '') if norm(t.get('name')) == norm(name) else '', 'ck': ck, 'k': 0, 'rg': 0})
                e = taxa[tix[name]]; e['k'] += 1; e['rg'] += grade == 'research'
                if not e['c'] and (norm(t.get('name')) == norm(name) or (ck and rank == 'species')): e['c'] = t.get('preferred_common_name') or ''   # a synonym's record carries the species' common name
                pts.append([d, int(str(o['observed_on'])[:4]), tix[name], ll[0], ll[1], o['id'], 1 if grade == 'research' else 0])
            if res: above = res[-1]['id']
            if len(res) < 200: break
        print(f'  {grade}: {len(pts) - n0} records kept', flush=True)
    # common names for checklist species that came in only under a synonym
    for e in taxa:
        if e['ck'] and not e['c'] and e['r'] == 'species':
            try:
                res = get('/v1/taxa', {'q': e['n'], 'per_page': 5}).get('results', [])
                t = next((x for x in res if norm(x.get('name')) == norm(e['n'])), None)
                if t: e['c'] = t.get('preferred_common_name') or ''
            except Exception: pass
    notes = sorted(e['n'] for e in taxa if e['r'] == 'species' and not e['ck'])
    sp = [e for e in taxa if e['r'] in ('species', 'subspecies')]
    out = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'project': PROJECT, 'family': fam,
           'checklist': len(CHECKLIST), 'taxa': taxa, 'drop': drop, 'notes': notes, 'pts': pts}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(out, f, separators=(',', ':'))
    print(f'{len(pts):,} records; {len(sp)} species ({sum(e["ck"] for e in sp)} on the checklist); '
          f'{sum(e["k"] for e in taxa if e["r"] not in ("species", "subspecies")):,} records identified above species', flush=True)
    for e in sorted(taxa, key=lambda e: -e['k']): print(f"  {e['k']:6,}  {e['n']} ({e['r']}){'' if e['ck'] or e['r'] != 'species' else '  NOT ON THE CHECKLIST'}")
    if notes: print('Species not on the checklist:', ', '.join(notes))

if __name__ == '__main__':
    main()
