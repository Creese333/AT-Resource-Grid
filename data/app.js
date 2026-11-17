
(function(){
'use strict';
const D = JSON.parse(window.__GRID);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (v, d) => v == null ? '–' : Number(v).toLocaleString('en-US', {maximumFractionDigits: d == null ? (Math.abs(v) < 10 && v % 1 ? 1 : 0) : d});
const nCells = n => `${fmt(n, 0)} ${n === 1 ? 'cell' : 'cells'}`;
document.querySelectorAll('.run').forEach(e => e.textContent = D.run);

/* ---------- data access ---------- */
const LV = {wheel:{name:'49 sq mi', acres:31360}, cog:{name:'7 sq mi', acres:4480}, hex:{name:'1 sq mi', acres:640}};
const HISTTH = () => ({hex:{ix:[], f:{}}, cog:{ix:[], f:{}}, wheel:{ix:[], f:{}}});
const ROW = {}; if (!D.themes.edd) D.themes.edd = {}; if (!D.themes.hist) D.themes.hist = HISTTH();
for (const th in D.themes){ ROW[th] = {};
  for (const lv in D.themes[th]){ const a = new Int32Array(D.levels[lv].id.length).fill(-1);
    D.themes[th][lv].ix.forEach((c,k) => a[c] = k); ROW[th][lv] = a; } }
const IDX = {}; for (const lv in D.levels){ const m = new Map(); D.levels[lv].id.forEach((id,i) => m.set(id,i)); IDX[lv] = m; }
/* layout viewport: steady while pinch-zooming and as phone toolbars slide in and out */
function VW(){ return document.documentElement.clientWidth || window.innerWidth; }
function VH(){ return document.documentElement.clientHeight || window.innerHeight; }
function val(th, f, lv, c){ const t = D.themes[th] && D.themes[th][lv]; if (!t) return null; const R = ROW[th] && ROW[th][lv], r = R ? R[c] : -1; if (!(r >= 0)) return null; const a = t.f[f]; if (!a) return null; const x = a[r]; return (x == null || x === -1) ? null : x; }
const has = (th, lv, c) => !!(D.themes[th] && D.themes[th][lv] && ROW[th] && ROW[th][lv]) && ROW[th][lv][c] >= 0;
const cat = (name, i) => i == null ? null : D.cats[name][i];
function regionOf(mi){ for (const r of D.regions) if (mi <= r[2]) return r[0]; return D.regions[D.regions.length-1][0]; }
const shortClub = s => s.replace('Appalachian Trail Club','A.T. Club').replace('Appalachian Mountain Club','AMC');

/* ---------- colors ---------- */
const RAMP = {
  land:['#38A3FF','#3D7BF5','#5A5CEB','#7A44DB','#9430C9'],
  veg:['#D1EAE6','#A3D5CD','#6FBDB0','#3FA796','#26645A'],
  inv:['#FEE3C8','#FDB97A','#FA8E33','#E86A0A','#A34600'],
  rec:['#DDF3EA','#B0E2CC','#79C9A8','#3E9F7E','#1B6A51'],
  eff:['#EDBFD3','#DD8FB3','#C95F92','#A83A70','#6B1F45'],
  bird:['#D3E7F6','#A3CDEE','#62A9E0','#1E7FC6','#11507F'],
  pri:['#E7DBF2','#CFB8E5','#B490D6','#9B6BC8','#5D4078'],
  soil:['#EAD7C0','#C9A27A','#9C6B3E','#6E4421','#3F230E'],
  feat:['#2E9A3E','#227E33','#196629','#114F20','#0A3816'],
  wet:['#D2F1F7','#9EE0EE','#5CC8DF','#1FA9C9','#0E6680'],
  rest:['#A8E6DC','#4FB3A6','#F0A8A0','#C8323F','#8E1430'],
  phen:['#FFF06A','#FFE014','#F2C200','#C99A00','#8A6800'],
  hist:['#5F9EA1','#3F7A6B','#D2691E','#B0521A','#8B4513'],
  cult:['#0F7173','#2B3A42','#2C4A3E','#C19A6A','#D32F2F'],
  geo:['#E1E6EA','#B9C4CE','#8C9DAD','#5F7488','#38495B'],
  wx:['#DDEAF5','#A9C8E4','#6FA0CF','#3F76AE','#1F4E80'],
  tvul:['#4D9BFF','#5C74F2','#7357E3','#9140D2','#B02DC2']
};
const ZERO = '#E3E7E1';
const CATCOL = {
  LEGEND2_DOM:[['Federal Land - USFS','#4E7F55','US Forest Service'],['Federal Land - NPS - APPA','#7A4A26','NPS, Appalachian Trail'],['Federal Land - NPS - Other','#B98D5E','NPS, other park units'],
    ['Federal Land - Other','#8A8F99','Other federal'],['State Land','#3F7CAC','State'],['Conservation Land','#9CC27A','Conservation land'],['Tribal Land','#A8527A','Tribal'],['Town Land','#DDAE45','Town'],['Private Land','#C9C3B4','Private']],
  APPA_LAND_DOM:[['NPS APPA Fee Land','#7A4A26'],['NPS APPA Easement','#C49A6C'],['A.T. Management Corridor','#3F7CAC'],['USFS Administratively Transferred Lands','#4E7F55'],
    ['SHEN Administratively Transferred Lands','#8FB58A'],['BLRI Administratively Transferred Lands','#B8D3A6'],['Private Land','#DDAE45'],['Other','#D9DDD6','Other partner lands']],
  L2_DOM:[['Open Water','#466B9F'],['Developed, Open Space','#DEC5C5'],['Developed, Low Intensity','#D99282'],['Developed, Medium Intensity','#EB0000'],['Developed, High Intensity','#AB0000'],
    ['Barren Land','#B3AC9F'],['Deciduous Forest','#68AB5F'],['Evergreen Forest','#1C5F2C'],['Mixed Forest','#B5C58F'],['Shrub/Scrub','#CCB879'],['Grassland/Herbaceous','#DFDFC2'],
    ['Pasture/Hay','#DCD939'],['Cultivated Crops','#AB6C28'],['Woody Wetlands','#B8D9EB'],['Emergent Herbaceous Wetlands','#6C9FB8'],['Unassigned','#ECEFEA']],
  VULN_DOM:[['Low','#E3C9A6','Low'],['Moderate','#CDA373','Moderate'],['High','#6A4423','High']],
  review_tie:[['Avoid','#9E2B4E','Very highly sensitive populations'],['Minimize','#E5892B','Highly sensitive populations'],['Standard Review','#F2D94A','Moderately sensitive populations']]
};
const L2 = [[11,'Open Water'],[21,'Developed, Open Space'],[22,'Developed, Low Intensity'],[23,'Developed, Medium Intensity'],[24,'Developed, High Intensity'],[31,'Barren Land'],[41,'Deciduous Forest'],[42,'Evergreen Forest'],[43,'Mixed Forest'],[52,'Shrub/Scrub'],[71,'Grassland/Herbaceous'],[81,'Pasture/Hay'],[82,'Cultivated Crops'],[90,'Woody Wetlands'],[95,'Emergent Herbaceous Wetlands']]
  .map(x => ['L2_' + x[0], x[1], CATCOL.L2_DOM.find(e => e[0] === x[1])[1]]);
function shade(hex, f, dh){ let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let h = 0, s = 0, l = (mx+mn)/2; const d = mx - mn;
  if (d){ s = l > .5 ? d/(2-mx-mn) : d/(mx+mn); h = mx === r ? ((g-b)/d + (g < b ? 6 : 0)) : mx === g ? (b-r)/d + 2 : (r-g)/d + 4; h *= 60; }
  l = Math.max(.14, Math.min(.76, l + f - .09)); h = (h + dh + 360) % 360; s = Math.min(1, s * 1.1 + .05);
  return `hsl(${h.toFixed(0)},${(s*100).toFixed(0)}%,${(l*100).toFixed(0)}%)`; }
(function(){ const fam = {}; D.cats.DOM_TYPE.forEach((n,i) => (fam[D.typeL2[i]] = fam[D.typeL2[i]] || []).push(n));
  const col = {}; for (const f in fam){ const base = (CATCOL.L2_DOM.find(e => e[0] === f) || [0,'#BBBBBB'])[1], a = fam[f].sort(), n = a.length;
    a.forEach((name,k) => col[name] = shade(base, n === 1 ? 0 : (k/(n-1) - .5) * .42, ((k % 3) - 1) * 14)); }
  CATCOL.DOM_TYPE = D.cats.DOM_TYPE.map(n => [n, col[n]]); })();
/* NWI's own wetland type colors */
CATCOL.WET_DOM = [['Freshwater Forested/Shrub Wetland','#008837'],['Freshwater Emergent Wetland','#7FC31C'],['Freshwater Pond','#688CC0'],['Lake','#13007C'],
  ['Riverine','#0190BF'],['Estuarine and Marine Wetland','#66C2A5'],['Estuarine and Marine Deepwater','#007C88'],['Other','#B28653']];
CATCOL.WET_LDOM = CATCOL.WET_DOM;
const FINDCOL = '#FFC233'; CATCOL.FIND = [['Recorded here', FINDCOL]]; D.cats.FIND = ['Recorded here'];
CATCOL.APPA_YN = [['NPS - APPA land', '#1C58A8']]; D.cats.APPA_YN = ['NPS - APPA land'];
/* geology categories: the names are fixed in build_geology.py, in this order */
CATCOL.GEO_LITH = [['Carbonate rock (limestone, dolostone, marble)','#4A90C2'],['Mafic and ultramafic rock','#2F7D4E'],['Volcanic and metavolcanic rock','#B5453A'],
  ['Gneiss','#8E6BB8'],['Schist','#C08BC4'],['Granite and other intrusive rock','#E39AA0'],['Shale, slate and phyllite','#7F8C8D'],
  ['Sandstone, quartzite and conglomerate','#D8B66A'],['Unconsolidated deposits','#F2E6A0'],['Other sedimentary rock','#B9A27C'],['Other metamorphic rock','#9C8FA8'],
  ['Water','#9CC9E8'],['Other or undivided','#CFCFCF']];
CATCOL.GEO_AGE = [['Precambrian (Proterozoic or older)','#9E3D5E'],['Cambrian','#7FA056'],['Ordovician','#2E9C83'],['Silurian','#9FD3B4'],['Devonian','#C79A5B'],
  ['Mississippian','#6E86A6'],['Pennsylvanian','#93AFC2'],['Permian','#E07B53'],['Triassic or Jurassic','#A86ABD'],['Cretaceous to Neogene','#D9C24A'],['Quaternary','#F4EFB0'],['Unknown','#CFCFCF']];
CATCOL.MAP_BEST = [['1:24,000 or more detailed','#38495B'],['1:25,000 to 1:62,500','#5F7488'],['1:100,000','#9AA9B8'],['Regional or statewide only','#DCE2E8']];
CATCOL.SURF = [['Detailed surficial map (1:24,000 or more detailed)','#38495B','Detailed (1:24,000 or more detailed)'],['Regional surficial map','#8C9DAD','Regional'],['No surficial map','#DCE2E8','None']];
CATCOL.GIS_BEST = [['GIS data at 1:24,000 or more detailed','#38495B','1:24,000 or more detailed'],['GIS data at 1:25,000 to 1:100,000','#6E8296','1:25,000 to 1:100,000'],['Statewide GIS data only','#AEBBC8','Statewide only'],['No GIS data','#E6E9EC','None']];
CATCOL.GEO_NEWEST = [['2010 or later','#38495B'],['1990 to 2009','#6E8296'],['1970 to 1989','#AEBBC8'],['Before 1970','#E6E9EC']];
['GEO_LITH','GEO_AGE','MAP_BEST','SURF','GIS_BEST','GEO_NEWEST'].forEach(k => { D.cats[k] = CATCOL[k].map(e => e[0]); });
CATCOL.VIS_PEAK = [['January','#3E5C8A'],['February','#5175A8'],['March','#6FA8A0'],['April','#7DBF5E'],['May','#A8CF45'],['June','#E3D33B'],['July','#F2B233'],['August','#EE8F2E'],['September','#D9662B'],['October','#B8472E'],['November','#8C4A5E'],['December','#4B4F7A']];
D.cats.VIS_PEAK = CATCOL.VIS_PEAK.map(e => e[0]);
CATCOL.WX_WETM = [['January','#2F4B7C'],['February','#46669A'],['March','#6E8FBF'],['April','#3E8E7E'],['May','#6BAA75'],['June','#A3C17A'],['July','#D9B44A'],['August','#C98A3E'],['September','#B5653A'],['October','#8E4B5A'],['November','#9C7AA8'],['December','#5E5A8C']]; D.cats.WX_WETM = CATCOL.WX_WETM.map(e => e[0]);
/* trail sustainability rating, the same four colors as the trail segments */
CATCOL.TSR = [['Good','#3FA672'],['Neutral (flat)','#A7B3C2'],['Poor','#E39A3B'],['Very poor','#C8323C']]; D.cats.TSR = CATCOL.TSR.map(e => e[0]);
const CATMAP = {}; for (const k in CATCOL){ CATMAP[k] = new Map(CATCOL[k].map(e => [e[0], e])); }
/* Blue Ridge color scheme */
const HUE = {lands:'#3B82F6', veg:'#3FA796', inat:'#F57C1F', live:'#8FD3B6', ebird:'#1E7FC6', nrpz:'#9B6BC8', eff:'#B03A73', soil:'#7A4A24', feat:'#2F7A3B', wet:'#1FA9C9', rest:'#821225', phen:'#F0C419', hist:'#A08C5B', pest:'#C0502E', pinv:'#D9661A', cult:'#5E8C31', geo:'#6B7F94', wx:'#4A7FB5', tvul:'#6A4FB3', mig:'#05D16D'};
/* eBird habitat groups: each has a species count field (_SPP) and a species list field (_LIST); exports spell out the shortened label */
const BIRD_GROUPS = [['FOREST_INT','Forest interior'],['FOREST_GEN','Forest generalist'],['CONIFER','High-elev. conifer','High-elevation conifer'],['SHRUB','Shrubland'],['GRASS','Grassland'],
  ['EDGE','Edge'],['WETLAND','Wetland'],['RIPARIAN','Riparian'],['WATERBIRD','Waterbird'],['SHORE','Shorebird'],['SEABIRD','Seabird']]
  .map(g => ({spp:g[0] + '_SPP', list:g[0] + '_LIST', label:g[1], full:g[2] || g[1]}));

/* ---------- questions and measures ---------- */
/* iNaturalist and eBird species added together. Birds are counted once: the larger of the two bird counts, plus iNaturalist's non-bird species. */
/* Invasive species = invasive plants and forest pests together. Priority invasives = the priority plant list plus every forest pest.
   (The summary's own count fields cover plants only, so these are counted from the species lists.) */
const blank = x => x == null ? '' : x;
/* EDDMapS lists sit beside iNaturalist's; invL() gives a cell's list from both, each species once */
const EDDF = {INVASIVE_LIST:'EDD_INV_LIST', EDRR_LIST:'EDD_EDRR_LIST', PEST_LIST:'EDD_PEST_LIST'};
function invL(f, lv, c){ const a = val('inat', f, lv, c), b = val('edd', EDDF[f], lv, c); if (!b || !b.length) return a; if (!a || !a.length) return b; const s = new Set(a); b.forEach(i => s.add(i)); return [...s]; }
const hasInv = (lv, c) => has('inat', lv, c) || has('edd', lv, c);
function invSet(lv, c, pri){ if (!hasInv(lv, c)) return null; const s = new Set(invL(pri ? 'EDRR_LIST' : 'INVASIVE_LIST', lv, c) || []); (invL('PEST_LIST',lv,c) || []).forEach(i => s.add(i)); return s; }
/* which source reported each species in these cells: e EDDMapS, n iNaturalist */
function invSrc(lv, cells){ const e = new Set(), n = new Set();
  cells.forEach(c => { ['EDD_INV_LIST','EDD_PEST_LIST'].forEach(f => (val('edd', f, lv, c) || []).forEach(i => e.add(i))); ['INVASIVE_LIST','PEST_LIST'].forEach(f => (val('inat', f, lv, c) || []).forEach(i => n.add(i))); });
  return {e, n}; }
function srcTag(i, T){ return !T.e.has(i) ? '' : T.n.has(i) ? '<span class="tag edd" title="Reported on iNaturalist and in EDDMapS">iNat + EDDMapS</span>' : '<span class="tag edd" title="Reported in EDDMapS only">EDDMapS</span>'; }
function srcItem(i, T, ed, tail){ return sppItem(i, ed, !T.e.has(i) || T.n.has(i)).replace('</li>', srcTag(i, T) + (tail || '') + '</li>'); }
/* EDDMapS by species for these cells: reports, infested acres (each spot once, at its latest report with an area) and the latest abundance */
function eddDet(lv, cells){ const m = new Map();
  cells.forEach(c => (val('edd','EDD_SPP_DETAIL',lv,c) || []).forEach(([i, n, ac, ab, ay]) => { let e = m.get(i); if (!e) m.set(i, e = {n:0, ac:0, hasAc:false, ab:null, ay:0});
    e.n += n || 0; if (ac != null){ e.ac += ac; e.hasAc = true; } if (ab && (ay || 0) >= e.ay){ e.ab = ab; e.ay = ay || 0; } }));
  return m; }
const acFmt = v => v < 0.01 ? 'under 0.01' : fmt(v, v < 10 ? 2 : v < 100 ? 1 : 0);
function eddDetail(lv, cells){ const m = eddDet(lv, cells); if (!m.size) return '';
  const rows = [...m].sort((a, b) => b[1].ac - a[1].ac || b[1].n - a[1].n || D.spp[a[0]].localeCompare(D.spp[b[0]]));
  return `<details class="eddd" open><summary>EDDMapS by species</summary><table class="eddt"><thead><tr><th>Species</th><th class="n">Reports</th><th class="n">Infested acres</th><th>Latest abundance</th></tr></thead><tbody>` +
    rows.map(([i, e]) => { const p = sppName(i); return `<tr><td>${esc(p.common || p.sci)}</td><td class="n">${fmt(e.n, 0)}</td><td class="n">${e.hasAc ? acFmt(e.ac) : '–'}</td><td>${e.ab ? esc(e.ab) + (e.ay ? ` <span class="yr">${e.ay}</span>` : '') : '–'}</td></tr>`; }).join('') +
    `</tbody></table><p class="none" style="font-size:13px;margin-top:4px">All EDDMapS reports of each species here, including any that match iNaturalist records. Infested area is as reported, converted to acres, with each spot counted once at its latest report. Abundance is from the latest report that gave one.</p></details>`; }
/* the EDDMapS line under a cell's or a selection's invasive lists */
function eddNote(lv, cells){ let n = 0, d = 0, t = 0, last = ''; const any = cells.some(c => has('edd', lv, c));
  cells.forEach(c => { n += val('edd','N_EDD_OBS',lv,c) || 0; d += val('edd','N_EDD_DUP',lv,c) || 0; t += val('edd','N_EDD_TREATED',lv,c) || 0; const l = val('edd','EDD_LAST',lv,c); if (l && l > last) last = l; });
  if (!D.themes.edd || !D.themes.edd[lv]) return '';
  if (!any || !n && !d) return `<p class="none" style="font-size:13.5px;margin-top:8px">No EDDMapS reports of listed invasive plants or forest pests ${cells.length > 1 ? 'in the selected cells' : 'in this cell'}.</p>`;
  return `<p style="margin-top:8px"><span class="badge edd">EDDMapS</span> ${fmt(n,0)} ${n === 1 ? 'report' : 'reports'} of listed invasive plants and forest pests${t ? `, ${fmt(t,0)} with a treatment recorded` : ''}${last ? `; newest ${esc(last)}` : ''}.` +
    (d ? ` ${fmt(d,0)} more ${d === 1 ? 'matches an iNaturalist record' : 'match iNaturalist records'} (same species, within a day and 50 m) and ${d === 1 ? 'is' : 'are'} counted once, as iNaturalist.` : '') + '</p>'; }
const invCount = (lv, c) => { const s = invSet(lv, c, false); return s ? s.size : null; }, priCount = (lv, c) => { const s = invSet(lv, c, true); return s ? s.size : null; };
function invShare(lv, c){ const n = val('inat','N_OBS',lv,c); if (!n) return null; return Math.min(100, Math.round(1000 * ((val('inat','N_INV_OBS',lv,c) || 0) + (val('inat','N_PEST_OBS',lv,c) || 0)) / n) / 10); }
/* The quarterly summary's cutoff: the newest record it contains. The live section shows what has come in after it. */
/* How much of a 7 or 49 sq mi cell actually has records: the number of its 1 sq mi hexes that hold data for the layer.
   (Not available for the 1 sq mi cells themselves, since nothing finer exists.) */
const HEXIN = {cog:7, wheel:49}, COVER = {};
function cover(th, lv, c){ if (lv === 'hex' || !D.themes[th] || !D.themes[th].hex) return null; const key = th + lv; let m = COVER[key];
  if (!m){ m = COVER[key] = new Map(); const H = D.levels.hex.id, cut = lv === 'cog' ? 1 : 2;
    D.themes[th].hex.ix.forEach(h => { let p = H[h]; for (let k = 0; k < cut; k++) p = p.slice(0, p.lastIndexOf('-')); m.set(p, (m.get(p) || 0) + 1); }); }
  return m.get(D.levels[lv].id[c]) || 0; }
/* Thinly sampled: the layer's own data status is not "Adequate", or a modest number of records (under 100 checklists or records)
   sit in too few of the cell's corridor square miles: one, when a 7 sq mi cell has two or more along the corridor; fewer than
   three, when a 49 sq mi cell has three or more. Cells with only one or two corridor square miles are not marked down for it. */
const THIN_MIN = {cog:2, wheel:3}, THIN_N = 100, CORRHEX = {};
function corrHex(lv, c){ let m = CORRHEX[lv]; if (!m || m.lev !== D.levels[lv]){ m = CORRHEX[lv] = new Map(); m.lev = D.levels[lv]; const cut = lv === 'cog' ? 1 : 2;
    D.levels.hex.id.forEach(id => { let p = id; for (let k = 0; k < cut; k++) p = p.slice(0, p.lastIndexOf('-')); m.set(p, (m.get(p) || 0) + 1); }); }
  return m.get(D.levels[lv].id[c]) || 0; }
function thin(th, lv, c){ if (!D.themes[th] || !D.themes[th][lv] || ROW[th][lv][c] < 0) return false; if (cat('DATA_STATUS', val(th, 'DATA_STATUS', lv, c)) !== 'Adequate') return true;
  const k = cover(th, lv, c); if (k == null) return false;
  const n = val(th, th === 'ebird' ? 'N_CHECKLISTS' : 'N_OBS', lv, c) || 0; if (n >= THIN_N) return false;
  return k < Math.min(THIN_MIN[lv], corrHex(lv, c)); }
const sampled = m => !!m.fade && !m.fadeFn && (m.th === 'inat' || m.th === 'ebird');

/* Soils. The trail vulnerability index (0 to 1) averages three NRCS trail ratings, each turned into even steps from its best
   class (0) to its worst (1): erosion hazard on unsurfaced roads and trails, paths and trails, and rutting hazard.
   Low is under 0.33, High over 0.67. The NRCS 0 to 1 scores behind the classes are kept as a second figure (NRCS_IDX).
   Unrated soils are blank, never zero. */
const vulnClass = v => v == null ? null : v > 0.67 ? 'High' : v >= 0.33 ? 'Moderate' : 'Low';
const vulnShow = v => `${fmt(v, 2)} (${vulnClass(v)})`;
/* ---------- seasons: flowering, fruiting, and beech leaf disease ----------
   Research-grade iNaturalist records from the trail's project. Plants: records annotated "Flowers and Fruits" = flower buds
   or flowers. Emerald ash borer: all records, and those annotated "Life Stage" = adult. Beech leaf disease: all records.
   They load from iNaturalist the first time a species is picked, are kept in this browser for 30 days, and are placed in the grid
   cells. Records with obscured locations are left out. Weeks run from January 1 (week 1 = Jan 1 to 7).
   Stages: 1 flowers, 2 fruits, 3 flower buds, 4 adults, 5 any record.
   The measures follow the National Phenology Network's phenometrics, adapted to records that only say "seen in flower":
   onset (first), peak and end of the season and its length, the share of records in each phase by week (the Network's
   "proportion of yes records"), and how the timing differs from year to year. iNaturalist records are thin in any one place and
   year, so onset, peak and length pool every year in a cell, and the yearly comparison pools records along the trail after
   taking out each 49 sq mi cell's own usual date (so a year with more northern or higher records does not look late). */
const PHEN = [
  ['Trail-wide (flowering all along the trail)', [['Pink lady’s slipper','Cypripedium acaule'],['Bloodroot','Sanguinaria canadensis'],['Yellow trout lily','Erythronium americanum'],
    ['Red columbine','Aquilegia canadensis'],['Common jewelweed','Impatiens capensis']]],
  ['A.T. Seasons (USA-NPN focal plants)', [['Red trillium','Trillium erectum'],['Painted trillium','Trillium undulatum'],['Canada mayflower','Maianthemum canadense'],
    ['Hobblebush','Viburnum lantanoides'],['Spring beauty','Claytonia virginica']]],
  ['Northern indicators', [['Starflower','Lysimachia borealis'],['Bluebead lily','Clintonia borealis'],['Bunchberry','Cornus canadensis'],
    ['Mountain wood-sorrel','Oxalis montana'],['Three-toothed cinquefoil','Sibbaldiopsis tridentata']]],
  ['Southern indicators', [['Flame azalea','Rhododendron calendulaceum'],['Great rhododendron','Rhododendron maximum'],['Crested dwarf iris','Iris cristata'],
    ['Fire pink','Silene virginica'],['Catawba rhododendron','Rhododendron catawbiense']]],
  ['AMC focal: spring ephemerals', [['Carolina spring-beauty','Claytonia caroliniana'],['Cut-leaved toothwort','Cardamine concatenata'],['Dutchman’s breeches','Dicentra cucullaria'],['Rue anemone','Thalictrum thalictroides'],['Squirrel corn','Dicentra canadensis'],['Two-leaf toothwort','Cardamine diphylla'],['Wild leek','Allium tricoccum']]],
  ['AMC focal: summer-green', [['Bland sweet cicely','Osmorhiza claytonii'],['Blue cohosh','Caulophyllum thalictroides'],['Canada white violet','Viola canadensis'],['Clasping-leaved twistedstalk','Streptopus amplexifolius'],['Early blue cohosh','Caulophyllum giganteum'],['Eastern waterleaf','Hydrophyllum virginianum'],['Jack-in-the-pulpit','Arisaema triphyllum'],['Lance-leaved twistedstalk','Streptopus lanceolatus'],['Large-flowered bellwort','Uvularia grandiflora'],['Long-styled sweet cicely','Osmorhiza longistylis'],['Pale jewelweed','Impatiens pallida'],['Red baneberry','Actaea rubra'],['Sessile-leaved bellwort','Uvularia sessilifolia'],['Solomon’s plume','Maianthemum racemosum'],['Solomon’s seal','Polygonatum pubescens'],['Two-leaf mitrewort','Mitella diphylla'],['White baneberry','Actaea pachypoda'],['Wild ginger','Asarum canadense'],['Wood nettle','Laportea canadensis']]],
  ['AMC focal: evergreen', [['Foamflower','Tiarella cordifolia'],['Sharp-lobed hepatica','Hepatica acutiloba']]],
  ['Early detection (EDRR)', [['Amur cork tree','Phellodendron amurense','spread'],['Black swallow-wort','Vincetoxicum nigrum','spread'],['Bohemian knotweed','Reynoutria × bohemica','spread'],['Chinese yam','Dioscorea polystachya','spread'],['Chocolate vine','Akebia quinata','spread'],['Giant hogweed','Heracleum mantegazzianum','spread'],['Giant knotweed','Reynoutria sachalinensis','spread'],['Hardy kiwi','Actinidia arguta','spread'],['Incised fumewort','Corydalis incisa','spread'],['Italian arum','Arum italicum','spread'],['Japanese angelica tree','Aralia elata','spread'],['Japanese chaff flower','Achyranthes japonica','spread'],['Japanese hops','Humulus scandens','spread'],['Kudzu','Pueraria montana','spread'],['Leatherleaf mahonia','Berberis bealei','spread'],['Linden arrowwood','Viburnum dilatatum','spread'],['Oriental photinia','Pourthiaea villosa','spread'],['Pale swallow-wort','Vincetoxicum rossicum','spread'],['Policeman’s helmet','Impatiens glandulifera','spread'],['Porcelain-berry','Ampelopsis glandulosa','spread'],['Siebold’s arrowwood','Viburnum sieboldii','spread'],['Small carpetgrass','Arthraxon hispidus','spread'],['Sticky sage','Salvia glutinosa','spread'],['Wavyleaf basketgrass','Oplismenus undulatifolius','spread']]],
  ['Established priority', [['Amur honeysuckle','Lonicera maackii','spread'],['Autumn olive','Elaeagnus umbellata','spread'],['Border privet','Ligustrum obtusifolium','spread'],['Chinese privet','Ligustrum sinense','spread'],['Common buckthorn','Rhamnus cathartica','spread'],['Common reed (European)','Phragmites australis australis','spread'],['Garlic mustard','Alliaria petiolata','spread'],['Glossy buckthorn','Frangula alnus','spread'],['Japanese barberry','Berberis thunbergii','spread'],['Japanese honeysuckle','Lonicera japonica','spread'],['Japanese knotweed','Reynoutria japonica','spread'],['Japanese spiraea','Spiraea japonica','spread'],['Japanese stiltgrass','Microstegium vimineum','spread'],['Lesser celandine','Ficaria verna','spread'],['Mile-a-minute','Persicaria perfoliata','spread'],['Mimosa','Albizia julibrissin','spread'],['Morrow’s honeysuckle','Lonicera morrowii','spread'],['Multiflora rose','Rosa multiflora','spread'],['Norway maple','Acer platanoides','spread'],['Oriental bittersweet','Celastrus orbiculatus','spread'],['Princess tree','Paulownia tomentosa','spread'],['Purple loosestrife','Lythrum salicaria','spread'],['Sericea lespedeza','Lespedeza cuneata','spread'],['Spotted knapweed','Centaurea stoebe','spread'],['Tree-of-heaven','Ailanthus altissima','spread'],['Wineberry','Rubus phoenicolasius','spread'],['Winged burning bush','Euonymus alatus','spread']]],
  ['Forest pests', [['Spotted lanternfly','Lycorma delicatula','spread'],['Emerald ash borer','Agrilus planipennis','spread'],['Hemlock woolly adelgid','Adelges tsugae','spread'],
    ['Elongate hemlock scale','Fiorinia externa','spread'],['Spongy moth','Lymantria dispar','spread'],['Beech leaf disease','Litylenchus crenatae','spread'],
    /* shown only once the project has enough records of them (PHPESTMIN) */
    ['Beech scale (beech bark disease)','Cryptococcus fagisuga','spread',1],['Chestnut blight','Cryphonectria parasitica','spread',1],['Browntail moth','Euproctis chrysorrhoea','spread',1],
    ['Winter moth','Operophtera brumata','spread',1],['Asian longhorned beetle','Anoplophora glabripennis','spread',1],['Southern pine beetle','Dendroctonus frontalis','spread',1],
    ['Oak wilt','Bretziella fagacearum','spread',1],['Dogwood anthracnose','Discula destructiva','spread',1],['Sirex woodwasp','Sirex noctilio','spread',1]]]];
/* which question each group belongs to: flowering (phen), forest pests (pest), priority invasive plants (pinv) */
const PHSET = {'Forest pests':'pest', 'Early detection (EDRR)':'pinv', 'Established priority':'pinv'};
const PINVG = {EDRR:'Early detection (EDRR)', Priority:'Established priority'};
const PHSP = PHEN.flatMap(g => g[1].map(([common, sci, kind, cand]) => ({common, sci, key:sci.toLowerCase().replace(/[^a-z]+/g, '-'), group:g[0], kind:kind || 'plant', cand:!!cand, set:PHSET[g[0]] || 'phen', pest:!!PHSET[g[0]]})));
/* two questions share this engine: flowering (plants) and forest pests */
function PINVM(){ return S.q.id === 'inv' && !!(S.m && S.m.pinv); }
const CULTPH = new Set(['Sanguinaria canadensis', 'Erythronium americanum', 'Trillium erectum', 'Hepatica acutiloba', 'Thalictrum thalictroides', 'Cardamine diphylla', 'Arisaema triphyllum', 'Maianthemum racemosum', 'Asarum canadense']);
function CULTM(){ return S.q.id === 'cult' && !!(S.m && S.m.cphen); }
function PHQ(){ return !(S.m && S.m.fhr) && (S.q.id === 'phen' || S.q.id === 'pest' || PINVM() || CULTM()); }
/* the two questions that map spread (first year recorded), with species ranked by records */
function SPREADQ(){ return !(S.m && S.m.fhr) && (S.q.id === 'pest' || PINVM()); }
const phSetNow = () => S.q.id === 'pest' ? 'pest' : S.q.id === 'inv' ? 'pinv' : S.q.id === 'cult' ? 'cphen' : 'phen';
const phList = (set = phSetNow()) => set === 'cphen' ? PHSP.filter(s => s.set === 'phen' && CULTPH.has(s.sci)) : PHSP.filter(s => s.set === set);
/* record counts of the forest pests in the project, looked up once and kept 30 days; the extra candidates show at PHPESTMIN or more */
const PHPESTMIN = 100, PHCNT = {}; let phCntRun = false;
/* Pre-built records: build_phenology.py (weekly GitHub Action) writes phen/index.json and phen/<species>.json.
   A species in the files loads from the site in one request, then only records newer than the file come from iNaturalist.
   Anything not in the files (or a Refresh) loads live from iNaturalist as before. */
let PHIDX, PHIDXV = null;
/* research-grade records of the stage a species is counted by (flowering for plants, every record for pests):
   mapped ones plus those whose location is hidden (obscured or private) or missing; from the loaded records, else the weekly index */
const phCntStage = sp => sp.kind === 'plant' ? 1 : 5;
function phTot(sp){ const s = phCntStage(sp), st = PHD[sp.key];
  if (st && st.st === 'done'){ const k = st.pts.reduce((t, p) => t + (p[2] === s ? 1 : 0), 0), h = (st.drop || {})[s] || 0; return {all:k + h, kept:k, hid:h}; }
  const e = PHIDXV && PHIDXV.species[sp.key]; if (e && e.kept){ const k = e.kept[s] || 0, h = (e.drop || {})[s] || 0; return {all:k + h, kept:k, hid:h}; }
  return sp.pest && PHCNT[sp.key] != null ? {all:PHCNT[sp.key]} : null; }
function phIdx(){ if (PHIDX === undefined) PHIDX = fetch('data/phen/index.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null)
    .then(j => { PHIDXV = j && j.species && j.project === (ATiNat.config.project || '') ? j : null; if (PHIDXV) phIdxAdd(PHIDXV); return PHIDXV; }).catch(() => null);
  return PHIDX; }
/* the weekly index carries the list from invasive_lookup.csv: species added there join, species taken off leave, and each sits in its tier */
function phIdxAdd(ix){ let n = 0; const P = Object.entries(ix.species).filter(([, e]) => e.set === 'pinv' && e.tier);
  if (P.length){ const keep = new Set(P.map(([k]) => k));
    for (let i = PHSP.length - 1; i >= 0; i--) if (PHSP[i].set === 'pinv' && !keep.has(PHSP[i].key)){ PHSP.splice(i, 1); n++; }
    for (const [key, e] of P){ const s = PHSP.find(x => x.key === key), g = PINVG[e.tier] || PINVG.Priority;
      if (s){ if (s.group !== g){ s.group = g; n++; } if (e.common) s.common = e.common; }
      else { PHSP.push({common:e.common || e.sci, sci:e.sci, key, group:g, kind:'spread', cand:false, set:'pinv', pest:true}); n++; } } }
  if (n && S.q.id === 'inv') side(); }
/* the species each animated question opens on, until the user picks one */
const PHDEF = {inv:'berberis-thunbergii', pest:'lycorma-delicatula'};
function phDef(){ const k = PHDEF[S.q.id]; return k ? phListShown().find(s => s.key === k) || null : null; }
function phCntDone(){ if (S.q.id === 'inv' && S.m.id === 'edrr' && $('#pinvsel')) side(); if (SPREADQ()){ const sp = S.ph.pick ? phSp() : (phDef() || phListShown()[0] || phSp()); if (sp.key !== S.ph.sp){ S.ph.sp = sp.key; phLoad(sp); } BRK.clear(); redraw(); } }
function phPestCounts(){ if (phCntRun) return; phCntRun = true;
  phIdx().then(ix => { const sx = ix && ix.species, ps = PHSP.filter(s => s.pest);
    if (sx){ const miss = []; ps.forEach(s => { if (sx[s.key] && sx[s.key].cnt != null) PHCNT[s.key] = sx[s.key].cnt; else miss.push(s); }); phCntDone(); if (miss.length) phPestCountsLive(miss, true); }
    else phPestCountsLive(); }); }
function phPestCountsLive(list, fresh){ list = list || PHSP.filter(s => s.pest); const k = 'atgrid-pestcount-v2:' + (ATiNat.config.project || '');
  if (!fresh) try { const x = JSON.parse(localStorage.getItem(k)); if (x && Date.now() - x.at < PHKEEP){ Object.assign(PHCNT, x.c); return; } } catch (e) {}
  (async () => { for (const sp of list){ try { const t = await prioTaxon({sci:sp.sci});
        const r = await fetch('https://api.inaturalist.org/v1/observations?' + (ATiNat.config.project ? 'project_id=' + encodeURIComponent(ATiNat.config.project) + '&' : '') + 'quality_grade=research&per_page=0&taxon_id=' + t);
        if (r.ok) PHCNT[sp.key] = (await r.json()).total_results || 0; } catch (e) {} }
    if (!fresh) try { localStorage.setItem(k, JSON.stringify({at:Date.now(), c:PHCNT})); } catch (e) {}
    if (SPREADQ()){ const sp = S.ph.pick ? phSp() : (phDef() || phListShown()[0] || phSp()); if (sp.key !== S.ph.sp){ S.ph.sp = sp.key; phLoad(sp); } BRK.clear(); redraw(); } })(); }
const phShown = sp => !sp.pest || sp.set === 'pinv' ? true : PHCNT[sp.key] == null ? !sp.cand : PHCNT[sp.key] >= PHPESTMIN;
const phListShown = () => { const L = phList().filter(phShown); return SPREADQ() ? L.sort((a, b) => (PHCNT[b.key] || 0) - (PHCNT[a.key] || 0)) : L; };
/* each question keeps its own species */
function phQSync(){ if (!PHQ()) return; S.ph.by = S.ph.by || {}; const qk = phSetNow(); if (S.ph.q === qk) return;
  if (S.ph.q){ S.ph.by[S.ph.q] = S.ph.sp; S.ph.yr = 0; S.ph.sel = []; } S.ph.q = qk; const L = phListShown(); if (!L.some(s => s.key === S.ph.sp)) S.ph.sp = S.ph.by[qk] || (L[0] || phList()[0]).key; }
const PHD = {};   /* by key: {st:'loading'|'done'|'error', pts:[[day of year, year, stage, lat, lon, id]], n, msg, at} */
const PHKEEP = 30 * 864e5, phKey = sp => 'atgrid-phen-v3:' + (ATiNat.config.project || '') + ':' + sp.key;
const PHFIELDS = '(id:!t,observed_on:!t,quality_grade:!t,obscured:!t,geoprivacy:!t,taxon_geoprivacy:!t,geojson:all)';
const phSpRaw = () => { if (!PHQ()) return PHSP.find(s => s.key === S.ph.sp) || PHSP[0]; const L = phListShown(); return L.find(s => s.key === S.ph.sp) || L[0] || phList()[0]; };
let PHSPC = null;
const phSp = () => { const k = S.q.id + '|' + S.ph.sp + '|' + (S.m && S.m.pinv ? 1 : 0) + '|' + PHSP.length; if (PHSPC && PHSPC.k === k) return PHSPC.v;
  const v = phSpRaw(); if (!PHSPC) queueMicrotask(() => { PHSPC = null; }); PHSPC = {k, v}; return v; };
const phMain = (sp = phSp()) => sp.kind === 'plant' ? 1 : sp.kind === 'adult' ? 4 : 5;
const PHWORD = {1:'flowering', 2:'fruiting', 3:'in bud', 4:'adults', 5:'records'};
const phNoun = () => phSp().kind === 'adult' ? 'adult' : 'flowering';
const doyOf = d => { const t = new Date(d + 'T12:00:00'); if (isNaN(t)) return null; return Math.round((t - new Date(t.getFullYear(), 0, 1, 12)) / 864e5) + 1; };
const wkOf = d => Math.min(52, Math.floor((d - 1) / 7) + 1);
const doyDate = d => new Date(2021, 0, Math.round(d)).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const wkDate = w => new Date(2021, 0, 1 + (w - 1) * 7).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const wkLabel = w => `${wkDate(w)} – ${new Date(2021, 0, (w - 1) * 7 + 7).toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
const phPct = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
const phMed = a => { const b = a.slice().sort((p, q) => p - q), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m-1] + b[m]) / 2; };
/* annotation ids, looked up by name once (iNaturalist renames terms now and then), with the known ids as the fallback */
let PHT = null;
async function phTerms(){ if (PHT) return PHT; const T = {fl:[12, 13], fr:[12, 14], bd:[12, 15], ad:[1, 2]};
  try { let terms; const k = 'atgrid-terms-v1';
    try { const x = JSON.parse(localStorage.getItem(k)); if (x && Date.now() - x.at < PHKEEP) terms = x.t; } catch (e) {}
    if (!terms){ const r = await fetch('https://api.inaturalist.org/v1/controlled_terms'); if (!r.ok) throw 0;
      terms = ((await r.json()).results || []).map(t => ({id:t.id, label:t.label || '', values:(t.values || []).map(v => ({id:v.id, label:v.label || ''}))}));
      try { localStorage.setItem(k, JSON.stringify({at:Date.now(), t:terms})); } catch (e) {} }
    const val = (t, re) => (t.values.find(v => re.test(v.label)) || {}).id;
    const ff = terms.find(t => t.id === 12) || terms.find(t => /flowers and fruits|phenology/i.test(t.label));
    if (ff){ T.fl = [ff.id, val(ff, /^flowers?$|^flowering$/i) || 13]; T.fr = [ff.id, val(ff, /^fruit/i) || 14]; T.bd = [ff.id, val(ff, /bud/i) || 15]; }
    const ls = terms.find(t => t.id === 1) || terms.find(t => /life stage/i.test(t.label));
    if (ls) T.ad = [ls.id, val(ls, /^adult$/i) || 2];
  } catch (e) {}
  return PHT = T; }
async function phPage(params){ const q = (ATiNat.config.project ? 'project_id=' + encodeURIComponent(ATiNat.config.project) + '&' : '') + 'quality_grade=research&order_by=id&order=asc&per_page=200&' + params;
  if (PRIO_V2){ try { const r = await fetch('https://api.inaturalist.org/v2/observations?' + q + '&fields=' + encodeURIComponent(PHFIELDS)); if (!r.ok) throw 0;
      const j = await r.json(); if ((j.results || []).some(o => (!o.geojson && !o.obscured) || !('observed_on' in o))) throw 0; return j; } catch (e){ PRIO_V2 = false; } }
  const r = await fetch('https://api.inaturalist.org/v1/observations?' + q); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const phStreams = (sp, T) => sp.kind === 'plant' ? [[3, T.bd], [1, T.fl]] : sp.kind === 'adult' ? [[4, T.ad], [5, null]] : [[5, null]];
function phDone(sp, st){ st.st = 'done'; st.at = st.at || Date.now(); for (const k in PHAGG) if (k.startsWith(sp.key + '|')) delete PHAGG[k];
  if (PHQ() && phSp() === sp){ BRK.clear(); redraw(); } }
/* the pre-built file, then any newer records from iNaturalist; false when the species is not pre-built */
async function phBuilt(sp, st){ const ix = await phIdx(), e = ix && ix.species[sp.key]; if (!e) return false;
  const r = await fetch('data/phen/' + sp.key + '.json', {cache:'no-cache'}); if (!r.ok) return false; const j = await r.json(); if (!Array.isArray(j.pts)) return false;
  st.pts = j.pts.slice(); st.n = st.pts.length; st.taxon = j.taxon; st.nid = j.nid; st.built = j.at; st.added = 0; st.drop = Object.assign({}, j.drop || {}); st.edd = Array.isArray(j.edd) ? j.edd : []; st.eddDup = j.edd_dup || 0; st.at = Date.now(); phStatusOnly();
  try { const T = await phTerms(), tally = {obscured:0};
    for (const [stage, tv] of phStreams(sp, T)){ let above = (j.top || {})[stage] || 0; if (!above) continue;
      for (let page = 0; page < 50; page++){ const jj = await phPage(`taxon_id=${j.taxon}` + (tv ? `&term_id=${tv[0]}&term_value_id=${tv[1]}` : '') + `&id_above=${above}`), res = jj.results || [];
        res.forEach(o => { const p = prioKeep(o, tally), d = doyOf(o.observed_on || ''); if (p && d){ st.pts.push([d, +String(o.observed_on).slice(0, 4), stage, p[0], p[1], o.id]); st.added++; } else st.drop[stage] = (st.drop[stage] || 0) + 1; });
        st.n = st.pts.length; if (res.length) above = res[res.length - 1].id; if (res.length < 200) break; } } }
  catch (err){ st.topErr = true; }
  phDone(sp, st); return true; }
function phLoad(sp, live){ let st = PHD[sp.key]; if (st && (st.st === 'done' || st.st === 'loading')) return;
  if (!live){ st = PHD[sp.key] = {st:'loading', pts:[], n:0};
    phBuilt(sp, st).then(ok => { if (ok) return; delete PHD[sp.key]; phLoad(sp, true); }).catch(() => { delete PHD[sp.key]; phLoad(sp, true); }); return; }
  try { const x = JSON.parse(localStorage.getItem(phKey(sp))); if (x && Array.isArray(x.pts) && Date.now() - x.at < PHKEEP){ PHD[sp.key] = {st:'done', pts:x.pts, n:x.pts.length, at:x.at, taxon:x.taxon, nid:x.nid, drop:x.drop || {}, edd:x.edd || [], eddDup:x.eddDup || 0}; return; } } catch (e) {}
  st = PHD[sp.key] = {st:'loading', pts:[], n:0, drop:{}};
  (async () => { const T = await phTerms(), taxon = await prioTaxon({sci:sp.sci}), tally = {obscured:0};
    for (const [stage, tv] of phStreams(sp, T)){ let above = 0;
      for (let page = 0; page < 100; page++){ const j = await phPage(`taxon_id=${taxon}` + (tv ? `&term_id=${tv[0]}&term_value_id=${tv[1]}` : '') + `&id_above=${above}`), res = j.results || [];
        res.forEach(o => { const p = prioKeep(o, tally), d = doyOf(o.observed_on || ''); if (p && d) st.pts.push([d, +String(o.observed_on).slice(0, 4), stage, p[0], p[1], o.id]); else st.drop[stage] = (st.drop[stage] || 0) + 1; });
        st.n = st.pts.length; if (res.length) above = res[res.length - 1].id; phStatusOnly(); if (res.length < 200) break; } }
    st.taxon = taxon;
    if (sp.pest) try { const r = await fetch('https://api.inaturalist.org/v1/observations?' + (ATiNat.config.project ? 'project_id=' + encodeURIComponent(ATiNat.config.project) + '&' : '') + 'quality_grade=needs_id&per_page=0&taxon_id=' + taxon); if (r.ok) st.nid = (await r.json()).total_results || 0; } catch (e) {}
    if (sp.pest) try { const r = await fetch('data/phen/' + sp.key + '.json', {cache:'no-cache'}); if (r.ok){ const jj = await r.json(); st.edd = jj.edd || []; st.eddDup = jj.edd_dup || 0; } } catch (e) {}   /* EDDMapS comes only from the weekly file */
    st.st = 'done'; st.at = Date.now();
    try { localStorage.setItem(phKey(sp), JSON.stringify({at:st.at, pts:st.pts, taxon:st.taxon, nid:st.nid, drop:st.drop, edd:st.edd || [], eddDup:st.eddDup || 0})); } catch (e) {}
    for (const k in PHAGG) if (k.startsWith(sp.key + '|')) delete PHAGG[k];
    if (PHQ() && phSp() === sp){ BRK.clear(); redraw(); } })()
  .catch(e => { st.st = 'error'; st.msg = e.message; if (PHQ()) side(); }); }
function phRefresh(){ const sp = phSp(); try { localStorage.removeItem(phKey(sp)); } catch (e) {} delete PHD[sp.key]; for (const k in PHAGG) if (k.startsWith(sp.key + '|')) delete PHAGG[k]; phLoad(sp, true); side(); }
/* which cell of a size each record falls in (nearest few cell centers, tested against the outline) */
const PHBK = new WeakMap();
function phCell(lv, la, lo){ const L_ = D.levels[lv]; let B = PHBK.get(L_);
  if (!B){ B = new Map(); L_.c.forEach((p, c) => { const k = Math.floor(p[0] * 4) * 4000 + Math.floor(p[1] * 4); let a = B.get(k); if (!a) B.set(k, a = []); a.push(c); }); PHBK.set(L_, B); }
  const k0 = Math.floor(la * 4), k1 = Math.floor(lo * 4), k = Math.cos(la * Math.PI / 180), near = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){ const a = B.get((k0 + i) * 4000 + k1 + j); if (a) for (const c of a){ const dy = L_.c[c][0] - la, dx = (L_.c[c][1] - lo) * k, d = dx*dx + dy*dy;
    if (near.length < 3 || d < near[2][0]){ near.push([d, c]); near.sort((p, q) => p[0] - q[0]); if (near.length > 3) near.pop(); } } }
  for (const [, c] of near) if (inRingLL(la, lo, ring(lv, c))) return c; return -1; }
/* per species and cell size: weekly counts per stage (all years and each year), records by cell, first year, and each cell's
   season from the main stage, all years pooled: onset (10th percentile date, 5+ records), peak (median, 5+), end (90th) and length (8+) */
const PHAGG = {}, PHY0 = 2010, PHST = [1, 2, 3, 4, 5], PHMIN = 5, PHMINLEN = 8;
function phAgg(lv){ const sp = phSp(), st = PHD[sp.key]; if (!st || st.st !== 'done') return null;
  const key = sp.key + '|' + lv; let A = PHAGG[key]; if (A && A.lev === D.levels[lv]) return A;
  const n = D.levels[lv].id.length, ms = phMain(sp), cnt = sp.kind === 'plant' ? 0 : 5, seen = new Set();
  A = PHAGG[key] = {lev:D.levels[lv], yn:{}, placed:0, pre:0, preMin:null, any:new Uint16Array(n), first:new Array(n).fill(null), w:{}, y:{}, d:{}, mx:{}, ymx:{}};
  for (const s of PHST){ A.w[s] = new Uint16Array(n * 53); A.d[s] = new Map(); }
  for (const [d, y, s, la, lo, id] of st.pts){ if (s === 2 || sp.pest && y < PHY0) continue; const c = phCell(lv, la, lo); if (c < 0) continue; const w = wkOf(d);
    if (cnt ? s === cnt : !seen.has(id)){ A.placed++; seen.add(id); } A.any[c]++; if (A.first[c] == null || y < A.first[c]) A.first[c] = y;
    if (s === ms && y < PHY0){ A.pre++; if (A.preMin == null || y < A.preMin) A.preMin = y; }
    A.w[s][c*53 + w]++;
    if (y >= PHY0){ const Y = A.y[y] || (A.y[y] = {}); (Y[s] || (Y[s] = new Uint16Array(n * 53)))[c*53 + w]++; }
    if (s === ms && y >= PHY0) A.yn[y] = (A.yn[y] || 0) + 1;
    let L = A.d[s].get(c); if (!L) A.d[s].set(c, L = []); L.push([d, y]); }
  /* EDDMapS reports: where and when first recorded, and the range by year; not in the weekly or share counts */
  A.eany = new Uint16Array(n); A.ey = {}; A.eyn = {}; A.eplaced = 0;
  for (const [, y, la, lo] of (st.edd || [])){ if (y < PHY0) continue; const c = phCell(lv, la, lo); if (c < 0) continue; A.eplaced++; A.eany[c]++; if (A.first[c] == null || y < A.first[c]) A.first[c] = y;
    if (y >= PHY0){ (A.ey[y] || (A.ey[y] = new Uint32Array(n)))[c]++; A.eyn[y] = (A.eyn[y] || 0) + 1; } }
  const cells = []; for (let c = 0; c < n; c++) if (A.any[c]) cells.push(c);
  const ys = Object.keys(A.y).map(Number).sort((p, q) => p - q), yu = [...new Set([...ys, ...Object.keys(A.ey).map(Number)])].sort((p, q) => p - q);
  A.years = yu.length ? Array.from({length:yu[yu.length - 1] - yu[0] + 1}, (_, i) => yu[0] + i) : [];
  A.on = new Array(n).fill(null); A.pk = new Array(n).fill(null); A.end = new Array(n).fill(null); A.len = new Array(n).fill(null); A.nm = new Uint16Array(n);
  for (const [c, L] of A.d[ms]){ const a = L.map(p => p[0]).sort((p, q) => p - q); A.nm[c] = a.length;
    if (a.length >= PHMIN){ A.on[c] = phPct(a, .1); A.pk[c] = phMed(a); A.end[c] = phPct(a, .9); }
    if (a.length >= PHMINLEN) A.len[c] = A.end[c] - A.on[c]; }
  /* the busiest three-week window of any cell, all years and single years, so the chart under the map keeps one scale while it plays */
  const win = (a, c, w) => a[c*53 + w] + (w > 1 ? a[c*53 + w - 1] : 0) + (w < 52 ? a[c*53 + w + 1] : 0);
  for (const s of PHST){ let mx = 0, ymx = 0; const a = A.w[s];
    for (const c of cells) for (let w = 1; w <= 52; w++){ const v = win(a, c, w); if (v > mx) mx = v; }
    for (const y of ys){ const b = A.y[y][s]; if (!b) continue; for (const c of cells) for (let w = 1; w <= 52; w++){ const v = win(b, c, w); if (v > ymx) ymx = v; } }
    A.mx[s] = mx; A.ymx[s] = ymx; }
  return A; }
/* records along the trail with each one's distance in days from its 49 sq mi cell's usual (median) date: [year, days, cell, mile].
   Cells need 5 or more records of the main stage to set a usual date. */
/* the year on show: 0 for all years together, otherwise a year with records */
/* Week views: S.ph.sel holds the years picked (none = all years); S.ph.yr is the one year on show while Play steps through them.
   The spread view picks a single year in S.ph.yr. */
function phSel(lv){ const A = phAgg(lv || dispLevel()); return A ? (S.ph.sel || []).filter(y => A.years.includes(y)).sort((a, b) => a - b) : []; }
function phYear(lv){ const A = phAgg(lv || dispLevel()); if (!A || !A.years.length) return 0;
  if (S.m.yr === 'wk'){ const sel = phSel(lv); if (S.ph.yr && A.years.includes(S.ph.yr) && (!sel.length || sel.includes(S.ph.yr))) return S.ph.yr; return sel.length === 1 ? sel[0] : 0; }
  if (S.ph.yr && A.years.includes(S.ph.yr)) return S.ph.yr; return S.m.yrNeed ? A.years[A.years.length - 1] : 0; }
/* the weekly counts for what is on show: one year, the picked years added together, or every year */
function phArr(lv, s){ const A = phAgg(lv); if (!A) return null; const y = phYear(lv); if (y) return A.y[y] && A.y[y][s] || null;
  const sel = S.m.yr === 'wk' ? phSel(lv) : []; if (sel.length < 2) return A.w[s];
  const key = s + ':' + sel.join(','); A.comb = A.comb || {}; if (A.comb[key]) return A.comb[key];
  const out = new Uint16Array(A.w[s].length); sel.forEach(y => { const a = A.y[y] && A.y[y][s]; if (a) for (let i = 0; i < a.length; i++) out[i] += a[i]; }); return A.comb[key] = out; }
const phSelText = lv => { const y = phYear(lv), sel = S.m.yr === 'wk' ? phSel(lv) : []; return y ? String(y) : sel.length > 4 ? `${sel.length} picked years` : sel.length > 1 ? sel.map(v => '’' + String(v).slice(2)).join(' ') : ''; };
function phWin(lv, c, s){ const A = phAgg(lv); if (!A || !A.any[c]) return null; const w = S.ph.wk;
  const a = phArr(lv, s); if (!a) return 0;
  return a[c*53 + w] + (w > 1 ? a[c*53 + w - 1] : 0) + (w < 52 ? a[c*53 + w + 1] : 0); }
const phTop = (lv, s) => { const A = phAgg(lv); return A ? Math.max(1, (phYear(lv) ? A.ymx[s] : A.mx[s]) / 3) : 1; };
function phFirst(lv, c){ const A = phAgg(lv); if (!A || A.first[c] == null) return null; const y = phYear(lv); return y && A.first[c] > y ? null : A.first[c]; }
const PHWAVE = [[0, ZERO, 'Recorded here, not these weeks'], [1, null, '1 record'], [2, null, '2 records'], [5, null, '3 to 5 records'], [10, null, '6 to 10 records'], [Infinity, null, 'over 10 records']];
const PHWAVECOL = ['#FFE600','#FFC400','#FF9900','#F56A00','#D6430A'];
const phWaveCols = () => CULTM() ? RAMP.cult : PHWAVECOL, phDotCol = () => CULTM() ? '#F2C200' : '#FFE600', phDotEdge = () => CULTM() ? '#F2C200' : '#FFB46B';   /* saturated, so the wave reads on topo maps and imagery alike */
const phWaveCol = v => { if (v == null) return null; if (v === 0) return ZERO; const i = PHWAVE.findIndex(e => v <= e[0]); return phWaveCols()[Math.max(0, Math.min(4, i - 1))]; };
const phWaveLegend = () => `<div class="row"><i style="background:${phDotCol()};border:1px solid ${phDotEdge()};border-radius:50%;width:6px;height:6px"></i><span>${PHWORD[phMain()] === 'records' ? 'Records' : PHWORD[phMain()][0].toUpperCase() + PHWORD[phMain()].slice(1) + ' records'} this week</span></div><div class="row"><i style="background:rgba(255,230,0,.45);border-radius:50%;width:4px;height:4px"></i><span>The week before</span></div><p class="sub">Cells:</p>` + PHWAVE.slice(1).map((e, i) => `<div class="row"><i style="background:${phWaveCols()[i]}"></i><span>${e[2]}</span></div>`).join('') +
  (phSelText() ? `<p class="sub">Records in the three weeks around ${esc(wkDate(S.ph.wk))}, ${phYear() ? phYear() + ' only' : 'years ' + esc(phSelText()) + ' together'}. Cells without records in these weeks are left blank.</p>`
    : `<p class="sub">Records in the three weeks around ${esc(wkDate(S.ph.wk))}, all years together.</p>`);
/* dates by half month, early spring to late summer */
const PHDATE = [[90, '#FDE725', 'March or earlier'], [105, '#B5DE2B', 'Early April'], [120, '#6ECE58', 'Late April'], [135, '#35B779', 'Early May'], [151, '#1F9E89', 'Late May'],
  [166, '#26828E', 'Early June'], [181, '#31688E', 'Late June'], [212, '#3E4989', 'July'], [Infinity, '#482878', 'August or later']];
const phDateCol = v => v == null ? null : PHDATE.find(e => v <= e[0])[1];
const phDateLegend = what => PHDATE.map(e => `<div class="row"><i style="background:${e[1]}"></i><span>${e[2]}</span></div>`).join('') + `<p class="sub">${what}</p>`;
const PHLEN = [[14, '#FFF06A', '2 weeks or less'], [28, '#FFE014', '3 to 4 weeks'], [42, '#F2C200', '5 to 6 weeks'], [56, '#C99A00', '7 to 8 weeks'], [Infinity, '#8A6800', 'over 8 weeks']];
const phLenCol = v => v == null ? null : PHLEN.find(e => v <= e[0])[1];
const PHFIRST = [[2015, '#E8A882'], [2017, '#DB8A63'], [2019, '#CE6D47'], [2021, '#C0502E'], [2023, '#9C3D22'], [Infinity, '#752C18']].map((e, i) => [e[0], e[1], ['2015 or earlier', '2016–17', '2018–19', '2020–21', '2022–23', '2024 or later'][i]]);
const PHFIRSTG = ['#FFF0A0', '#FFE14D', '#F2C200', '#C99A00', '#8F6D00', '#5E4800'];
const PHFIRSTO = ['#FBD3AE', '#F7B47C', '#F2934C', '#D9661A', '#A84D11', '#73340A'];
const phFirstPal = () => { const s = phSp(); return s.set === 'pinv' ? PHFIRST.map((e, i) => [e[0], PHFIRSTO[i], e[2]]) : s.pest ? PHFIRST : PHFIRST.map((e, i) => [e[0], PHFIRSTG[i], e[2]]); };
const phFirstCol = v => v == null ? null : phFirstPal().find(e => v <= e[0])[1];
/* the bars under the map: values as drawn (dates: later stands taller; spread: years since first recorded, so the oldest stand tallest) */
function stripV(m, v){ return m.stripH ? m.stripH(v) : m.stripAbs ? Math.abs(v) : v; }
let phTimer = null;
function phSeason(){ const A = phAgg(dispLevel()), a = A && A.w[phMain()]; if (!a) return [8, 44]; const tot = new Array(53).fill(0);
  for (let i = 0; i < a.length; i++) if (a[i]) tot[i % 53] += a[i];
  const mx = Math.max(...tot); if (!mx) return [8, 44]; let w0 = 1, w1 = 52; while (w0 < 52 && tot[w0] < mx * .02) w0++; while (w1 > w0 && tot[w1] < mx * .02) w1--;
  return [Math.max(1, w0 - 1), Math.min(52, w1 + 1)]; }
/* Play: week views run the weeks of the season (with a year picked, each year's season in turn); the spread view steps the years */
/* years with enough records to be worth a look (20 or more of the main stage in corridor cells); Play skips the rest */
const PHYMIN = 20, phYearsOk = A => A.years.filter(y => (A.yn[y] || 0) >= PHYMIN);
/* the year buttons: All years, then each year with its number of records; thin years are dimmed */
function phYrBlock(ys, y, multi){ const A = phAgg(dispLevel()); if (!A) return ''; const mx = Math.max(1, ...ys.map(v => A.yn[v] || 0)), sel = multi ? phSel() : (y ? [y] : []);
  return `<div class="phyrs" role="group" aria-label="${multi ? 'Years (tap several)' : 'Year'}" style="grid-template-columns:repeat(${Math.min(ys.length + 1, 12)},minmax(0,1fr))"><button type="button" data-phyr="0" aria-pressed="${!sel.length}"><b>All</b><i></i><span>years</span></button>` +
    ys.map(v => { const n = A.yn[v] || 0, thin = n < PHYMIN;
      return `<button type="button" data-phyr="${v}" aria-pressed="${sel.includes(v)}" class="${thin ? 'thin' : ''}${multi && v === y && sel.length > 1 ? ' now' : ''}" title="${v}: ${fmt(n, 0)} ${phMain() === 5 ? '' : PHWORD[phMain()] + ' '}${A.eplaced ? 'iNaturalist ' : ''}${n === 1 ? 'record' : 'records'}${thin ? ' (few records)' : ''}"><b>’${String(v).slice(2)}</b><i style="height:${Math.max(1, Math.round(14 * n / mx))}px"></i><span>${n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n}</span></button>`; }).join('') + '</div>'; }
function phPlay(on){ if (phTimer){ clearInterval(phTimer); phTimer = null; }
  if (on && S.m.yr === 'y'){ phTimer = setInterval(() => { const A = phAgg(dispLevel()); if (!A || !A.years.length) return; const ys = A.years, y = phYear();
      S.ph.yr = !y || y >= ys[ys.length - 1] ? ys[0] : y + 1; phFrame(); }, 800); }
  else if (on){ const sel = phSel(); if (sel.length > 1 && !sel.includes(S.ph.yr)) S.ph.yr = sel[0]; const yrs = phSelText() ? 1 : 0, [sw0, sw1] = phSeason(); if (!S.ph.resume || S.ph.wk < sw0 || S.ph.wk > sw1){ S.ph.wk = sw0; phFrame(); } phTimer = setInterval(() => { if (S.ph.wk < sw1) S.ph.wk++; else { S.ph.wk = sw0;
        const sel = phSel(); if (sel.length > 1){ const i = sel.indexOf(S.ph.yr); S.ph.yr = sel[(i + 1) % sel.length]; } }
      phFrame(); }, yrs ? 380 : 550); }
  phCtl(); }
function phFrame(){ BRK.clear(); restyle(); strip(); legend(); phCtl(); const t = $('#phtrend'); if (t && S.side.viz){ t.innerHTML = phTrendBlock(); phWireTrend(); } }
function phYrsText(){ const y = phYear(), A = phAgg(dispLevel()), ys = A ? A.years : []; return y ? String(y) : phSelText() ? phSelText() : ys.length ? `all years, ${ys[0]}–${ys[ys.length - 1]}` : 'all years'; }
function phCtl(){ const r = $('#phwk'), l = $('#phwkl'), b = $('#phplay'), y = phYear();
  if (r) r.value = S.ph.wk; if (l) l.textContent = wkLabel(S.ph.wk) + ' · ' + phYrsText(); { const yn = $('#phyrnote'); if (yn){ const t = phYrNote(); yn.textContent = t; yn.hidden = !t; } } if (b) b.textContent = phTimer ? 'Pause' : 'Play';
  const multi = S.m.yr === 'wk', sel = multi ? phSel() : (y ? [y] : []);
  document.querySelectorAll('[data-phyr]').forEach(x => { const v = +x.dataset.phyr; x.setAttribute('aria-pressed', v ? sel.includes(v) : !sel.length); x.classList.toggle('now', multi && sel.length > 1 && v === y); });
  phTick(); }
/* the year ticker on the map while a week or year view is showing */
/* Week by week: that week's own records drawn as dots over the cells, with the week before fading behind them,
   so Play shows the observations moving up the trail. Same years as the map (all, the years picked, or the year playing). */
let PHDOTS = null, phDotKey = '';
function phDots(){ const on = PHQ() && !SPREADQ() && S.m.id === 'wave' && !S.m.find, sp = on ? phSp() : null, st = sp && PHD[sp.key];
  if (!on || !st || st.st !== 'done'){ if (PHDOTS && phDotKey){ PHDOTS.clearLayers(); phDotKey = ''; PHDOTS.n = 0; } return; }
  if (!PHDOTS){ if (!map.getPane('phdots')){ map.createPane('phdots').style.zIndex = 425; map.getPane('phdots').style.pointerEvents = 'none'; }
    PHDOTS = L.layerGroup().addTo(map); PHDOTS.r = L.canvas({pane:'phdots', padding:.4}); }
  const lv = dispLevel(), wk = S.ph.wk, y = phYear(lv), sel = phSel(lv), ms = phMain(), key = [sp.key, wk, y, sel.join(','), lv, S.sec, S.ext, st.pts.length].join('|');
  if (key === phDotKey) return; phDotKey = key; PHDOTS.clearLayers();
  const ok = v => y ? v === y : sel.length ? sel.includes(v) : true, now = [], prev = [];
  for (const [d, v, s, la, lo] of st.pts){ if (s !== ms || !ok(v)) continue; const w = wkOf(d); if (w !== wk && w !== wk - 1) continue;
    const c = phCell(lv, la, lo); if (c < 0 || !inSec(lv, c)) continue; (w === wk ? now : prev).push([la, lo]); }
  for (const p of prev) L.circleMarker(p, {renderer:PHDOTS.r, radius:CULTM() ? 1.4 : 1.8, stroke:false, fillColor:phDotCol(), fillOpacity:.45, interactive:false}).addTo(PHDOTS);
  for (const p of now) L.circleMarker(p, {renderer:PHDOTS.r, radius:CULTM() ? 2 : 2.6, color:phDotEdge(), weight:CULTM() ? .6 : 1, fillColor:phDotCol(), fillOpacity:1, interactive:false}).addTo(PHDOTS);
  PHDOTS.n = now.length; }
function phTick(){ phDots(); let t = document.getElementById('phtick'); const acq = S.q.id === 'land' && S.m.id === 'acq' && !!ACQ && ACQ.st === 'done' && S.ext === 'corr', vis = S.q.id === 'eff' && S.m.id === 'od' && !!S.visYr && !S.m.find, wxt = wxAnimOn() && (S.m.wxAnim === 'mon' ? S.wxMon != null : !!S.wxYr), on = acq || vis || wxt || PHQ() && S.m.yr && !S.m.find && phAgg(dispLevel());
  if (!t){ if (!on) return; t = document.createElement('div'); t.id = 'phtick'; t.setAttribute('aria-live', 'off'); document.getElementById('map').appendChild(t); }
  if (!on){ t.style.display = 'none'; phTickPos(); return; }
  t.classList.toggle('acqtick', !!acq);
  if (wxt){ const lv = dispLevel(), L_ = D.levels[lv], m = S.m; let n = 0, s = 0, k = 0;
    for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c)){ const v = m.get(lv, c); if (v == null) continue; k++; s += v; if (v > 0) n++; }
    const where = S.sec === 'all' ? '' : ' in ' + esc(secName());
    t.innerHTML = m.wxAnim === 'mon' ? `<b>${MONTHS_LONG[S.wxMon]}</b><span>${k ? (m.id === 'ppt' ? fmt(s / k, 1) + ' in of precipitation' : fmt(s / k, 0) + '°F mean temperature') + ' on average' + where : 'normal, 1991–2020'}</span>`
      : `<b>${S.wxYr}</b><span>${fmt(n, 0)} ${n === 1 ? 'cell' : 'cells'} with ${WXEV[m.wxG]} events${where}</span>`;
    t.classList.remove('acqtick'); t.style.display = 'block'; phTickPos(); return; }
  if (vis){ const lv = dispLevel(), L_ = D.levels[lv]; let n = 0; for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c)){ const v = visYearVal(lv, c, S.visYr); if (v) n += v; }
    t.innerHTML = `<b>${S.visYr}</b><span>${fmt(Math.round(n), 0)} observer-days${S.sec === 'all' ? '' : ' in ' + esc(secName())}${S.visYr > visFull() ? ' · no eBird yet' : ''}</span>`; t.style.display = 'block'; phTickPos(); return; }
  if (acq){ const yy = S.acqYr || ACQ.y1; let ac = 0; ACQ.by.forEach((e, y) => { if (y <= yy) ac += e.ac; });
    t.innerHTML = `<b>by ${yy}</b><span>${fmt(Math.round(ac), 0)} acres of A.T. land protected</span>`; t.style.display = 'block'; phTickPos(); return; }
  const y = phYear(), A = phAgg(dispLevel()), ys = A.years, span = ys.length ? ys[0] + '–' + String(ys[ys.length - 1]).slice(2) : 'All years';
  let big, small;
  if (S.m.id === 'spread'){ big = y ? 'by ' + y : span; small = y ? 'cells with records so far' : 'year first recorded'; }
  else if (S.m.id === 'share'){ big = y || '2010–' + String(ys[ys.length - 1]).slice(2); small = `share of ${phSp().set === 'pinv' ? 'plant ' : ''}records${y ? ' that year' : ', all years'}`; }
  else if (y){ big = y; small = esc(wkLabel(S.ph.wk)) + ' · ' + PHWORD[S.m.st()]; }
  else if (phSelText()){ big = esc(wkLabel(S.ph.wk)); small = `${esc(phSelText())} together · ${PHWORD[S.m.st()]}`; }
  /* all years together: the week is what changes as it plays, so it is the big line */
  else { big = esc(wkLabel(S.ph.wk)); small = `all years (${span}) · ${PHWORD[S.m.st()]}`; }
  if (S.m.id === 'wave' && PHDOTS && phDotKey) small += ` · ${fmt(PHDOTS.n || 0, 0)} ${PHDOTS.n === 1 ? 'record' : 'records'} this week`;
  t.innerHTML = `<b>${big}</b><span>${small}</span>`; t.style.display = 'block'; phTickPos(); }
/* top left of the map, just below the map controls (which wrap to more rows on a phone or when Map tools opens) */
/* the ticker sits 8 px under the lowest of the map's top controls (the tool rows and the Cells / Basemap row), lined up with their left edge */
function phTickPos(){ const t = document.getElementById('phtick'), m = document.getElementById('map'); if (!t || !m) return; const mr = m.getBoundingClientRect();
  const on = ['ctls', 'lvbar'].map(id => document.getElementById(id)).filter(e => e && e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map(e => e.getBoundingClientRect()).filter(r => r.height);
  const bot = on.length ? Math.max(...on.map(r => r.bottom)) : mr.top + 2, lb = document.getElementById('lvbar'), left = lb && lb.offsetParent ? lb.getBoundingClientRect().left - mr.left : 10;
  t.style.top = Math.max(10, Math.round(bot - mr.top + 8)) + 'px'; t.style.left = Math.max(8, Math.round(left)) + 'px';
  /* desktop: the legend stops 10 px below whichever is lower, the Cells / Basemap row or a showing ticker */
  const w = document.getElementById('mapwrap'); if (!w) return; const wr = w.getBoundingClientRect(), shown = t.style.display !== 'none' && t.offsetHeight;
  const low = Math.max(...on.map(r => r.bottom), shown ? t.getBoundingClientRect().bottom : 0), L = document.getElementById('legend');
  if (L && !document.body.classList.contains('stackui') && low > wr.top) L.style.setProperty('max-height', Math.max(120, Math.round(L.getBoundingClientRect().bottom - low - 10)) + 'px', 'important'); }
addEventListener('resize', () => { if (PHQ()) phTickPos(); });
if (window.ResizeObserver && document.getElementById('ctls')) new ResizeObserver(() => { if (PHQ()) phTickPos(); }).observe(document.getElementById('ctls'));
function phStatus(){ const sp = phSp(), st = PHD[sp.key];
  if (!st || st.st === 'loading') return `Loading research-grade records of ${esc(sp.common.toLowerCase())} from iNaturalist…` + (st && st.n ? ` ${fmt(st.n, 0)} so far` : '');
  if (st.st === 'error') return `Could not load from iNaturalist (${esc(st.msg || 'error')}). <button type="button" data-phref="1">Try again</button>`;
  const A = phAgg(dispLevel()), n = s => fmt(st.pts.reduce((t, p) => t + (p[2] === s ? 1 : 0), 0), 0);
  const T = phTot(sp), hid = T && T.hid ? T.hid : 0;
  const split = hid ? ` (${fmt(T.kept, 0)} mapped, ${fmt(hid, 0)} with a hidden location)` : '';
  const what = sp.kind === 'plant' ? `${fmt(T ? T.all : 0, 0)} flowering research-grade records${split} and ${n(3)} in bud`
    : `${fmt(T ? T.all : 0, 0)} research-grade records${split}` + (sp.kind === 'adult' ? `, ${n(4)} marked adult` : '');
  const nid = st.nid ? ` <a href="https://www.inaturalist.org/observations?${ATiNat.config.project ? 'project_id=' + encodeURIComponent(ATiNat.config.project) + '&' : ''}taxon_id=${st.taxon}&quality_grade=needs_id" target="_blank" rel="noopener">${fmt(st.nid, 0)} more ${st.nid === 1 ? 'observation needs' : 'observations need'} ID</a> and ${st.nid === 1 ? 'is' : 'are'} not mapped.` : '';
  return `${what}. ${fmt(A ? A.placed : 0, 0)} of the mapped records fall in ${S.ext === 'huc' ? 'watershed' : 'corridor'} cells${sp.pest ? ` (from ${PHY0} on; earlier records are left out)` : ''}.${A && A.eplaced ? ` Plus ${fmt(A.eplaced, 0)} EDDMapS ${A.eplaced === 1 ? 'report' : 'reports'} in those cells, which count toward where it has been recorded and the range${st.eddDup ? `; ${fmt(st.eddDup, 0)} more ${st.eddDup === 1 ? 'matches an iNaturalist record' : 'match iNaturalist records'} (same day or next, within 50 m) and ${st.eddDup === 1 ? 'is' : 'are'} counted once` : ''}.` : ''}${nid} ${st.built ? `From the weekly download of ${new Date(st.built).toLocaleDateString('en-US')}${st.added ? `, plus ${fmt(st.added, 0)} newer ${st.added === 1 ? 'record' : 'records'} from iNaturalist` : ''}${st.topErr ? ' (iNaturalist could not be reached for newer records)' : ''}.` : `Loaded from iNaturalist ${new Date(st.at).toLocaleDateString('en-US')}.`} <button type="button" data-phref="1">Refresh</button>`; }
/* under the year buttons: the button counts that year's records; the map shows every cell recorded by the end of the year */
function phYrNote(){ if (S.m.id === 'share') return phShNote(); const lv = dispLevel(), A = phAgg(lv), y = phYear(lv);
  if (!A || !y) return '';
  const n = A.yn[y] || 0; let cells = 0; for (let c = 0; c < A.first.length; c++) if (A.first[c] != null && A.first[c] <= y) cells++;
  return `${y}: ${fmt(n, 0)} ${A.eplaced ? 'iNaturalist ' : ''}${n === 1 ? 'record' : 'records'} that year. The map shows the ${fmt(cells, 0)} ${cells === 1 ? 'cell' : 'cells'} where it had been recorded${A.eplaced ? ' (iNaturalist or EDDMapS)' : ''} by the end of ${y}` +
    (() => { let k = 0, m = null; for (let c = 0; c < A.first.length; c++){ const f0 = A.first[c]; if (f0 != null && f0 < A.years[0]){ k++; if (m == null || f0 < m) m = f0; } }
      return k ? `, including ${fmt(k, 0)} first recorded before ${A.years[0]} (the earliest in ${m})` : ''; })() + '.'; }
/* Priority invasives measure: the species-per-cell map, with a list to open one species' spread */
function pinvPick(){ phIdx(); phPestCounts(); const L = phList('pinv').sort((a, b) => (PHCNT[b.key] || 0) - (PHCNT[a.key] || 0));
  return `<div class="phctl"><select id="pinvsel" aria-label="Priority invasive species"><option value="">All priority invasives: species per cell</option>` +
    Object.values(PINVG).map(g => `<optgroup label="${esc(g)}">` + L.filter(s => s.group === g).map(s => `<option value="${s.key}">${esc(s.common)} (${esc(s.sci)})${(t => t ? ' · ' + fmt(t.all, 0) + ' records' : '')(phTot(s))}</option>`).join('') + '</optgroup>').join('') + '</select></div>' +
    '<p class="phstat" style="margin-top:4px">Pick a species to see where it has spread along the trail, year by year, with Play to animate it.</p>'; }
document.addEventListener('change', e => { if (e.target.id !== 'pinvsel' || !e.target.value) return; keepPlace(e.target, ['#phsp'], () => { S.ph.sp = e.target.value; S.ph.pick = true; S.ph.q = 'pinv'; S.ph.yr = 0; S.ph.sel = [];
  S.m = S.q.m.find(x => x.pinv && x.id === 'spread'); phLoad(phSp()); BRK.clear(); redraw(); }); });
document.addEventListener('click', e => { const b = e.target.closest('[data-pinvm]'); if (!b) return; keepPlace(b, [`[data-pinvm="${b.dataset.pinvm}"]`], () => { phPlay(false); S.m = S.q.m.find(x => x.pinv && x.id === b.dataset.pinvm); BRK.clear(); redraw(); }); });
/* Share of records: a species' research-grade records in a cell and year as a share of all the research-grade iNaturalist records
   made there that year (plant records for the priority invasive plants, every record for forest pests). The yearly totals come from
   the quarterly summary (OBS_BY_YEAR, PLANT_OBS_BY_YEAR, from 2010); dividing by them takes out most of the growth in iNaturalist use.
   A cell needs PHSHMIN records that year to be shown; with All, every year from 2010 is added together. */
const PHSHMIN = 20, PHSHBR = [0.5, 1, 2, 5], PHSH0 = '#C9C3B8';
const PHSHPAL = {pinv:['#FBD3AE', '#F7B47C', '#F2934C', '#D9661A', '#8A410A'], pest:['#E8A882', '#DB8A63', '#CE6D47', '#C0502E', '#752C18']};
const phShField = () => phSp().set === 'pinv' ? 'PLANT_OBS_BY_YEAR' : 'OBS_BY_YEAR';
const phShReady = lv => { const t = D.themes.inat && D.themes.inat[lv]; return !!(t && t.f[phShField()]); };
function phEff(lv, c, y){ const a = val('inat', phShField(), lv, c); if (!a) return null; let t = 0;
  for (let i = 0; i < a.length; i += 2) if (y ? a[i] === y : a[i] >= PHY0) t += a[i + 1]; return t; }
/* this species' records per cell, one year or every year from 2010 */
function phYc(A, y){ const k = y || 'all'; A.yc = A.yc || {}; if (A.yc[k]) return A.yc[k]; const n = A.any.length, out = new Uint32Array(n), ms = phMain();
  const add = Y => { const w = Y && Y[ms]; if (!w) return; for (let c = 0; c < n; c++){ let t = 0; for (let j = 0; j < 53; j++) t += w[c * 53 + j]; out[c] += t; } };
  if (y) add(A.y[y]); else for (const yy in A.y) add(A.y[yy]); return A.yc[k] = out; }
/* records per cell in a year with EDDMapS reports added: for the range chart */
function phYcR(A, y){ const a = phYc(A, y), e = A.ey && A.ey[y]; if (!e) return a; const k = 'r' + y; if (A.yc[k]) return A.yc[k];
  const o = new Uint32Array(a.length); for (let c = 0; c < a.length; c++) o[c] = a[c] + e[c]; return A.yc[k] = o; }
/* records in a cell from 2010 through the year shown (all years when none): iNaturalist plus EDDMapS */
function phRecBy(lv, c, all){ const A = phAgg(lv); if (!A) return 0; const y = all ? 9999 : phYear(lv) || 9999; A.rb = A.rb || {}; let a = A.rb[y];
  if (!a){ const n = A.any.length; a = A.rb[y] = new Uint32Array(n);
    for (const yy of A.years){ if (yy > y) continue; const ic = phYc(A, yy), e = A.ey && A.ey[yy]; for (let k = 0; k < n; k++) a[k] += ic[k] + (e ? e[k] : 0); } }
  return a[c]; }
function phShare(lv, c){ const A = phAgg(lv); if (!A) return null; const y = phYear(lv), den = phEff(lv, c, y); if (den == null || den < PHSHMIN) return null;
  return Math.min(100, 100 * phYc(A, y)[c] / den); }
const phShTxt = v => v == null ? '–' : v === 0 ? 'none of the records' : v < 0.1 ? 'under 0.1% of records' : `${fmt(v, v < 10 ? 1 : 0)}% of records`;
function phShCol(v){ if (v == null) return null; if (v === 0) return PHSH0; const p = PHSHPAL[phSp().set] || PHSHPAL.pest, i = PHSHBR.findIndex(b => v < b); return p[i < 0 ? p.length - 1 : i]; }
function phShLegend(lv){ const p = PHSHPAL[phSp().set] || PHSHPAL.pest, pl = phSp().set === 'pinv' ? 'plant ' : '';
  const lab = ['under 0.5%', '0.5 to 1%', '1 to 2%', '2 to 5%', '5% or more'];
  if (!phShReady(lv)) return `<p class="sub">The yearly record totals this needs arrive with the next quarterly iNaturalist summary. Until then the map stays blank; Year first recorded works now.</p>`;
  return p.map((c, i) => `<div class="row"><i style="background:${c}"></i><span>${lab[i]}</span></div>`).join('') +
    `<p class="sub">Its research-grade records as a share of all research-grade ${pl}records in the cell ${phYear(lv) ? 'in ' + phYear(lv) : 'from 2010 on'}. Dividing by every record takes out most of the growth in iNaturalist use. Cells where it was not recorded, or with fewer than ${PHSHMIN} ${pl}records${phYear(lv) ? ' that year' : ''}, are left clear.</p>`; }
function phShNote(){ const lv = dispLevel(), A = phAgg(lv), y = phYear(lv), pl = phSp().set === 'pinv' ? 'plant ' : '';
  if (!A) return ''; if (!phShReady(lv)) return 'The share needs the yearly record totals from the next quarterly iNaturalist summary.';
  const L_ = D.levels[lv], yc = phYc(A, y); let k = 0, m = 0; for (let c = 0; c < L_.id.length; c++){ const den = phEff(lv, c, y); if (den != null && den >= PHSHMIN){ m++; if (yc[c]) k++; } }
  return `${y ? y + ': r' : 'From 2010 on, r'}ecorded in ${fmt(k, 0)} of the ${fmt(m, 0)} cells with ${PHSHMIN} or more ${pl}records${y ? ' that year' : ''}.`; }
/* Range along the trail: the southernmost and northernmost trail miles recorded by each year (band) and in that year (line) */
function phRangeBlock(lv){ const A = phAgg(lv), sp = phSp(); if (!A || !A.years.length) return ''; const L_ = D.levels[lv], ys = A.years, n = L_.id.length, sel = phYear(lv);
  let clo = null, chi = null; for (let c = 0; c < n; c++) if (A.first[c] != null && A.first[c] < ys[0]){ const m = L_.mi[c]; clo = clo == null ? m : Math.min(clo, m); chi = chi == null ? m : Math.max(chi, m); }
  const rows = ys.map(y => { const yc = phYcR(A, y); let lo = null, hi = null, k = 0; for (let c = 0; c < n; c++) if (yc[c]){ k++; const m = L_.mi[c]; lo = lo == null ? m : Math.min(lo, m); hi = hi == null ? m : Math.max(hi, m); }
    if (lo != null){ clo = clo == null ? lo : Math.min(clo, lo); chi = chi == null ? hi : Math.max(chi, hi); } return {y, lo, hi, k, clo, chi}; });
  const R = rows.filter(r => r.chi != null); if (!R.length) return '';
  const col = sp.set === 'pinv' ? HUE.pinv : HUE.pest, TOP = Math.ceil((D.totalMi || 2198) / 100) * 100;
  const W = 272, H = 150, pl = 40, pr = 8, pt = 12, pb = 18, pw = W - pl - pr, ph = H - pt - pb, bw = pw / ys.length, f = v => v.toFixed(1);
  const X = i => pl + bw * i + bw / 2, Y = m => pt + ph - ph * m / TOP, idx = r => ys.indexOf(r.y);
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Range along the trail by year">`;
  for (const m of [0, 500, 1000, 1500, 2000]) if (m <= TOP) g += `<line x1="${pl}" x2="${W - pr}" y1="${f(Y(m))}" y2="${f(Y(m))}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 3}" y="${f(Y(m) + 3)}" text-anchor="end" font-size="8" fill="#A8B8CA">mi ${fmt(m, 0)}</text>`;
  g += `<text x="${pl - 3}" y="${pt - 3}" text-anchor="end" font-size="7.5" fill="#A8B8CA">▲ Maine</text><text x="${pl - 3}" y="${H - 5}" text-anchor="end" font-size="7.5" fill="#A8B8CA">▼ Georgia</text>`;
  g += `<polygon points="${R.map(r => f(X(idx(r))) + ',' + f(Y(r.chi))).join(' ')} ${R.slice().reverse().map(r => f(X(idx(r))) + ',' + f(Y(r.clo))).join(' ')}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-opacity=".6" stroke-width=".8"/>`;
  rows.forEach((r, i) => { if (r.lo == null) return; const on = r.y === sel, dim = sel && r.y > sel ? .25 : 1;
    g += `<line x1="${f(X(i))}" x2="${f(X(i))}" y1="${f(Y(r.hi))}" y2="${f(Y(r.lo))}" stroke="${on ? '#FFFFFF' : col}" stroke-width="${on ? 3 : 2}" stroke-linecap="round" opacity="${dim}"><title>${r.y}: recorded from mile ${fmt(r.lo, 0)} to ${fmt(r.hi, 0)} in ${r.k} ${r.k === 1 ? 'cell' : 'cells'}; by then from mile ${fmt(r.clo, 0)} to ${fmt(r.chi, 0)}</title></line>`; });
  const every = ys.length > 12 ? 2 : 1;
  rows.forEach((r, i) => { if (i % every === 0 || i === ys.length - 1) g += `<text x="${f(X(i))}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="${r.y === sel ? '#FFE014' : '#A8B8CA'}"${r.y === sel ? ' font-weight="700"' : ''}>’${String(r.y).slice(2)}</text>`; });
  const a = R[0], z = R[R.length - 1], moved = z.chi - a.chi;
  const lead = `By ${z.y} it had been recorded from mile ${fmt(z.clo, 0)} to mile ${fmt(z.chi, 0)}.` + (Math.abs(moved) >= 25 ? ` The northernmost record moved from mile ${fmt(a.chi, 0)} (${a.y}) to mile ${fmt(z.chi, 0)}.` : '');
  return `<h4 class="phh">Range along the trail, by year</h4>` + g + '</svg>' +
    sumD('vsumr', `<p class="phflow">${lead}</p><p class="phnote">Band: southern to northern limit of records so far. Lines: that year’s records${A.eplaced ? ' (iNaturalist records and EDDMapS reports)' : ''}. A new northern record can mean spread, or new searching.</p>`); }
document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details[data-k]')) S.side[d.dataset.k] = d.open; }, true);
const sumD = (k, inner, id) => `<details class="instr" data-k="${k}"${S.side[k] ? ' open' : ''}><summary${id ? ` id="${id}"` : ''}>Summary</summary>${inner}</details>`;
function phStatusOnly(){ const e = $('#phstat'); if (e) e.innerHTML = phStatus(); const l = $('#phsumlab'), st = PHD[phSp().key]; if (l) l.textContent = 'Summary' + (st && st.st === 'loading' ? ' · loading…' : ''); }
/* a measure that does not apply to the species picked gives way to the first one that does */
function phFixM(){ if (!PHQ() || S.m.find || !S.m.hideFn || !S.m.hideFn()) return; S.m = S.q.m.find(m => m.id === (SPREADQ() ? 'spread' : 'wave')); }
function phBlock(){ const sp = phSp(), m = S.m, A = phAgg(dispLevel()), ys = A ? A.years : [], y = phYear();
  const L = phListShown(), grp = [...new Set(L.map(s => s.group))];
  let h = `<div class="phctl"><select id="phsp" aria-label="Species">${PINVM() ? '<option value="">All priority invasives: species per cell</option>' : ''}` + grp.map(g => `<optgroup label="${esc(g)}">` + L.filter(s => s.group === g).map(s => `<option value="${s.key}"${s.key === sp.key ? ' selected' : ''}>${esc(s.common)} (${esc(s.sci)})${(t => t ? ' · ' + fmt(t.all, 0) + (s.kind === 'plant' ? ' flowering records' : ' records') : '')(phTot(s))}</option>`).join('') + '</optgroup>').join('') + '</select>' + (PINVM() ? `<div class="chips pinvm" role="group" aria-label="Show">${S.q.m.filter(x => x.pinv && (!x.hideFn || !x.hideFn())).map(x => `<button type="button" data-pinvm="${x.id}" aria-pressed="${x === S.m}">${esc(x.label)}</button>`).join('')}</div>` : '');
  if (m.yr === 'wk'){ h += `<div class="wk"><button type="button" id="phplay">${phTimer ? 'Pause' : 'Play'}</button><input type="range" id="phwk" min="1" max="52" step="1" value="${S.ph.wk}" aria-label="Week of the year"></div><div class="wkl" id="phwkl">${wkLabel(S.ph.wk) + ' · ' + phYrsText()}</div>`;
    /* years before the first one with enough records are left off, so the row stays short */
    const ok = phYearsOk(A || {years:[], yn:{}}), ys2 = ok.length ? ys.filter(v => v >= ok[0]) : ys;
    if (ys2.length >= 2) h += phYrBlock(ys2, y, true) +
      `<details class="instr" data-k="instr"${S.side.instr ? ' open' : ''}><summary>Instructions</summary><p class="phstat">Tap years to add or remove them (numbers are each year’s records; dimmed years have fewer than ${PHYMIN}). Picked years show together; with two or more, Play runs each selected year in order. With All, every year is pooled, so Play shows the season for all years together. To play the years one at a time, with each year highlighted on the spread chart: <button type="button" data-phgood="1">Pick years with ${PHYMIN}+ records</button></p></details>`; }
  else if (m.yr === 'y' && ys.length >= 2){
    h += `<div class="wk yr"><button type="button" id="phplay">${phTimer ? 'Pause' : 'Play'}</button></div>` + phYrBlock(ys, y, false) +
      `<details class="instr" data-k="instr"${S.side.instr ? ' open' : ''}><summary>Instructions</summary><p class="phstat">${m.id === 'share' ? 'Pick All for every year from 2010 together, or one year to see that year. Play steps through the years.' : 'Pick All, or a year to see where it had been recorded by the end of that year. Play steps through the years.'}</p></details>`; }
  const ld = PHD[sp.key] && PHD[sp.key].st === 'loading';
  return h + sumD('sum', `<p class="phstat" id="phyrnote"${phYrNote() ? '' : ' hidden'}>${esc(phYrNote())}</p><p class="phstat" id="phstat" role="status">${phStatus()}</p>`, 'phsumlab').replace('>Summary</summary>', `>Summary${ld ? ' · loading…' : ''}</summary>`) + '</div>'; }
function phVizBlk(extra){ return `<section class="blk vizblk"><h2><button type="button" class="blktog" data-blk="viz" aria-expanded="${!!S.side.viz}"><span>Visualizations</span><i aria-hidden="true"></i></button></h2>` +
    `<div class="blkbody"${S.side.viz ? '' : ' hidden'}><div id="phtrend">${S.side.viz ? phTrendBlock() : ''}</div>${extra || ''}</div></section>`; }
function phWire(){ const s = $('#phsp'); if (!s) return;
  document.querySelectorAll('[data-phyr]').forEach(x => x.onclick = () => { const v = +x.dataset.phyr, A = phAgg(dispLevel()); phPlay(false);
    if (S.m.yr === 'wk'){ const sel = new Set(phSel()); if (!v) sel.clear(); else if (sel.has(v)) sel.delete(v); else sel.add(v); S.ph.sel = [...sel]; S.ph.yr = 0; }
    else S.ph.yr = A && A.years.includes(v) ? v : 0;
    BRK.clear(); redraw(); });
  document.querySelectorAll('[data-phgood]').forEach(x => x.onclick = () => { const A = phAgg(dispLevel()); if (!A) return; phPlay(false); S.ph.sel = phYearsOk(A); S.ph.yr = 0; BRK.clear(); redraw(); });
  s.onchange = () => keepPlace(s, ['#phsp', '#pinvsel'], () => { phPlay(false); if (!s.value){ S.m = S.q.m.find(x => x.id === 'edrr'); BRK.clear(); redraw(); return; } S.ph.sp = s.value; if (SPREADQ()) S.ph.pick = true; phLoad(phSp()); phFixM(); BRK.clear(); redraw(); });
  const r = $('#phwk'); if (r){ r.oninput = () => { S.ph.wk = +r.value; S.ph.resume = true; phFrame(); }; r.onchange = () => { redraw(); }; }
  const b = $('#phplay'); if (b) b.onclick = () => { const was = !!phTimer; phPlay(!phTimer); S.ph.resume = was; if (!phTimer) redraw(); };
  document.querySelectorAll('[data-phref]').forEach(x => x.onclick = phRefresh); phWireTrend(); }
/* charts: a year maps that year's weeks (or, for the spread, where it was by then); a week on the calendar maps that week */
function phWireTrend(){
  document.querySelectorAll('[data-phab]').forEach(x => x.ontoggle = () => { S.ph.ab = S.ph.ab || {}; S.ph.ab[x.dataset.phab] = x.open; });
  document.querySelectorAll('[data-phy]').forEach(x => x.onclick = () => { phPlay(false); S.ph.yr = +x.dataset.phy; S.ph.sel = [+x.dataset.phy];
    if (!S.m.yr) S.m = S.q.m.find(m => m.id === 'wave'); BRK.clear(); redraw(); });
  document.querySelectorAll('[data-phlat]').forEach(x => x.onclick = () => { S.ph.band = {i:+x.dataset.phlat, cell:S.cell == null ? null : S.cellLv + S.cell}; const t = $('#phtrend'); if (t){ t.innerHTML = phTrendBlock(); phWireTrend(); } });
  document.querySelectorAll('[data-phw]').forEach(x => x.onclick = () => { phPlay(false); S.ph.wk = Math.max(8, Math.min(44, +x.dataset.phw));
    if (S.m.yr !== 'wk') S.m = S.q.m.find(m => m.id === 'wave'); BRK.clear(); redraw(); }); }
/* ---------- charts ---------- */
const PHBAND = 200;   /* trail miles per row of the season calendar */
/* Season calendar: rows of 200 trail miles, north at the top, by week; each box is that week's flowering (or adult) records
   against the stretch's busiest week, so every stretch shows its own season from start to peak to end. */
function phCalendar(){ const sp = phSp(), A = phAgg('wheel'); if (!A) return ''; const yy = S.m.yr === 'wk' ? phYear('wheel') : 0; const L_ = D.levels.wheel, rng = secRange();
  const nb = Math.ceil(D.totalMi / PHBAND), plant = sp.kind === 'plant', ms = plant ? 1 : sp.kind === 'spread' ? 5 : 4, stg = [ms], B = Array.from({length:nb}, () => ({}));
  for (const s of stg) for (const [c, L] of A.d[s]){ const mi = L_.mi[c]; if (rng && (mi < rng[0] || mi > rng[1])) continue; const b = B[Math.min(nb - 1, Math.floor(mi / PHBAND))];
    for (const [d, y] of L){ if (yy && y !== yy) continue; const w = wkOf(d), e = b[w] || (b[w] = {3:0, 1:0, 2:0, 4:0, 5:0}); e[s]++; } }
  let w0 = 52, w1 = 1; B.forEach(b => Object.keys(b).forEach(w => { w0 = Math.min(w0, +w); w1 = Math.max(w1, +w); })); if (w1 < w0) return '';
  w0 = Math.max(1, w0 - 1); w1 = Math.min(52, w1 + 1);
  const rows = B.map((b, i) => ({i, b, n:Object.values(b).reduce((t, e) => t + stg.reduce((u, s) => u + e[s], 0), 0)})).filter(r => r.n).reverse();
  const W = 272, lab = 44, rh = Math.max(11, Math.min(18, 150 / rows.length)), H = rows.length * rh + 30, cw = (W - lab - 4) / (w1 - w0 + 1), f = v => v.toFixed(1);
  const ramp = ['#3A3420', '#6B5A12', '#A8860A', '#E0B400', '#FFE014'];
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Season calendar along the trail"><text x="${lab - 4}" y="7.5" text-anchor="end" font-size="7.5" fill="#A8B8CA">▲ Maine</text><g transform="translate(0,10)">`;
  rows.forEach((r, k) => { const y = k * rh, mx = Math.max(1, ...Object.values(r.b).map(e => e[ms]));
    g += `<text x="${lab - 4}" y="${f(y + rh * .72)}" text-anchor="end" font-size="8.5" fill="#A8B8CA">mi ${fmt(r.i * PHBAND, 0)}</text>`;
    for (let w = w0; w <= w1; w++){ const e = r.b[w]; if (!e) continue; 
      const v = e[ms] / mx, tip = `${e[ms]} ${plant ? 'flowering ' : ms === 4 ? 'adult ' : ''}${e[ms] === 1 ? 'record' : 'records'}`;
      const x = lab + (w - w0) * cw, col = v == null ? '#2E4460' : ramp[Math.min(4, Math.floor(v * 4.999))];
      g += `<rect data-phw="${w}" x="${f(x + .4)}" y="${f(y + .5)}" width="${f(cw - .8)}" height="${f(rh - 1)}" fill="${col}" style="cursor:pointer"><title>Miles ${fmt(r.i * PHBAND, 0)}–${fmt(Math.min(D.totalMi, (r.i + 1) * PHBAND), 0)}, ${wkLabel(w)}: ${tip}</title></rect>`; } });
  const yb = rows.length * rh;
  [['Jan', 1], ['Feb', 5], ['Mar', 9], ['Apr', 14], ['May', 18], ['Jun', 22], ['Jul', 27], ['Aug', 31], ['Sep', 35], ['Oct', 40], ['Nov', 44], ['Dec', 48]].forEach(([m, w]) => { if (w >= w0 && w <= w1) g += `<text x="${f(lab + (w - w0) * cw)}" y="${yb + 12}" font-size="8.5" fill="#A8B8CA">${m}</text>`; });
  if (S.m.yr === 'wk' && S.ph.wk >= w0 && S.ph.wk <= w1) g += `<rect x="${f(lab + (S.ph.wk - w0) * cw)}" y="0" width="${f(cw)}" height="${yb}" fill="none" stroke="#fff" stroke-width="1"/>`;
  g += `<text x="${lab - 4}" y="${f(rows.length * rh + 12)}" text-anchor="end" font-size="7.5" fill="#A8B8CA">▼ Georgia</text></g></svg>`;
  const key = `<div class="phkey"><span><i style="background:linear-gradient(90deg,${ramp.join(',')})"></i>${plant ? 'flowering' : ms === 4 ? 'adult' : 'all'} records, few to most in that stretch</span></div>`;
  return g + key; }
/* cells with a record by each year (a running total), each bar in its year's color; the year shown is outlined */
function phSpreadSvg(lv, cells){ const A = phAgg(lv); if (!A || !A.years.length) return ''; const ys = A.years, sel = S.m.yr ? phYear(lv) : 0;
  const fy = cells.map(c => A.first[c]).filter(v => v != null); if (!fy.length) return '<p class="phstat">No records in these cells yet.</p>';
  const rows = ys.map(y => ({y, n:fy.filter(v => v <= y).length, add:fy.filter(v => v === y).length})), cur = rows.find(r => r.y === sel) || rows[rows.length - 1];
  const mx0 = Math.max(1, rows[rows.length - 1].n), stp = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find(s => mx0 / s <= 4) || 10000, mx = Math.ceil(mx0 / stp) * stp;
  const W = 272, H = 130, pl = 30, pr = 6, pt = 12, pb = 18, pw = W - pl - pr, ph = H - pt - pb, bw = pw / ys.length;
  const X = i => pl + bw * i + bw / 2, Y = v => pt + ph - ph * v / mx, f = v => v.toFixed(1), digits = String(rows[rows.length - 1].n).length;
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cells with records by year">`;
  for (let v = 0; v <= mx; v += stp) g += `<line x1="${pl}" x2="${W - pr}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="${v ? '#2E4460' : '#4A6182'}" stroke-width="${v ? .6 : .9}"/><text x="${pl - 3}" y="${f(Y(v) + 3)}" text-anchor="end" font-size="8.5" fill="#A8B8CA">${fmt(v, 0)}</text>`;
  rows.forEach((r, i) => { if (!r.n) return; const y0 = Y(r.n), on = r === cur && sel;
    g += `<rect x="${f(pl + bw * i + 1)}" y="${f(y0)}" width="${f(Math.max(1, bw - 2))}" height="${f(Y(0) - y0)}" fill="${phFirstCol(r.y)}" stroke="${on ? '#FFFFFF' : '#FDE0C4'}" stroke-opacity="${on ? 1 : .35}" stroke-width="${on ? 2 : .6}" opacity="${sel && r.y > sel ? .25 : 1}"/>`;
    if (bw * 1.1 >= 6 * digits || r === cur) g += `<text x="${f(X(i))}" y="${f(y0 - 2.5)}" text-anchor="middle" font-size="8" fill="${r === cur ? '#FFFFFF' : '#E3EAF2'}"${r === cur ? ' font-weight="700"' : ''}>${fmt(r.n, 0)}</text>`; });
  const every = ys.length > 12 ? 2 : 1;
  rows.forEach((r, i) => { if (i % every === 0 || i === ys.length - 1 || r.y === sel) g += `<text x="${f(X(i))}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="${r.y === sel ? '#FFE014' : '#A8B8CA'}"${r.y === sel ? ' font-weight="700"' : ''}>’${String(r.y).slice(2)}</text>`;
    g += `<rect x="${f(pl + bw * i)}" y="${pt}" width="${f(bw)}" height="${ph + pb}" fill="transparent" pointer-events="none"><title>${r.y}: ${fmt(r.n, 0)} ${r.n === 1 ? 'cell' : 'cells'} with a record by then, ${fmt(r.add, 0)} of them first recorded that year</title></rect>`; });
  return `<p class="phflow">By ${cur.y}, ${fmt(cur.n, 0)} ${cur.n === 1 ? 'cell' : 'cells'} (${({hex:'1 sq mi', cog:'7 sq mi', wheel:'49 sq mi'})[lv] || lv} each) had a record, ${fmt(cur.add, 0)} of them first recorded that year.</p>` + g +
    '</svg><div class="phkey"><span class="thin">cells with a record by each year · <i style="background:linear-gradient(90deg,' + phFirstPal().map(e => e[1]).join(',') + ')"></i>earlier to recent</span></div>'; }
/* Flowering calendar by latitude, drawn like the calendar view of the USA National Phenology Network's visualization tool:
   for each band of latitude, north at the top, the middle 80% and middle 50% of flowering-record dates and the median, 2010 on,
   pooled across years. iNaturalist records are presence-only, so this shows when the plant was photographed in flower, not a
   measured flowering period; bands with fewer than PHLATMIN records are not drawn. */
const PHLAT = [['GA · NC · TN', -90, 37.3], ['VA · WV · MD', 37.3, 39.72], ['PA · NJ · NY', 39.72, 41.6], ['CT · MA · VT', 41.6, 43.6], ['NH · ME', 43.6, 90]], PHLATMIN = 20;
const phLatBand = la => PHLAT.findIndex(b => la >= b[1] && la < b[2]);
const phDoy = d => new Date(2021, 0, d).toLocaleDateString('en-US', {month:'short', day:'numeric'});
function phLatCal(){ const A = phAgg('wheel'); if (!A) return ''; const L_ = D.levels.wheel, yy = S.m.yr === 'wk' ? phYear('wheel') : 0, B = PHLAT.map(() => []);
  for (const [c, L] of (A.d[1] || new Map())){ if (!inSec('wheel', c)) continue; const b = phLatBand(L_.c[c][0]); if (b < 0) continue;
    for (const [d, y] of L) if (y >= PHY0 && (!yy || y === yy)) B[b].push(d); }
  const R = B.map((a, i) => { a.sort((p, q) => p - q); return {i, n:a.length, a, p:a.length >= PHLATMIN ? [.1, .25, .5, .75, .9].map(q => phPct(a, q)) : null}; });
  const has = R.filter(r => r.n); if (!has.length) return '<p class="phstat">No flowering records here since 2010.</p>';
  const P = R.filter(r => r.p), lo = P.length ? Math.min(...P.map(r => r.p[0])) : Math.min(...has.map(r => r.a[0])), hi = P.length ? Math.max(...P.map(r => r.p[4])) : Math.max(...has.map(r => r.a[r.n - 1]));
  const MS = [[1, 'Jan'], [32, 'Feb'], [60, 'Mar'], [91, 'Apr'], [121, 'May'], [152, 'Jun'], [182, 'Jul'], [213, 'Aug'], [244, 'Sep'], [274, 'Oct'], [305, 'Nov'], [335, 'Dec'], [366, '']];
  let d0 = 1; for (const m of MS) if (m[0] <= lo - 5) d0 = m[0]; const d1 = (MS.find(m => m[0] >= hi + 5) || [366])[0];
  const here = S.cell != null && D.levels[S.cellLv] ? phLatBand(D.levels[S.cellLv].c[S.cell][0]) : -1;
  const bp = S.ph.band && S.ph.band.cell === (S.cell == null ? null : S.cellLv + S.cell) ? S.ph.band.i : null;
  let pk = bp != null && R[bp].n ? bp : here >= 0 && R[here].n ? here : has.reduce((m, r) => r.n > m.n ? r : m).i;
  const W = 272, lab = 76, pr = 6, rh = 24, pw = W - lab - pr, f = v => v.toFixed(1), X = d => lab + pw * (d - d0) / (d1 - d0), order = R.slice().reverse(), H = order.length * rh + 16;
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Flowering calendar by latitude">`;
  for (const [d, m] of MS) if (d >= d0 && d <= d1){ g += `<line x1="${f(X(d))}" x2="${f(X(d))}" y1="0" y2="${order.length * rh}" stroke="#2E4460" stroke-width=".6"/>`; if (m && d < d1) g += `<text x="${f(X(d) + 2)}" y="${H - 4}" font-size="8.5" fill="#A8B8CA">${m}</text>`; }
  order.forEach((r, k) => { const y = k * rh, on = r.i === pk, me = r.i === here;
    g += `<g data-phlat="${r.i}" style="cursor:pointer"><rect x="0" y="${y}" width="${W}" height="${rh}" fill="${on ? '#1E3352' : 'transparent'}"/>` +
      `<text x="4" y="${y + 10.5}" font-size="8.5" fill="${me ? '#FFFFFF' : '#C9D4E2'}"${me ? ' font-weight="700"' : ''}>${PHLAT[r.i][0]}</text>` +
      `<text x="4" y="${y + 20}" font-size="7.5" fill="#A8B8CA">${r.n ? fmt(r.n, 0) + (r.n === 1 ? ' record' : ' records') : 'none'}${me ? ' · this cell' : ''}</text>`;
    if (r.p) g += `<rect x="${f(X(r.p[0]))}" y="${y + 7}" width="${f(Math.max(1, X(r.p[4]) - X(r.p[0])))}" height="10" rx="1.5" fill="#E0B400" fill-opacity=".32"/>` +
      `<rect x="${f(X(r.p[1]))}" y="${y + 7}" width="${f(Math.max(1, X(r.p[3]) - X(r.p[1])))}" height="10" rx="1.5" fill="#E0B400"/>` +
      `<rect x="${f(X(r.p[2]) - 1)}" y="${y + 4}" width="2" height="16" fill="#FFFFFF"/>`;
    else g += `<text x="${lab + 4}" y="${y + 15}" font-size="8" fill="#A8B8CA">${r.n ? 'Too few records to draw (' + r.n + ')' : 'No flowering records'}</text>`;
    g += `<title>${PHLAT[r.i][0]}: ${r.p ? `middle 80% of ${fmt(r.n, 0)} flowering records ${phDoy(r.p[0])}–${phDoy(r.p[4])}, middle 50% ${phDoy(r.p[1])}–${phDoy(r.p[3])}, median ${phDoy(r.p[2])}` : r.n ? `${r.n} flowering ${r.n === 1 ? 'record' : 'records'}, fewer than ${PHLATMIN}` : 'no flowering records'}. Click for the weekly chart.</title></g>`; });
  g += '</svg><div class="phkey"><span><i style="background:rgba(224,180,0,.32)"></i>middle 80% of dates</span><span><i style="background:#E0B400"></i>middle 50%</span><span><i style="background:#FFFFFF;width:2px"></i>median</span></div>';
  /* the band picked: share of its flowering records in each week */
  const r = R[pk], w0 = wkOf(d0), w1 = wkOf(Math.min(365, d1 - 1)), wk = new Array(53).fill(0); r.a.forEach(d => wk[wkOf(d)]++);
  const mx = Math.max(1, ...wk), HH = 70, bw = pw / (w1 - w0 + 1);
  let hg = `<svg class="phch" viewBox="0 0 ${W} ${HH + 16}" width="100%" role="img" aria-label="Share of flowering records by week">`;
  for (const [d, m] of MS) if (d >= d0 && d < d1 && m) hg += `<text x="${f(X(d) + 2)}" y="${HH + 12}" font-size="8.5" fill="#A8B8CA">${m}</text>`;
  hg += `<line x1="${lab}" x2="${W - pr}" y1="${HH}" y2="${HH}" stroke="#4A6182" stroke-width=".8"/>`;
  for (let w = w0; w <= w1; w++){ if (!wk[w]) continue; const h_ = Math.max(1, (HH - 4) * wk[w] / mx), x = lab + (w - w0) * bw;
    hg += `<rect data-phw="${w}" x="${f(x + .3)}" y="${f(HH - h_)}" width="${f(Math.max(.8, bw - .6))}" height="${f(h_)}" fill="#E0B400" style="cursor:pointer"><title>${wkLabel(w)}: ${fmt(wk[w], 0)} of ${fmt(r.n, 0)} flowering records (${Math.round(100 * wk[w] / r.n)}%). Click to map this week.</title></rect>`; }
  hg += `<text x="${lab - 4}" y="10" text-anchor="end" font-size="8" fill="#A8B8CA">${Math.round(100 * mx / r.n)}%</text><text x="${lab - 4}" y="${HH}" text-anchor="end" font-size="8" fill="#A8B8CA">0</text></svg>`;
  const mids = P.map(x => x), a = mids[0], z = mids[mids.length - 1];
  const lead = mids.length >= 2 ? `Median flowering record: ${phDoy(a.p[2])} in ${PHLAT[a.i][0]}, ${phDoy(z.p[2])} in ${PHLAT[z.i][0]}.` : mids.length ? `Median flowering record in ${PHLAT[a.i][0]}: ${phDoy(a.p[2])}.` : '';
  return g + `<h4 class="phh">${PHLAT[pk][0]}: share of flowering records by week</h4>` + hg +
    sumD('vsuml', (lead ? `<p class="phflow">${lead}</p>` : '') + `<p class="phnote">Dates of research-grade iNaturalist records annotated as flowering${yy ? ' in ' + yy : ', 2010 on, pooled across years'}, grouped by latitude${S.sec === 'all' ? '' : ' within ' + esc(secName())}. They show when people photographed the plant in flower, not a measured flowering period or the share of plants in flower. Bands with fewer than ${PHLATMIN} records are not drawn. Click a band for its weekly chart, or a week to map it.</p>`); }
function phTrendBlock(){ const sp = phSp(), A = phAgg(dispLevel()); if (!A) return ''; const yyLab = () => (S.m.yr === 'wk' && phYear('wheel') ? phYear('wheel') : 'since 2010') + (S.sec === 'all' ? '' : ', ' + esc(secName())); const where = S.sec === 'all' ? 'the whole trail' : secName();
  let h = '';
  if (SPREADQ()) h += phRangeBlock(dispLevel());
  else {
    h += `<h4 class="phh">When it is ${sp.kind === 'plant' ? 'in flower' : sp.kind === 'adult' ? 'out as adults' : 'recorded'} along the trail${S.m.yr === 'wk' && phYear('wheel') ? ', ' + phYear('wheel') : S.m.yr === 'wk' && phSelText() ? ', ' + esc(phSelText()) : ', all years'}</h4>` + phCalendar() +
      `<details class="phabout" data-phab="cal"${S.ph.ab && S.ph.ab.cal ? ' open' : ''}><summary>About this graph</summary><p class="phnote">${sp.kind === 'plant' ? 'Rows are 200-mile stretches by starting trail mile, north at the top; columns are weeks. Brighter boxes: more flowering records that week, against the stretch’s busiest week, so each stretch shows its season start, peak and end, and the peak moves north.' : 'Rows are 200-mile stretches by starting trail mile, north at the top; columns are weeks.'} Click a week to map it.</p></details>`;
   }
  if (!SPREADQ() && sp.kind === 'plant') h += `<h4 class="phh">Flowering by latitude, ${yyLab()}</h4>` + phLatCal();
  else { const lv = dispLevel(), L_ = D.levels[lv], cells = []; for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c)) cells.push(c);
    const sv = phSpreadSvg(lv, cells), m1 = sv.match(/^<p class="phflow">[\s\S]*?<\/p>/), rest = m1 ? sv.slice(m1[0].length) : sv, m2 = rest.match(/<p class="phstat" style="margin-top:2px">[\s\S]*?<\/p>$/);
    h += `<h4 class="phh">Cells with records, by year, ${esc(where)}</h4>` + (m2 ? rest.slice(0, -m2[0].length) : rest) +
      sumD('vsums', (m1 ? m1[0] : '') + (m2 ? m2[0] : '') + '<p class="phnote">Records follow hikers, so a first record marks when it was noticed, not when it arrived.</p>'); }
  return h; }
/* the cell panel: records by week by stage, and the cell's season */
/* the popup's Priority invasives section: every priority invasive plant the quarterly summary has in the cell(s), by tier,
   each opening its spread map; then the species on show in detail */
function phSection(lv, c){ const sp = phSp(); if (sp.set === 'pinv') return ''; const core = phSectionCore(lv, c); if (!sp.pest || S.q.id !== 'pest') return core;
  const cs = Array.isArray(c) ? c : [c], many = cs.length > 1, seen = new Map();
  cs.forEach(x => (invL('PEST_LIST', lv, x) || []).forEach(i => seen.set(i, (seen.get(i) || 0) + 1)));
  const items = [...seen].map(([i, n]) => { const nm = sppName(i), s = PHSP.find(p => p.pest && p.sci.toLowerCase() === String(nm.sci).toLowerCase()); return {n, nm, s}; })
    .sort((a, b) => (a.nm.common || a.nm.sci).localeCompare(b.nm.common || b.nm.sci));
  const row = x => `<li>${x.s ? `<button type="button" class="linkbtn" data-pestsp="${x.s.key}"${x.s.key === sp.key ? ' aria-current="true"' : ''}>${esc(x.nm.common || x.nm.sci)}</button>` : esc(x.nm.common || x.nm.sci)} <em>${esc(x.nm.sci)}</em>${many ? `<span class="tag">${nCells(x.n)}</span>` : ''}</li>`;
  let L = `<p style="margin:0 0 4px">${items.length ? `${items.length} forest ${items.length === 1 ? 'pest' : 'pests'} recorded ${many ? 'in the selected cells' : 'here'} (iNaturalist and EDDMapS, quarterly summary)${items.some(x => x.s) ? '. Pick one to see its records and map it:' : '.'}` : `No forest pests recorded ${many ? 'in the selected cells' : 'here'} in the quarterly summary.`}</p>`;
  if (items.length) L += `<ul class="spp">${items.map(row).join('')}</ul>`;
  const RX = /(<h3>[^<]*<\/h3>)<p style="margin:0 0 6px"><b>[^<]*<\/b> <i[^>]*>[^<]*<\/i><\/p>/;
  if (!RX.test(core) || S.m.fhr) return `<div class="sec" style="--hue:${HUE.pest}"><h3>Forest pests</h3>${L}</div>`;
  return core.replace(RX, '$1' + L + `<p style="margin:10px 0 4px;font-weight:600">On the map: ${esc(sp.common)}</p>`); }
document.addEventListener('click', e => { const b = e.target.closest('[data-pestsp]'); if (!b) return; const q = Q.find(x => x.id === 'pest'); if (!q) return;
  phPlay(false); S.q = q; if (S.m.fhr || S.m.q !== q && !q.m.includes(S.m)) S.m = q.m.find(x => x.id === 'spread') || S.m; S.ph.sp = b.dataset.pestsp; S.ph.pick = true; S.ph.yr = 0; S.ph.sel = [];
  phLoad(phSp()); BRK.clear(); redraw(); if (S.cell != null || S.box) profile(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-pinvsp]'); if (!b) return; const q = Q.find(x => x.id === 'inv'); if (!q) return;
  phPlay(false); S.q = q; S.m = q.m.find(x => x.pinv && x.id === 'spread') || S.m; S.ph.q = 'pinv'; S.ph.sp = b.dataset.pinvsp; S.ph.pick = true; S.ph.yr = 0; S.ph.sel = [];
  phLoad(phSp()); BRK.clear(); redraw(); if (S.cell != null || S.box) profile(); });
function phSectionCore(lv, c){ const sp = phSp(), A = phAgg(lv), k = sp.kind;
  /* outside the flowering question the records are not fetched just for the panel; the section says how to see them */
  if (!A && !PHQ()) return `<div class="sec" style="--hue:${HUE.phen}"><h3>Flowering</h3><p class="none">Open “When does it flower here?” or “Where are forest pests showing up?” and pick a species to load its records; this section then shows them for any cell.</p></div>`;
  let b = `<div class="sec" style="--hue:${sp.set === 'pinv' ? HUE.pinv : sp.pest ? HUE.pest : HUE.phen}"><h3>${sp.set === 'pinv' ? 'Priority invasives' : sp.pest ? 'Forest pests' : 'Flowering'}</h3><p style="margin:0 0 6px"><b>${esc(sp.common)}</b> <i style="color:var(--muted)">${esc(sp.sci)}</i></p>`;
  if (!A) return b + `<p class="none">${phStatus()}</p></div>`;
  /* c is one cell, or an array of cells for a box or multi-cell selection: weekly counts are added, dates pool the cells' records */
  const cs = Array.isArray(c) ? c : [c], many = cs.length > 1;
  if (!cs.some(x => A.any[x] || (A.eany && A.eany[x]))) return b + `<p class="none">No records of this species in ${many ? 'the selected cells' : 'this cell'}.</p></div>`;
  const ms = phMain(sp), pool = cs.flatMap(x => (A.d[ms].get(x) || []).map(p => p[0])).sort((p, q) => p - q), NM = pool.length;
  const ON = NM >= PHMIN ? phPct(pool, .1) : null, PK = NM >= PHMIN ? phMed(pool) : null, END = NM >= PHMIN ? phPct(pool, .9) : null, LEN = NM >= PHMINLEN ? END - ON : null;
  const FIRST = Math.min(...cs.map(x => A.first[x]).filter(v => v != null));
  const SER = k === 'plant' ? [[3, 'In bud', '#9CCB6B'], [1, 'Flowering', RAMP.phen[3]]] : k === 'adult' ? [[5, 'All records', '#8FA3B8'], [4, 'Adults', '#F08A5D']] : [[5, 'Records', '#C98B6B']];
  const stack = k === 'plant', yy = S.m.yr === 'wk' ? phSelText(lv) : '';
  const at = (s, w) => cs.reduce((t, x) => t + A.w[s][x*53 + w], 0), aty = (s, w) => { const a = yy ? phArr(lv, s) : null; return a ? cs.reduce((t, x) => t + a[x*53 + w], 0) : 0; }, tot = {}, ytot = {};
  let mx = 1; for (let w = 1; w <= 52; w++){ let t = 0; SER.forEach(([s]) => { tot[s] = (tot[s] || 0) + at(s, w); ytot[s] = (ytot[s] || 0) + aty(s, w); t = stack ? t + at(s, w) : Math.max(t, at(s, w)); }); mx = Math.max(mx, t); }
  const W = 255, H = 64, bw = W / 52; let svg = `<svg viewBox="0 0 ${W} ${H + 14}" width="100%" role="img" aria-label="Records by week">`;
  for (let w = 1; w <= 52; w++){ const x = (w - 1) * bw, get = yy ? aty : at;
    if (yy){ let t = 0; SER.forEach(([s]) => { t = stack ? t + at(s, w) : Math.max(t, at(s, w)); }); if (t) svg += `<rect x="${x}" y="${H - H * t / mx}" width="${bw - .6}" height="${H * t / mx}" fill="#A8B8CA" opacity=".28"><title>${wkLabel(w)}, all years: ${t}</title></rect>`; }
    let y0 = H; SER.forEach(([s, lab, col]) => { const v = get(s, w); if (!v) return; const hh = H * v / mx, top = stack ? y0 - hh : H - hh;
      svg += `<rect x="${x}" y="${top}" width="${bw - .6}" height="${hh}" fill="${col}"><title>${wkLabel(w)}${yy ? ', ' + yy : ''}: ${v} ${lab.toLowerCase()}</title></rect>`; if (stack) y0 = top; }); }
  if (yy) svg += `<text x="${W - 2}" y="10" font-size="11" font-weight="700" fill="#FFE014" text-anchor="end">${yy}</text>`;
  if (S.m.yr === 'wk') svg += `<rect x="${(S.ph.wk - 2) * bw}" y="0" width="${bw * 3}" height="${H}" fill="#fff" opacity=".12"/>`;
  ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'].forEach((m, i) => { const w = [9,14,18,22,27,31,35,40][i]; svg += `<text x="${(w - 1) * bw}" y="${H + 12}" font-size="9" fill="#A8B8CA">${m}</text>`; });
  b += svg + '</svg><div class="keys" style="margin-top:6px">' + SER.map(([s, lab, col]) => `<div><i style="background:${col}"></i><span>${lab} records${yy ? ', ' + yy : ''}</span><span>${yy ? fmt(ytot[s], 0) + ' of ' : ''}${fmt(tot[s], 0)}</span></div>`).join('') +
    (yy ? '<div><i style="background:#A8B8CA;opacity:.5"></i><span>All years</span><span></span></div>' : '') + '</div>';
  const noun = phNoun(), few = need => `too few records (${NM}; needs ${need})`;
  b += '<div class="keys nosw" style="margin-top:6px">' + (k === 'spread' ? '' :
      soilRow(`First ${noun} date`, ON == null ? few(PHMIN) : doyDate(ON)) + soilRow(`Peak ${noun} date`, PK == null ? few(PHMIN) : doyDate(PK)) +
      soilRow(`${noun === 'adult' ? 'Adult' : 'Flowering'} season length`, LEN == null ? few(PHMINLEN) : `${Math.round(LEN / 7)} weeks (${doyDate(ON)} to ${doyDate(END)})`)) +
    soilRow(many ? 'First recorded in these cells' : 'First recorded here', String(FIRST)) + (A.eany && cs.some(x => A.eany[x]) ? soilRow('EDDMapS reports', fmt(cs.reduce((t, x) => t + A.eany[x], 0), 0)) : '') + '</div>';
  const note = k === 'plant' ? 'Research-grade iNaturalist records with a flower buds or flowers annotation. Dates pool every year: first is the earliest 10% of flowering records, peak the middle, and the season runs to the latest 10%. Records follow hikers, so they show when people saw it, not how much there is.'
    : k === 'adult' ? 'Research-grade iNaturalist records; adults are those annotated with that life stage, and the dates use them. Records follow observers, so they show when and where it was noticed.'
    : 'Research-grade iNaturalist records of the nematode that causes beech leaf disease, usually photos of the leaf symptoms. Records follow observers, so the first year marks when it was noticed here.';
  return b + `<p class="none" style="font-size:13.5px;margin-top:8px">${many ? 'Combined from the selected cells: weekly records are added, and the dates pool all their records. ' : ''}${note}</p></div>`; }
/* the Results list for these measures: ranked the way each one reads (earliest dates first, longest seasons, most records that week) */
function phSum(lv, rows, where){ const m = S.m, n0 = rows.length, A = phAgg(lv), sp = phSp(); let h = '';
  const rank = (title, rs, show, note) => { const n = Math.min(50, rs.length);
    return `<div class="rank"><h3>${esc(title)}${where}<span class="cnt">${rs.length > n ? 'top ' + n : 'all ' + n}</span></h3><ol class="scroll" tabindex="0" aria-label="${esc(title)}, scrollable list">` +
      rs.slice(0, n).map(r => cellItem(lv, r[0], `<span class="val">${esc(show(r[1]))}</span>`)).join('') + '</ol></div>' + (note || ''); };
  const recs = v => `${fmt(v, 0)} ${v === 1 ? 'record' : 'records'}`, L = r => D.levels[lv].mi[r[0]];
  /* forest pests: every cell with records, ranked by all its records over all weeks and years */
  if (sp.pest && A && m.yr === 'wk'){ const rk = S.ph.rk === 'wk' ? 'wk' : 'all';
    h += `<div class="chips phrk" role="group" aria-label="Rank by"><button type="button" data-phrk="all" aria-pressed="${rk === 'all'}">All weeks and years</button><button type="button" data-phrk="wk" aria-pressed="${rk === 'wk'}">Weeks around ${esc(wkDate(S.ph.wk))}${phYear() ? ', ' + phYear() : ''}</button></div>`;
    if (rk === 'all'){ const all = rows.map(r => [r[0], A.any[r[0]]]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1] || L(a) - L(b));
      return h + selAllBtn(lv, all.map(r => r[0]), sp.common) + rank('Cells with the most records', all, recs); }
    const wk = rows.filter(r => r[1] > 0).sort((a, b) => b[1] - a[1] || L(a) - L(b));
    if (!wk.length) return h + `<p class="statline">None of the ${fmt(n0, 0)} cells with records had any in the three weeks around ${esc(wkDate(S.ph.wk))}${phYear() ? ' in ' + phYear() : ''}. Press Play or pick another week.</p>`;
    return h + selAllBtn(lv, wk.map(r => r[0]), `${sp.common}, weeks around ${wkDate(S.ph.wk)}`) + rank('Cells with the most records these weeks', wk, recs); }
  if (m.yr === 'wk'){ const wk = rows.filter(r => r[1] > 0).sort((a, b) => b[1] - a[1] || L(a) - L(b));
    if (!wk.length) return h + `<p class="statline">None of the ${fmt(n0, 0)} cells with records had any in the three weeks around ${esc(wkDate(S.ph.wk))}${phYear() ? ' in ' + phYear() : ''}. Press Play or pick another week.</p>`;
    h += selAllBtn(lv, wk.map(r => r[0]), `${sp.common}, ${wkDate(S.ph.wk)}`);
    return h + rank(typeof m.sumTitle === 'function' ? m.sumTitle() : m.sumTitle, wk, m.showFn); }
  if (m.id === 'share') rows = rows.filter(r => r[1] > 0);
  rows.sort((a, b) => m.asc ? a[1] - b[1] || L(a) - L(b) : b[1] - a[1] || L(a) - L(b));
  h += selAllBtn(lv, rows.map(r => r[0]), m.label);
  return h + rank(typeof m.sumTitle === 'function' ? m.sumTitle() : m.sumTitle, rows, m.showFn); }
/* ---------- historic resources: National Register (NPS) and cemeteries (OpenStreetMap) ----------
   Normally read from historic_resources.json (built monthly on GitHub, out to the HUC10 shell, with each record's A.T. land tract).
   Three scales: HUC10 shell (every record, on the watershed cells), A.T. corridor (records inside an A.T. administrative area)
   and APPA lands (records on NPS – APPA tracts). Cemeteries are OpenStreetMap only, each one as mapped. */
const HISTSRC = {
  nr:{label:'National Register', url:'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0',
      alt:'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhpTest/MapServer/0',
      fields:'OBJECTID,RESNAME,ResType,NRIS_Refnum,CertDate,Is_NHL,NARA_URL,Address,City,County,State,MultiName,IS_EXTANT', name:'RESNAME'}
};
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const HISTKEEP = 30 * 864e5, HISTKEY = 'atgrid-hist-v2';
let HIST = null;   /* {st:'loading'|'done'|'error', items:[{t:'nr'|'cem', nm, la, lo, a, ld}], at, done, total, err:{}} */
const HAGG = {};
const hsleep = ms => new Promise(r => setTimeout(r, ms));
/* the trail in stretches: wheel cells by trail mile, eight at a time, each with its bounding box */
function histChunks(){ const L_ = D.levels.wheel, cs = L_.id.map((_, c) => c).sort((a, b) => L_.mi[a] - L_.mi[b]), out = [];
  for (let i = 0; i < cs.length; i += 8){ const cells = cs.slice(i, i + 8), rings = cells.map(c => ring('wheel', c)), ll = rings.flat();
    out.push({rings, s:Math.min(...ll.map(p => p[0])) - .01, n:Math.max(...ll.map(p => p[0])) + .01, w:Math.min(...ll.map(p => p[1])) - .01, e:Math.max(...ll.map(p => p[1])) + .01}); }
  return out; }
async function histArc(src, ch){ const out = []; let off = 0, url = src.url;
  for (let pg = 0; pg < 20; pg++){ const q = new URLSearchParams({where:'1=1', geometry:JSON.stringify({xmin:ch.w, ymin:ch.s, xmax:ch.e, ymax:ch.n, spatialReference:{wkid:4326}}), geometryType:'esriGeometryEnvelope',
      inSR:4326, spatialRel:'esriSpatialRelIntersects', outFields:src.fields, returnGeometry:true, outSR:4326, resultOffset:off, resultRecordCount:1000, f:'json'});
    let j; try { const r = await fetch(url + '/query?' + q); if (!r.ok) throw new Error('HTTP ' + r.status); j = await r.json(); if (j.error) throw new Error(j.error.message || 'service error'); }
    catch (e){ if (src.alt && url !== src.alt){ url = src.alt; pg--; continue; } throw e; }
    (j.features || []).forEach(f => { const g = f.geometry; if (g && g.x != null) out.push({a:f.attributes || {}, la:+g.y, lo:+g.x}); });
    if (!j.exceededTransferLimit || !(j.features || []).length) break; off += j.features.length; }
  return out; }
async function histOsm(ch){ const box = `${ch.s},${ch.w},${ch.n},${ch.e}`;
  const body = 'data=' + encodeURIComponent(`[out:json][timeout:90];(nwr["landuse"="cemetery"](${box});nwr["amenity"="grave_yard"](${box}););out center tags;`);
  for (let k = 0; k < 6; k++){ const ep = OVERPASS[k % OVERPASS.length];
    try { const r = await fetch(ep, {method:'POST', body, headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); return (j.elements || []).map(e => ({id:e.type + '/' + e.id, la:e.lat != null ? e.lat : e.center && e.center.lat, lo:e.lon != null ? e.lon : e.center && e.center.lon, tags:e.tags || {}})).filter(e => e.la != null); }
    catch (e){ await hsleep(3000 * (k + 1)); } }
  throw new Error('OpenStreetMap (Overpass) did not answer'); }
/* OpenStreetMap cemeteries, each as mapped */
const histOsmCem = os => os.map(o => ({t:'cem', nm:o.tags.name || '', la:o.la, lo:o.lo, a:{source:'OpenStreetMap', osm:o.id, denomination:o.tags.denomination || '', operator:o.tags.operator || '',
  fag:String(o.tags['ref:find_a_grave'] || '').replace(/\D/g, ''), wikidata:o.tags.wikidata || ''}}));
/* First choice: historic_resources.json beside this page (built monthly on GitHub); then this browser's saved copy; last, live from the services */
const HISTFILE = 'data/historic_resources.json';
/* fileOnly: the cell panel asks for the file alone and never starts the slow live load */
let HISTNOFILE = false;
function histLoad(force, fileOnly){ if (HIST && (HIST.st === 'loading' || (HIST.st === 'done' && !force))) return; if (fileOnly && HISTNOFILE) return;
  HIST = {st:'loading', items:[], done:0, total:0, err:{}};
  (async () => {
    if (!force){ try { const r = await fetch(HISTFILE, {cache:'no-cache'}); if (r.ok){ const x = await r.json(); if (x && Array.isArray(x.items) && x.items.length){ HIST = {st:'done', items:x.items.filter(i => i.t !== 'hs'), at:x.at, err:x.err || {}, from:'file', lands:!!x.lands, scope:x.scope || 'corridor'}; histDone(); return; } } } catch (e) {}
      try { const x = JSON.parse(localStorage.getItem(HISTKEY)); if (x && Array.isArray(x.items) && Date.now() - x.at < HISTKEEP){ HIST = {st:'done', items:x.items, at:x.at, err:x.err || {}, from:'saved'}; histDone(); return; } } catch (e) {} }
    if (fileOnly){ HIST = null; HISTNOFILE = true; histPanel(); return; }
    histLive(); })(); }
const histPanel = () => { if (S.q.id !== 'hist' && (S.cell != null || S.box)) profile(); };
function histDone(){ for (const k in HAGG) delete HAGG[k]; if (S.q.id === 'hist'){ BRK.clear(); redraw(); } else { histStatusOnly(); histPanel(); }
  LIVE.forEach(l => { if (l.local && l.on) liveLoad(l); }); }
/* Administrative filter, three scales: the HUC10 shell (every record, shown on the watershed cells), the A.T. corridor (records inside a tract
   of the A.T. administrative areas layer) and APPA lands (records on NPS – APPA tracts). Each record's tract is looked up when
   historic_resources.json is built (ld: the tract's LEGEND3 class, '' outside every tract). */
const HADM = [['adm', 'A.T. corridor'], ['huc', 'HUC10 watershed']];
const isAppa = ld => /\bAPPA\b/.test(ld || '');   /* NPS – APPA fee, easement and right-of-way tracts, and USFS – APPA administratively transferred lands */
const histScale = () => ['adm', 'huc'].includes(S.hadm) ? S.hadm : S.ext === 'huc' ? 'huc' : 'adm';
const histAdmOn = () => !!(HIST && HIST.lands && histScale() !== 'huc');
const histKeep = x => !histAdmOn() || (histScale() === 'appa' ? isAppa(x.ld) : !!x.ld);
function histAdmBlock(){ const ok = HIST && HIST.st === 'done' && HIST.lands;
  return `<div class="extsw" role="group" aria-label="Extent"><span>Extent</span>` + HADM.map(([k, t]) => `<button type="button" data-hadm="${k}" aria-pressed="${histScale() === k}"${ok || k === 'huc' ? '' : ' disabled'}>${t}</button>`).join('') + '</div>' +
    (S.extMsg ? `<p class="extnote" role="status">${esc(S.extMsg)}</p>` : '') +
    (!HIST || HIST.st !== 'done' ? '<p class="extnote">Available once the historic resources have loaded.</p>'
      : !ok ? `<p class="extnote">The A.T. corridor extent needs each record's land tract, which is added when ${HISTFILE} is built. Run the Historic resources workflow on GitHub again to turn them on.</p>`
      : `<p class="extnote">${histScale() === 'huc' ? 'Every record in the HUC10 watersheds around the trail' : histScale() === 'appa' ? 'Records on NPS – APPA fee, easement, right-of-way easement and administratively transferred tracts' : 'Records inside a tract of the A.T. administrative areas layer'}: ${fmt(histScale() === 'huc' ? HIST.items.length : histScale() === 'appa' ? HIST.items.filter(x => isAppa(x.ld)).length : HIST.items.filter(x => x.ld).length, 0)} in all.</p>`); }
const histAdmText = () => (HADM.find(h => h[0] === histScale()) || HADM[0])[1];
/* the OpenStreetMap cemeteries as a map layer, from the loaded file (no separate request) */
async function histLayer(l, my){
  if (!HIST || HIST.st !== 'done'){ liveStatus(l, 'Loading…'); histLoad(); return; }   // histDone redraws the layer when ready
  const f = HIST.items.filter(x => x.t === (l.hist || 'cem') && histKeep(x)).map(x => ({type:'Feature', geometry:{type:'Point', coordinates:[x.lo, x.la]},
    properties:{NAME:x.nm || '', type:x.a.type || '', listed:x.a.listed || '', nhl:!!x.a.nhl, refnum:x.a.refnum || '', city:x.a.city || '', Source:x.a.source, Denomination:x.a.denomination || '', osm:x.a.osm || '', ld:x.ld || '', fag:x.a.fag || '', la:x.la, lo:x.lo, state:x.a.state || ''}}));
  if (my !== l.req) return; liveDraw(l, f); l.loaded = true; liveStatus(l, f.length ? fmt(f.length, 0) + (histAdmOn() ? ' (' + histAdmText() + ')' : ' out to the HUC10 shell') : 'None in the loaded file'); }
function histLive(){ const chunks = histChunks(); HIST = {st:'loading', items:[], done:0, total:chunks.length, err:{}}; histStatusOnly();
  (async () => { const nr = new Map(), os = new Map(), inCorr = (ch, p) => ch.rings.some(r => inRingLL(p.la, p.lo, r));
    for (const ch of chunks){
      const jobs = [['nr', HISTSRC.nr, nr]].map(async ([k, src, M]) => {
        try { (await histArc(src, ch)).forEach(p => { if (inCorr(ch, p)) M.set(k + ':' + (p.a.OBJECTID != null ? p.a.OBJECTID : p.la + ',' + p.lo), p); }); } catch (e){ HIST.err[k] = e.message; } });
      jobs.push((async () => { try { (await histOsm(ch)).forEach(p => { if (inCorr(ch, p)) os.set(p.id, p); }); await hsleep(1000); } catch (e){ HIST.err.osm = e.message; } })());
      await Promise.all(jobs); HIST.done++; histStatusOnly(); }
    const items = [];
    nr.forEach(p => items.push({t:'nr', nm:p.a.RESNAME || '', la:p.la, lo:p.lo, a:{type:p.a.ResType || '', refnum:p.a.NRIS_Refnum || '', listed:p.a.CertDate ? new Date(p.a.CertDate).toISOString().slice(0, 10) : '',
      nhl:/^y/i.test(String(p.a.Is_NHL || '')), nara:p.a.NARA_URL || '', address:p.a.Address || '', city:p.a.City || '', county:p.a.County || '', state:p.a.State || '', multiple:p.a.MultiName || '', extant:p.a.IS_EXTANT || ''}}));
    histOsmCem([...os.values()]).forEach(x => items.push(x));
    items.forEach(x => { x.la = Math.round(x.la * 1e5) / 1e5; x.lo = Math.round(x.lo * 1e5) / 1e5; });
    HIST = {st:'done', items, at:Date.now(), err:HIST.err, from:'live'};
    if (Object.keys(HIST.err).length < 2) try { localStorage.setItem(HISTKEY, JSON.stringify({at:HIST.at, items, err:HIST.err})); } catch (e) {}
    for (const k in HAGG) delete HAGG[k]; if (S.q.id === 'hist'){ BRK.clear(); redraw(); } })()
  .catch(e => { HIST = {st:'error', msg:e.message, items:[], err:{}}; if (S.q.id === 'hist') side(); }); }
function histRefresh(){ try { localStorage.removeItem(HISTKEY); } catch (e) {} for (const k in HAGG) delete HAGG[k]; HIST = null; histLoad(); side(); }
/* save what was just loaded live as historic_resources.json, to put beside index.html on GitHub */
function histSave(){ if (!HIST || HIST.st !== 'done') return; const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({at:HIST.at, items:HIST.items, err:HIST.err})], {type:'application/json'})); a.download = HISTFILE; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-histsave]')) histSave(); });
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-histref]')) histRefresh(); });
/* items by cell at a size: counts by kind and the list of items in each cell */
function hAgg(lv){ if (!HIST || HIST.st !== 'done') return null; if (HAGG[lv] && HAGG[lv].lev === D.levels[lv]) return HAGG[lv];
  const n = D.levels[lv].id.length, A = HAGG[lv] = {lev:D.levels[lv], nr:new Uint16Array(n), cem:new Uint16Array(n), any:new Uint16Array(n), list:new Map()};
  HIST.items.forEach((x, i) => { if (!histKeep(x)) return; const c = phCell(lv, x.la, x.lo); if (c < 0) return; A[x.t][c]++; A.any[c]++; if (!A.list.has(c)) A.list.set(c, []); A.list.get(c).push(i); });
  return A; }
const hCount = (lv, c, k) => { const A = hAgg(lv); return A ? A[k][c] : null; };
function histStatus(){ if (!HIST || HIST.st === 'loading') return HIST && HIST.total ? `${HISTFILE} was not found, so loading live from the National Park Service and OpenStreetMap… stretch ${HIST.done} of ${HIST.total}. This takes a minute or two; it is then kept in this browser for 30 days.` : 'Loading historic resources…';
  if (HIST.st === 'error') return `Could not load (${esc(HIST.msg || 'error')}). <button type="button" data-histref="1">Try again</button>`;
  const n = t => HIST.items.filter(x => x.t === t).length;
  const errs = Object.keys(HIST.err || {}).map(k => ({nr:'National Register', osm:'OpenStreetMap', lands:'A.T. administrative areas (A.T. corridor extent off)'})[k] || k);
  const when = new Date(HIST.at).toLocaleDateString('en-US');
  return `${fmt(n('nr'), 0)} National Register properties and ${fmt(n('cem'), 0)} OpenStreetMap cemeteries${HIST.scope === 'huc' ? ' out to the HUC10 shell' : ' in corridor cells'}. ` +
    (HIST.from === 'file' ? '' : `Loaded live ${when}. <button type="button" data-histsave="1">Save as ${HISTFILE}</button> to put beside index.html on GitHub for fast loading.`) +
    (errs.length && HIST.from !== 'file' ? ` <b>Not reached: ${esc(errs.join(', '))}</b>; those counts are incomplete.` : '') + (HIST.from === 'file' ? '' : ` <button type="button" data-histref="1">Refresh</button>`); }
function histStatusOnly(){ const e = document.getElementById('histstat'); if (e) e.innerHTML = histStatus(); }
const histBlock = () => `<p class="phstat" id="histstat" role="status" style="margin:2px 0 10px">${histStatus()}</p>`;
/* Find a Grave: the cemetery page when its ID is known; otherwise a web search of findagrave.com for the name and state
   (Find a Grave's own search page does not take a name in its link). The state comes from the nearest trail mile; along the
   North Carolina – Tennessee line it is left out. */
const HSTATE = {GA:'Georgia', TN:'', VA:'Virginia', MD:'Maryland', PA:'Pennsylvania', NJ:'New Jersey', NY:'New York', CT:'Connecticut', MA:'Massachusetts', VT:'Vermont', NH:'New Hampshire', ME:'Maine', NC:''};
function histStateOf(la, lo){ if (la == null) return ''; const c = phCell('wheel', la, lo); if (c < 0) return ''; const m = D.levels.wheel.mi[c] / ELEVK(); let st = ELEVSTATES[0][1];
  for (const [b, , n] of ELEVSTATES) if (m >= b) st = n; return HSTATE[st] || ''; }
const histFagUrl = x => x.a.fag ? 'https://www.findagrave.com/cemetery/' + encodeURIComponent(x.a.fag)
  : x.nm ? 'https://www.google.com/search?q=' + encodeURIComponent([x.nm, histStateOf(x.la, x.lo), 'site:findagrave.com/cemetery'].filter(Boolean).join(' ')) : '';
const histFag = x => { const u = histFagUrl(x); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${x.a.fag ? 'Find a Grave' : 'look up on Find a Grave'}</a>` : ''; };
/* the cell panel section */
function histSection(lv, c){ const A = hAgg(lv);
  let b = `<div class="sec" style="--hue:${HUE.hist}"><h3>Historic resources</h3>`;
  if (!A && !HIST) histLoad(false, true);   // load historic_resources.json for the panel, whatever the question
  if (!A) return b + `<p class="none">${HIST && HIST.st === 'loading' ? 'Loading historic resources…' : HIST && HIST.st === 'error' ? histStatus() : 'Open “Where are the historic resources?” to load the National Register and cemeteries; this section then lists them for any cell.'}</p></div>`;
  /* c is one cell, or an array of cells for a box or multi-cell selection */
  const cs = Array.isArray(c) ? c : [c], many = cs.length > 1, ids = cs.flatMap(x => A.list.get(x) || []);
  if (histAdmOn()) b += `<p class="none" style="font-size:13.5px;margin:0 0 6px">Extent: ${esc(histAdmText())} only.</p>`;
  if (!ids.length) return b + `<p class="none">No National Register properties or cemeteries recorded ${histAdmOn() ? 'on ' + esc(histAdmText().toLowerCase()) + ' ' : ''}in ${many ? 'the selected cells' : 'this cell'}.</p></div>`;
  const it = ids.map(i => HIST.items[i]), grp = t => it.filter(x => x.t === t).sort((p, q) => p.nm.localeCompare(q.nm));
  const NR = grp('nr'), CM = grp('cem');
  b += `<div class="facts"><div><b>${NR.length || 'None'}</b>National Register</div><div><b>${CM.length || 'None'}</b>cemeteries</div></div>` + (many ? `<p class="none" style="font-size:13.5px;margin:6px 0 0">In ${cs.filter(x => (A.list.get(x) || []).length).length} of the ${cs.length} selected cells.</p>` : '');
  const li = (x, extra) => `<li><span>${esc(x.nm || 'Unnamed')}</span><em>${[extra, x.ld ? esc((LANDMAP.get(x.ld) || [0, tcase(x.ld)])[1]) : ''].filter(Boolean).join(' · ')}</em></li>`;
  if (NR.length) b += `<p style="margin:8px 0 0">National Register of Historic Places</p><ul class="flist hlist">` + NR.map(x => li(x, [x.a.type, x.a.listed ? 'listed ' + x.a.listed.slice(0, 4) : '', x.a.nhl ? '<b>National Historic Landmark</b>' : '',
    x.a.refnum ? `<a href="https://npgallery.nps.gov/AssetDetail/NRIS/${encodeURIComponent(x.a.refnum)}" target="_blank" rel="noopener">NPGallery</a>` : '', x.a.nara ? `<a href="${esc(x.a.nara)}" target="_blank" rel="noopener">nomination</a>` : ''].filter(Boolean).join(' · '))).join('') + '</ul>';
  if (CM.length) b += `<p style="margin:8px 0 0">Cemeteries</p><ul class="flist hlist">` + CM.map(x => li(x, [x.a.denomination ? esc(x.a.denomination) : '',
    x.a.osm ? `<a href="https://www.openstreetmap.org/${esc(x.a.osm)}" target="_blank" rel="noopener">map</a>` : '', histFag(x)].filter(Boolean).join(' · '))).join('') + '</ul>';
  return b + `<p class="none" style="font-size:13.5px;margin-top:8px">National Register: NPS. Cemeteries: OpenStreetMap, each as mapped (two nearby records can be parts of one cemetery). Find a Grave: the cemetery's page where OpenStreetMap or Wikidata records its Find a Grave ID, otherwise a web search of findagrave.com for the name and state. Small family cemeteries are often missing. Locations of some National Register sites are generalized or restricted.</p></div>`; }
/* ---------- restoration targets ----------
   Two scores from 0 to 100, worked out here from the other layers. Each factor is scaled 0 to 1 and given points; wetlands take
   points away, since nearby wetlands can limit herbicide use. Counts and acres are scaled by where a cell ranks among the cells of
   its size that have any (a cell with none scores 0); rare species, vistas and soils use their own 0 to 1 values.
   Only A.T. corridor lands count: habitat acres come from the vegetation map of the corridor lands and are capped at the corridor
   land in the cell, wetlands are those on A.T. lands, and a cell needs at least one acre of open habitat (grasslands) or forest
   (forests) on corridor lands to get a score. Edit the points here. */
const RESTDEF = {
  grass: {label:'Grasslands and early successional', gate:'open', none:'No open habitat mapped', wet:10, parts:[
    ['open', 'Open habitat', 20], ['rare', 'Rare species nearby', 15], ['inv', 'Priority invasive plants', 10],
    ['soil', 'Soils suited to grassland mgmt.', 15], ['birds', 'Grassland and shrubland birds', 25], ['vista', 'Vistas', 15]]},
  forest: {label:'Forests', gate:'forest', none:'No forest mapped', wet:10, parts:[
    ['forest', 'Forest', 20], ['rare', 'Rare species nearby', 20], ['pest', 'Forest pests', 20],
    ['inv', 'Priority invasive plants', 20], ['hiker', 'Hiker gathering spots', 20]]}};
const RW = {grass:Object.fromEntries(RESTDEF.grass.parts.map(p => [p[0], p[2]])), forest:Object.fromEntries(RESTDEF.forest.parts.map(p => [p[0], p[2]]))};
const RWD = {grass:null, forest:null};   /* weights being edited, per score; RW (what the scores use) changes only on Apply */
const RNOTE = {open:'Acres of open habitat on corridor lands, ranked among cells: the larger of the vegetation map’s herbaceous, shrub and agricultural acres and the maintained landscapes (meadows and fields, farm fields and balds) in the A.T. facilities inventory, since the vegetation map does not cover all A.T. lands', forest:'Acres of forest on corridor lands, ranked among cells',
  rare:'Rare species priority zone rating: very highly sensitive counts in full, highly two thirds, moderately one third', inv:'Priority invasive plant species reported to iNaturalist or EDDMapS, ranked among cells',
  pest:'Forest pest species reported to iNaturalist or EDDMapS, ranked among cells', soil:'Share of the soils in land capability classes 1 to 4, suited to grassland management (NRCS)',
  birds:'Grassland and shrubland bird species on eBird checklists, ranked among cells', vista:'Any vista in the cell (A.T. facilities inventory)',
  hiker:'Shelters, privies, bridges, campsites and parking areas, ranked among cells: where hikers gather'};
const TIERVAL = {'Avoid':1, 'Minimize':2/3, 'Standard Review':1/3};
/* Private land is left out: from the land administrators layer (the administrative areas), the habitat points are multiplied by the
   share of the mapped corridor land in the cell that is not private. Every other administrator counts the same (multiplier 1). */
const LANDCLASS = [['appa', 'NPS - APPA', 1], ['fed', 'Other NPS and federal', 1], ['state', 'State', 1], ['other', 'Other (local, land trusts, ATC, clubs)', 1], ['priv', 'Private or unknown', 0]];
function landClass(name){ if (name === 'NPS - APPA') return 'appa'; if (/^Private/.test(name)) return 'priv';
  if (/^NPS|US Forest Service|United States Fish|Department of Defense|Tennessee Valley|Natural Resources Conservation|Smithsonian/.test(name)) return 'fed';
  if (/^State of|Maine Bureau|Inland Fisheries|Vermont Department/.test(name)) return 'state'; return 'other'; }
function restLand(lv, c){ const r = val('lands','MGRS',lv,c) || [], sh = {appa:0, fed:0, state:0, other:0, priv:0}; let tot = 0;
  for (let i = 0; i < r.length; i += 2){ sh[landClass(D.cats.MGR[r[i]])] += r[i+1]; tot += r[i+1]; }
  if (!tot) return [0, sh]; for (const k in sh) sh[k] = 100 * sh[k] / tot;
  return [S.appa ? sh.appa / 100 : LANDCLASS.reduce((t, [k, , m]) => t + m * sh[k] / 100, 0), sh]; }
const landText = sh => LANDCLASS.filter(([k]) => sh[k] >= .5).map(([k, lab]) => `${k === 'appa' ? 'APPA' : k === 'fed' ? 'NPS/federal' : k === 'priv' ? 'private' : lab.split(' (')[0].toLowerCase()} ${fmt(sh[k], 0)}%`).join(', ');
function restTier(lv, c){ let plv = lv, pc = c; if (!D.themes.nrpz[lv]){ const p = parentOf(lv, c); if (!p) return null; plv = p[0]; pc = p[1]; }
  if (!D.themes.nrpz[plv]) return null; const t = val('nrpz','review_tie',plv,pc); return t == null ? null : D.cats.review_tie[t]; }
function restRaw(k, lv, c){ const v = (th, f) => val(th, f, lv, c) || 0, va = val('veg','VEG_AREA',lv,c);
  switch (k){
    case 'open': { const vm = va == null ? null : va * (v('veg','L1_HERB') + v('veg','L1_SHRUB') + v('veg','L1_AGRIC')) / 100, ml = val('feat','ML_AC',lv,c);
      if (vm == null && !ml) return null; const la = val('lands','LAND_AC',lv,c), x = Math.max(vm || 0, ml || 0); return la ? Math.min(x, la) : x; }
    case 'forest': return va == null ? null : Math.min(va * v('veg','L1_FOREST') / 100, v('lands','LAND_AC'));
    case 'rare': { const t = restTier(lv, c); return t ? TIERVAL[t] || 0 : 0; }
    case 'inv': return (invL('EDRR_LIST',lv,c) || []).length;
    case 'pest': return (invL('PEST_LIST',lv,c) || []).length;
    case 'soil': { const x = val('soil','LCC14',lv,c); return x == null ? 0 : x / 100; }
    case 'birds': return v('ebird','GRASS_SPP') + v('ebird','SHRUB_SPP');
    case 'vista': return v('feat','N_VISTA');
    case 'hiker': return v('feat','N_SHELTER') + v('feat','N_PRIVY') + v('feat','N_BRIDGE') + v('feat','N_CAMPSITE') + v('feat','N_PARKING');
    case 'wet': { const la = v('wet','LANDS_AC'); return la > 0 ? Math.min(100, 100 * v('wet','L_WET_AC') / la) : 0; } } }
const RESTC = {};
function restScale(k, lv, c){ const x = restRaw(k, lv, c);
  if (k === 'rare' || k === 'soil') return x || 0;
  if (k === 'vista') return x > 0 ? 1 : 0;
  if (!(x > 0)) return 0;
  let R = RESTC[lv]; if (!R || R.lev !== D.levels[lv]) R = RESTC[lv] = {lev:D.levels[lv]};
  if (!R[k]){ const a = []; for (let i = 0; i < D.levels[lv].id.length; i++){ const y = restRaw(k, lv, i); if (y > 0) a.push(y); } R[k] = a.sort((p, q) => p - q); }
  const a = R[k]; let lo = 0, hi = a.length; while (lo < hi){ const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid + 1; else hi = mid; }
  return a.length ? lo / a.length : 0; }
/* one score with its parts: [score or null, [[key, label, points, max, raw]], wetland points taken, land multiplier, land shares, points before the multiplier] */
function restParts(kind, lv, c){ const d = RESTDEF[kind], g = restRaw(d.gate, lv, c);
  if (g == null || g < 1) return [null, [], 0, 0, {}, 0];
  const W = RW[kind], parts = d.parts.map(([k, lab]) => [k, lab, (+W[k] || 0) * restScale(k, lv, c), +W[k] || 0, restRaw(k, lv, c)]);
  const wT = d.parts.reduce((t, p) => t + (+W[p[0]] || 0), 0), lockW = JERRY ? 0 : (+W.rare || 0), scale = lockW && wT > lockW ? wT / (wT - lockW) : 1;
  const wet = S.herb ? d.wet * restScale('wet', lv, c) : 0, pts = Math.max(0, parts.reduce((t, p) => t + p[2], 0) * scale - wet), [mult, sh] = restLand(lv, c);
  return [Math.max(0, Math.min(100, Math.round(pts * mult))), parts, wet, mult, sh, pts]; }
const restScore = (kind, lv, c) => { if (!has('veg', lv, c)) return null; const r = restParts(kind, lv, c); return S.appa && r[0] != null && (!(r[4] && r[4].appa > 0) || r[0] === 0) ? null : r[0]; };
function restRawText(k, x, lv, c){ switch (k){
  case 'open': { const ml = val('feat','ML_AC',lv,c); return fmt(x, 0) + ' acres on corridor lands' + (ml && ml >= x - .5 ? ', from the maintained landscapes inventory' : ''); }
  case 'forest': return fmt(x, 0) + ' acres on corridor lands';
  case 'rare': { if (!JERRY) return 'not shown; other factors scaled to 100'; const t = restTier(lv, c); return t ? (CATCOL.review_tie.find(e => e[0] === t) || [0,0,t])[2] : 'none rated'; }
  case 'inv': return x ? `${x} ${x === 1 ? 'species' : 'species'}` : 'none reported';
  case 'pest': return x ? `${x} ${x === 1 ? 'species' : 'species'}` : 'none reported';
  case 'soil': return x ? fmt(x * 100, 0) + '% class 1 to 4' : 'no rated soils';
  case 'birds': return x ? `${x} species` : 'none recorded';
  case 'vista': return x ? `${x} ${x === 1 ? 'vista' : 'vistas'}` : 'none';
  case 'hiker': return x ? `${x} ${x === 1 ? 'site' : 'sites'}` : 'none'; } }
const restNote = kind => RESTDEF[kind].parts.map(p => `${p[1]} ${fmt(+RW[kind][p[0]] || 0, (+RW[kind][p[0]] || 0) % 1 ? 1 : 0)}`).join(', ') + `; with herbicide use on, wetlands up to −${RESTDEF[kind].wet}.`;
function restSection(lv, c){ if (!has('veg', lv, c)) return '';
  let b = `<div class="sec" style="--hue:${HUE.rest}"><h3>Restoration targets</h3>`;
  for (const kind of S.m.id === 'forest' && S.q.id === 'rest' ? ['forest', 'grass'] : ['grass', 'forest']){ const d = RESTDEF[kind], [s, parts, wet, mult, sh, pts] = restParts(kind, lv, c);
    b += `<p style="margin-top:8px"><b>${d.label}:</b> ${s == null ? d.none.toLowerCase() : `<b>${s}</b> of 100`}</p>`;
    if (s == null) continue;
    b += '<div class="keys nosw">' + parts.map(([k, lab, pts, w, x]) => soilRow(`${lab} <span style="color:var(--muted)">(${restRawText(k, x, lv, c)})</span>`, ptsOf(pts, w))).join('') +
      soilRow(`Wetlands <span style="color:var(--muted)">(${fmt(restRaw('wet', lv, c), 1)}% of A.T. lands${S.herb ? '' : '; herbicide use off'})</span>`, !S.herb ? '–' : wet >= .5 ? '−' + Math.round(wet) : '0') +
      soilRow('<b>Habitat points</b>', `<b>${Math.round(pts)}</b>`) + soilRow(`${S.appa ? 'Share APPA land' : 'Share not private'} <span style="color:var(--muted)">(${landText(sh) || 'no mapped land'})</span>`, '×' + fmt(mult, 2)) + '</div>'; }
  return b + '<p class="none" style="font-size:13.5px;margin-top:8px">Scores rank cells for a closer look; they are worked out from the other layers on this page and are not a site assessment. Counts and acres are scored by how a cell ranks among cells of its size.</p></div>'; }
function restBox(lv, cells){ if (!D.themes.veg || !D.themes.veg[lv]) return ''; const L_ = D.levels[lv], N = cells.length;
  let b = `<div class="sec" style="--hue:${HUE.rest}"><h3>Restoration targets</h3>`;
  const avg = a => a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0, sum = a => a.reduce((t, x) => t + x, 0);
  const union = f => { const u = new Set(); cells.forEach(c => ((EDDF[f] ? invL(f, lv, c) : val('inat', f, lv, c)) || []).forEach(x => u.add(x))); return u.size; };
  const kinds = S.m.id === 'forest' && S.q.id === 'rest' ? ['forest', 'grass'] : ['grass', 'forest'];
  for (const kind of kinds){ const d = RESTDEF[kind], R = cells.map(c => [c, has('veg', lv, c) ? restParts(kind, lv, c) : null]).filter(x => x[1] && x[1][0] != null);
    if (!R.length){ b += `<p style="margin-top:8px"><b>${d.label}:</b> ${d.none.toLowerCase()} in the selected cells</p>`; continue; }
    const sc = R.map(x => x[1][0]), best = R.reduce((p, q) => q[1][0] > p[1][0] ? q : p), cs = R.map(x => x[0]);
    b += `<p style="margin-top:8px"><b>${d.label}:</b> <b>${Math.round(avg(sc))}</b> of 100 on average <span style="color:var(--muted)">(${Math.min(...sc)} to ${Math.max(...sc)}; ${R.length} of ${N} cells scored; best near mile ${fmt(L_.mi[best[0]], 0)})</span></p>`;
    const raw = k => cs.map(c => restRaw(k, lv, c) || 0);
    const rawText = k => { const x = raw(k);
      switch (k){
        case 'open': case 'forest': return fmt(sum(x), 0) + ' acres on corridor lands';
        case 'rare': { const tiers = cs.map(c => restTier(lv, c)).filter(Boolean), top = ['Avoid', 'Minimize', 'Standard Review'].find(t => tiers.includes(t));
          return top ? `${(CATCOL.review_tie.find(e => e[0] === top) || [0, 0, top])[2].toLowerCase()} in ${tiers.filter(t => t === top).length} of ${cs.length} cells` : 'none rated'; }
        case 'inv': { const n = union('EDRR_LIST'); return n ? `${n} species across the cells` : 'none reported'; }
        case 'pest': { const n = union('PEST_LIST'); return n ? `${n} species across the cells` : 'none reported'; }
        case 'soil': return `${fmt(avg(x) * 100, 0)}% class 1 to 4 on average`;
        case 'birds': return Math.max(...x) ? `up to ${Math.max(...x)} species in a cell` : 'none recorded';
        case 'vista': return sum(x) ? `${sum(x)} ${sum(x) === 1 ? 'vista' : 'vistas'}` : 'none';
        case 'hiker': return sum(x) ? `${sum(x)} ${sum(x) === 1 ? 'site' : 'sites'}` : 'none';
        default: return ''; } };
    const parts = R[0][1][1].map(([k, lab, , w], pi) => [k, lab, avg(R.map(r => r[1][1][pi][2])), w]);
    const wet = avg(R.map(r => r[1][2])), pts = avg(R.map(r => r[1][5])), mult = avg(R.map(r => r[1][3]));
    const lac = cs.map(c => val('lands', 'LAND_AC', lv, c) || 0), tot = sum(lac), sh = {};
    LANDCLASS.forEach(([k]) => { sh[k] = tot ? sum(R.map((r, i) => (r[1][4][k] || 0) * lac[i])) / tot : 0; });
    const wetPct = avg(cs.map(c => restRaw('wet', lv, c) || 0));
    b += '<div class="keys nosw">' + parts.map(([k, lab, p, w]) => soilRow(`${lab} <span style="color:var(--muted)">(${rawText(k)})</span>`, ptsOf(p, w))).join('') +
      soilRow(`Wetlands <span style="color:var(--muted)">(${fmt(wetPct, 1)}% of A.T. lands on average${S.herb ? '' : '; herbicide use off'})</span>`, !S.herb ? '–' : wet >= .5 ? '−' + Math.round(wet) : '0') +
      soilRow('<b>Habitat points</b>', `<b>${Math.round(pts)}</b>`) +
      soilRow(`${S.appa ? 'Share APPA land' : 'Share not private'} <span style="color:var(--muted)">(${landText(sh) || 'no mapped land'})</span>`, '×' + fmt(mult, 2)) + '</div>'; }
  /* each cell's two scores */
  const rows = cells.map(c => [c, restScore(kinds[0], lv, c), restScore(kinds[1], lv, c)]).filter(r => r[1] != null || r[2] != null).sort((p, q) => (q[1] ?? -1) - (p[1] ?? -1) || L_.mi[p[0]] - L_.mi[q[0]]);
  if (rows.length) b += `<details style="margin-top:8px"><summary>Scores by cell (${rows.length})</summary><div class="keys nosw">` +
    `<div><span style="color:var(--muted)">Cell</span><span style="color:var(--muted)">${RESTDEF[kinds[0]].label.split(' ')[0]} · ${RESTDEF[kinds[1]].label.split(' ')[0]}</span></div>` +
    rows.map(([c, a, f]) => `<div><span>Mile ${fmt(L_.mi[c], 0)} <em style="color:var(--muted);font-style:normal;font-size:13px">${esc(L_.id[c])}</em></span><span>${a ?? '–'} · ${f ?? '–'}</span></div>`).join('') + '</div></details>';
  return b + '<p class="none" style="font-size:13.5px;margin-top:8px">Combined from the selected cells: points, habitat points and the land multiplier are averaged over the scored cells; acres, vistas and sites are added; species are counted once. Scores rank cells for a closer look and are not a site assessment.</p></div>'; }
const wetAc = v => v == null ? '–' : v === 0 ? 'none' : v < 0.1 ? 'under 0.1 acre' : fmt(v, v < 10 ? 1 : 0) + (v === 1 ? ' acre' : ' acres');
const soilPct = x => x == null ? 'not rated' : x === 0 ? '0%' : pctLt1(x);
/* ---------- plants of cultural significance ----------
   cultural_plants.csv, compiled from the Greenbelt Indigenous Botanical Survey (Plenty Canada; Kanienʼkéha and Anishinaabemowin names, uses
   from Waugh, Tantaquidgeon, Densmore and knowledge holders), Mooney 1891, Tantaquidgeon 1942, the Haudenosaunee Confederacy and Cherokee and
   Wabanaki sources, matched to research-grade iNaturalist records in the quarterly summary (CULT_LIST). Plants that are dug or poached
   (ginseng, goldenseal, ramps, lady's slippers) are listed only in 49 sq mi cells.
   Each entry: [scientific name, common name, (unused), (unused), (unused), status, sensitive, sources, source link, other names] */
const CULTD = [["Acer rubrum","Red Maple","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/sugar-maple-red-maple-and-silver-maple",""],["Acer saccharinum","Silver Maple","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/sugar-maple-red-maple-and-silver-maple",""],["Acer saccharum","Sugar Maple","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Haudenosaunee Confederacy, Ceremonies","https://gibsurvey.ca/species/sugar-maple-red-maple-and-silver-maple",""],["Achillea millefolium","Yarrow","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/yarrow",""],["Adiantum pedatum","Maidenhair Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Mooney 1891, Sacred Formulas of the Cherokees","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive",""],["Allium canadense","Wild Onion","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-onions-nodding-onion-field-garlic",""],["Allium tricoccum","Wild Leek","","","","Native","Y","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | NC Health News 2016","https://gibsurvey.ca/species/wild-leek",""],["Allium vineale","Field Garlic","","","","Non-native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-onions-nodding-onion-field-garlic",""],["Alnus incana","Speckled Alder","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/paper-birch-black-birch-yellow-birch-and-speckled-alder",""],["Amphicarpaea bracteata","Hog Peanut","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/hopniss-and-hog-peanut",""],["Apios americana","Hopniss","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/hopniss-and-hog-peanut",""],["Apocynum androsaemifolium","Spreading Dogbane","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/spreading-dogbane",""],["Arctium lappa","Burdock","","","","Non-native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/burdock",""],["Arctostaphylos uva-ursi","Bearberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bearberry",""],["Arisaema triphyllum","Jack-in-the-pulpit","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Upstate Forever","https://gibsurvey.ca/species/jack-pulpit",""],["Aristolochia serpentaria","Virginia snakeroot","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Endodeca serpentaria"],["Arnoglossum atriplicifolium","Pale Indian plantain","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Cacalia atriplicifolia"],["Arundinaria appalachiana","Hill cane","","","","Native","","Cherokee One Feather 2012","https://theonefeather.com/2012/05/22/river-cane-important-cherokee-cultural-staple/",""],["Arundinaria gigantea","River cane","","","","Native","","Cherokee One Feather 2012","https://theonefeather.com/2012/05/22/river-cane-important-cherokee-cultural-staple/",""],["Asarum canadense","Wild Ginger","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-ginger",""],["Asclepias syriaca","Common Milkweed","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/common-milkweed",""],["Asimina triloba","Pawpaw","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/pawpaw",""],["Asplenium rhizophyllum","Walking fern","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Camptosorus rhizophyllus"],["Athyrium filix-femina","Lady Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive",""],["Betula alleghaniensis","Yellow Birch","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/paper-birch-black-birch-yellow-birch-and-speckled-alder",""],["Betula lenta","Black Birch","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/paper-birch-black-birch-yellow-birch-and-speckled-alder",""],["Betula papyrifera","Paper Birch","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Maine DOE Wabanaki Studies 2024","https://gibsurvey.ca/species/paper-birch-black-birch-yellow-birch-and-speckled-alder",""],["Caltha palustris","Marsh Marigold","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/marsh-marigold",""],["Cardamine diphylla","Pepper Root","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/pepper-root",""],["Carpinus caroliniana","Musclewood","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/ironwood-musclewood",""],["Carya cordiformis","Bitternut Hickory","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/shagbark-hickory-bitternut-hickory-and-shellbark-hickory",""],["Carya laciniosa","Shellbark Hickory","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/shagbark-hickory-bitternut-hickory-and-shellbark-hickory",""],["Carya ovata","Shagbark Hickory","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/shagbark-hickory-bitternut-hickory-and-shellbark-hickory",""],["Castanea dentata","American chestnut","","","","Native","","TACF 2021","https://tacf.org/bringing-the-chestnut-home-eastern-band-of-cherokee-indians-partner-with-tacf/",""],["Cerastium fontanum","Common mouse-ear chickweed","","","","Non-native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Cerastium vulgatum"],["Coptis trifolia","Goldthread","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/goldthread",""],["Crataegus mollis","Downy Hawthorn","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/downy-hawthorn-quebec-hawthorn",""],["Crataegus submollis","Québec Hawthorn","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/downy-hawthorn-quebec-hawthorn",""],["Cypripedium acaule","Pink Lady's-Slipper","","","","Native","Y","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Upstate Forever","https://gibsurvey.ca/species/pink-ladys-slipper-yellow-ladys-slipper-showy-ladys-slipper-broad-leaf-helleborine-orchid",""],["Cypripedium parviflorum","Yellow Lady's-Slipper","","","","Native","Y","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Mooney 1891, Sacred Formulas of the Cherokees","https://gibsurvey.ca/species/pink-ladys-slipper-yellow-ladys-slipper-showy-ladys-slipper-broad-leaf-helleborine-orchid",""],["Erythronium americanum","Trout Lily","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/trout-lily",""],["Eupatorium perfoliatum","Boneset","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/boneset-joe-pye-weed",""],["Euphorbia hypericifolia","Graceful sandmat","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Eutrochium maculatum","Joe Pye Weed","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/boneset-joe-pye-weed","Eupatorium maculatum"],["Eutrochium purpureum","Sweet-scented Joe-pye weed","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Eupatorium purpureum"],["Eutrochium spp.","Joe-pye weed","","","","Native","","Upstate Forever","https://www.upstateforever.org/blog/flora-fauna/local-plants-and-their-uses-by-the-cherokee",""],["Fragaria vesca","Woodland Strawberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-strawberry-woodland-strawberry-and-mock-strawberry",""],["Fragaria virginiana","Wild Strawberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Haudenosaunee Confederacy, Ceremonies","https://gibsurvey.ca/species/wild-strawberry-woodland-strawberry-and-mock-strawberry",""],["Fraxinus americana","White Ash","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/black-ash-green-ash-and-white-ash",""],["Fraxinus nigra","Black Ash","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Hudson Museum; EAB Information Network","https://gibsurvey.ca/species/black-ash-green-ash-and-white-ash",""],["Gaultheria procumbens","Wintergreen","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wintergreen",""],["Geranium maculatum","Wild geranium","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Gillenia trifoliata","Bowman's root, Indian physic","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Porteranthus trifoliatus"],["Hackelia virginiana","Beggar lice","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Cynoglossum Morrisoni"],["Helianthus annuus","Common sunflower","","","","Cultivated","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/sunchoke-sunflower",""],["Helianthus tuberosus","Sunchoke","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/sunchoke-sunflower",""],["Hepatica acutiloba","Sharp-lobed Hepatica","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Mooney 1891, Sacred Formulas of the Cherokees","https://gibsurvey.ca/species/round-lobed-hepatica-sharp-lobed-hepatica","Anemone acutiloba"],["Hierochloe odorata","Sweetgrass","","","","Native","","Agriculture Canada; Hudson Museum","https://agriculture.canada.ca/en/science/story-agricultural-science/scientific-achievements-agriculture/restoring-sweetgrass-w8banaki","Anthoxanthum nitens; Anthoxanthum hirtum"],["Hydrastis canadensis","Goldenseal","","","","Native","Y","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/goldebseal",""],["Hypericum punctatum","Spotted St. John's-wort","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Hypericum corymbosum"],["Juglans cinerea","Butternut","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Traditional Cherokee dyes; RTCAR","https://gibsurvey.ca/species/butternut-black-walnut",""],["Juglans nigra","Black Walnut","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Traditional Cherokee dyes","https://gibsurvey.ca/species/butternut-black-walnut",""],["Juniperus communis","Juniper","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-cedar-red-cedar-and-common-juniper",""],["Juniperus virginiana","Eastern Red Cedar","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-cedar-red-cedar-and-common-juniper",""],["Leonurus cardiaca","Motherwort","","","","Non-native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/motherwort",""],["Lindera benzoin","Spicebush","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/spicebush",""],["Maianthemum racemosum","False Solomon's Seal","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/false-solomons-seal-solomons-seal",""],["Malus spp.","Apple","","","","Non-native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/apple",""],["Matteuccia struthiopteris","Ostrich Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive",""],["Mentha arvensis","Wild Mint","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-mint",""],["Mitchella repens","Partridge Berry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/partridge-berry",""],["Nicotiana rustica","Sacred (Indian) tobacco","","","","Cultivated","","Mooney & Olbrechts 1932, The Swimmer Manuscript | Tantaquidgeon 1942, Delaware Indian Medicine Practice","https://archive.org/details/swimmermanuscrip00moon",""],["Onoclea sensibilis","Sensitive Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive",""],["Osmundastrum cinnamomeum","Cinnamon Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive","Osmunda cinnamomea"],["Ostrya virginiana","Ironwood","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/ironwood-musclewood",""],["Panax quinquefolius","Ginseng","","","","Native","Y","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Mooney 1891, Sacred Formulas of the Cherokees | Smithsonian Folklife","https://gibsurvey.ca/species/ginseng","Aralia quinquefolia"],["Phaseolus vulgaris","Common bean","","","","Cultivated","","Haudenosaunee Confederacy, Ceremonies","https://www.haudenosauneeconfederacy.com/ceremonies/",""],["Picea glauca","White Spruce","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-spruce-red-spruce-and-black-spruce",""],["Picea mariana","Black Spruce","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-spruce-red-spruce-and-black-spruce",""],["Picea rubens","Red Spruce","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-spruce-red-spruce-and-black-spruce",""],["Pinus banksiana","Jack Pine","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-pine-red-pine-jack-pine",""],["Pinus resinosa","Red Pine","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-pine-red-pine-jack-pine",""],["Pinus strobus","White Pine","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Cornell Botanic Gardens","https://gibsurvey.ca/species/white-pine-red-pine-jack-pine",""],["Podophyllum peltatum","Mayapple","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Tantaquidgeon 1942, Delaware Indian Medicine Practice | Upstate Forever","https://gibsurvey.ca/species/mayapple",""],["Polygonatum biflorum","Solomon's seal","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Polygonatum multiflorum latifolium"],["Polystichum acrostichoides","Christmas Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Mooney 1891, Sacred Formulas of the Cherokees","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive","Aspidium acrostichoides"],["Portulaca oleracea","Purslane","","","","Non-native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Potentilla indica","Mock Strawberry","","","","Non-native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-strawberry-woodland-strawberry-and-mock-strawberry",""],["Prunus americana","Wild Plum","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-plum",""],["Pseudognaphalium macounii","Life everlasting","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Gnaphalium macounii; Gnaphalium decurrens"],["Pteridium aquilinum","Bracken Fern","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/bracken-fern-christmas-fern-cinnamon-fern-ladyfern-maidenhair-fern-ostrich-fern-sensitive",""],["Quercus alba","White oak","","","","Native","","RTCAR, Cherokee Preservation Foundation","https://cherokeepreservation.org/?p=584",""],["Rhododendron groenlandicum","Labrador Tea","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/labrador-tea","Ledum groenlandicum"],["Rhus typhina","Staghorn Sumac","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/staghorn-sumac",""],["Ribes americanum","Black Currant","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Ribes cynosbati","Prickly Gooseberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Ribes glandulosum","Skunk Currant","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Ribes hirtellum","Smooth Gooseberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Ribes lacustre","Prickly Currant","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Ribes rubrum","Red Currant","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/gooseberries-currants",""],["Rubus allegheniensis","Allegheny Blackberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/raspberries-blackberries",""],["Rubus flagellaris","Common Dewberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/raspberries-blackberries",""],["Rubus idaeus","Red Raspberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/raspberries-blackberries",""],["Rubus occidentalis","Black Raspberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/raspberries-blackberries",""],["Rudbeckia fulgida","Orange coneflower","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Rudbeckia laciniata","Sochan, cutleaf coneflower","","","","Native","","Cherokee One Feather 2019","https://theonefeather.com/2019/03/25/park-tribe-sign-sochan-agreement/",""],["Sambucus canadensis","Black Elderberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Upstate Forever","https://gibsurvey.ca/species/black-elderberry-red-elderberry",""],["Sambucus racemosa","Red Elderberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/black-elderberry-red-elderberry",""],["Sanguinaria canadensis","Bloodroot","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026) | Upstate Forever; Traditional Cherokee dyes","https://gibsurvey.ca/species/bloodroot",""],["Sassafras albidum","Sassafras","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/sassafras",""],["Scutellaria lateriflora","Mad-dog skullcap","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Scutellaria pilosa","Hairy skullcap","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Senna marilandica","Wild senna","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Cassia marilandica; Cassia Marilandica"],["Stylosanthes biflora","Pencil flower","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Stylosanthes elatior"],["Tephrosia virginiana","Goat's rue","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Thalictrum thalictroides","Rue anemone","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Anemonella thalictroides; Thalictrum anemonoides"],["Thuja occidentalis","White Cedar","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/white-cedar-red-cedar-and-common-juniper",""],["Tilia americana","Basswood","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/basswood",""],["Trillium erectum","Red Trillium","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/red-trillium-white-trillium",""],["Trillium grandiflorum","White Trillium","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/red-trillium-white-trillium",""],["Tsuga canadensis","Eastern Hemlock","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/eastern-hemlock",""],["Typha latifolia","Broadleaf Cattail","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/cattails",""],["Ulmus americana","American Elm","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/slippery-elm-american-elm",""],["Ulmus rubra","Slippery Elm","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/slippery-elm-american-elm",""],["Urtica dioica","Stinging Nettle","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/nettles",""],["Vaccinium macrocarpon","Large cranberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/cranberries-blueberries",""],["Vaccinium ovalifolium","Oval-leaved Blueberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/cranberries-blueberries",""],["Vaccinium oxycoccos","Small cranberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/cranberries-blueberries",""],["Viburnum opulus var. americanum","Highbush Cranberry","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/mapleleaf-viburnum-nannyberry-highbush-cranberry","Viburnum trilobum"],["Vicia caroliniana","Carolina vetch","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Viola sororia","Common Blue Violet","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/common-blue-violet-canadian-white-violet-long-spurred-violet-sand-violet-downy-yellow",""],["Vitis vulpina","Frost grape","","","","Native","","Mooney 1891, Sacred Formulas of the Cherokees","https://gutenberg.org/files/24788/24788-h/24788-h.htm","Vitis cordifolia"],["Xanthorhiza simplicissima","Yellowroot","","","","Native","","Traditional Cherokee dyes","https://casite-498466.cloudaccess.net/archives/item/15308-traditional-cherokee-dyes",""],["Zea mays","Corn (maize)","","","","Cultivated","","Mooney 1891, Sacred Formulas of the Cherokees | Haudenosaunee Confederacy, Ceremonies","https://gutenberg.org/files/24788/24788-h/24788-h.htm",""],["Zizania aquatica","Southern wild rice","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-rice",""],["Zizania palustris","Northern wild rice","","","","Native","","Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan & Ni 2026)","https://gibsurvey.ca/species/wild-rice",""]];
const CULTIX = new Map(), CULTGEN = new Map();
CULTD.forEach((e, k) => { const add = n => { n = (n || '').trim().toLowerCase(); if (!n) return; if (!CULTIX.has(n)) CULTIX.set(n, k); const b = n.split(' ').slice(0, 2).join(' '); if (!CULTIX.has(b)) CULTIX.set(b, k); };
  if (/ spp\.$/.test(e[0])) CULTGEN.set(e[0].split(' ')[0].toLowerCase(), k); else { add(e[0]); e[9].split(';').forEach(add); } });
function cultOf(i){ const s = sppName(i).sci.toLowerCase(), b = s.split(' ').slice(0, 2).join(' '); let k = CULTIX.get(s); if (k == null) k = CULTIX.get(b); if (k == null) k = CULTGEN.get(s.split(' ')[0]); return k == null ? null : CULTD[k]; }
const cultReady = lv => !!(D.themes.inat && D.themes.inat[lv] && D.themes.inat[lv].f.CULT_LIST);
const cultL = (lv, c) => cultReady(lv) && has('inat', lv, c) ? (val('inat','CULT_LIST',lv,c) || []) : null;
function cultCount(lv, c, test){ const L = cultL(lv, c); if (L == null) return null; return test ? L.filter(i => { const e = cultOf(i); return !!e && test(e); }).length : L.length; }
function cultBox(lv, cells){ let b = `<div class="sec" style="--hue:${HUE.cult}"><h3>Plants of cultural significance</h3>`; const many = cells.length > 1;
  if (!cultReady(lv)) return b + '<p class="none">Not in this summary yet. They are added the next time the quarterly iNaturalist summary is rebuilt.</p></div>';
  const ci = cells.filter(c => has('inat', lv, c));
  if (!ci.length) return b + `<p class="none">No iNaturalist records in ${many ? 'the selected cells' : 'this cell'} in the quarterly summary.</p></div>`;
  const cnt = new Map(); ci.forEach(c => (val('inat','CULT_LIST',lv,c) || []).forEach(i => cnt.set(i, (cnt.get(i) || 0) + 1)));
  const obs = ci.reduce((s, c) => s + (val('inat','N_CULT_OBS',lv,c) || 0), 0);
  const items = [...cnt].map(([i, n]) => [i, n, cultOf(i)]).filter(x => x[2]).sort((a, b) => (a[2][1] || a[2][0]).localeCompare(b[2][1] || b[2][0]));
  b += `<div class="facts"><div><b>${items.length || 'None'}</b>${items.length === 1 ? 'species' : 'species'}</div><div><b>${fmt(obs, 0)}</b>iNat ${obs === 1 ? 'record' : 'records'}</div>${many ? `<div><b>${ci.length}</b>of ${cells.length} cells with records</div>` : ''}</div>`;
  if (items.length) b += (many ? '<p class="none" style="font-size:13.5px">With the number of selected cells each was found in.</p>' : '') + '<ul class="spp cultl">' + items.map(([i, n, e]) => `<li>${esc(e[1] || sppName(i).common || '')} <em>${esc(sppName(i).sci)}</em>${many ? `<span class="tag">${nCells(n)}</span>` : ''}` +
      `<small>${e[5] !== 'Native' ? esc(e[5]) + ' · ' : ''}${e[8] ? `<a href="${esc(e[8])}" target="_blank" rel="noopener">source</a>` : ''}</small></li>`).join('') + '</ul>';
  else b += `<p class="none">None of the listed plants has an iNaturalist record ${many ? 'in the selected cells' : 'here'} in the quarterly summary.</p>`;
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">Research-grade iNaturalist records matched to ${CULTD.length} plants documented for Eastern Woodlands nations. ${lv === 'wheel' ? '' : 'Ginseng, goldenseal, ramps and lady’s slippers are listed only at the 49 sq mi scale. '}A blank list means no records, not that the plants are absent.</p>`;
  return b + '</div>'; }
const cultSection = (lv, c) => cultBox(lv, [c]);
/* 49 sq mi cells with records of each listed species, in the trail section picked: sci -> {name, sci, mi:[trail miles]} */
function cultSpread(){ const L_ = D.levels.wheel, M = new Map(); if (!cultReady('wheel')) return null;
  for (let c = 0; c < L_.id.length; c++){ if (!inSec('wheel', c)) continue; const a = cultL('wheel', c); if (!a) continue;
    a.forEach(i => { const e = cultOf(i); if (!e) return; const p = sppName(i), k = p.sci.toLowerCase(); let s = M.get(k);
      if (!s) M.set(k, s = {name:e[1] || p.common || p.sci, sci:p.sci, mi:[]}); s.mi.push(L_.mi[c]); }); }
  M.forEach(s => s.mi.sort((x, y) => x - y)); return [...M.values()]; }
function cultCharts(){ const S_ = cultSpread(); if (!S_) return '<p class="none">The charts fill in after the next quarterly iNaturalist rebuild.</p>';
  if (!S_.length) return '<p class="none">No listed species recorded in this section.</p>';
  return cultTopHTML(); }
/* the 1 sq mi cells inside the selection, else those in view (and in the trail section picked) */
let CULTHEX = null;
function cultHexIn(ids){ if (!CULTHEX){ CULTHEX = new Map(); D.levels.hex.id.forEach((id, c) => { const p = id.split('-'); [p.slice(0, 4).join('-'), p.slice(0, 3).join('-')].forEach(k => { let a = CULTHEX.get(k); if (!a) CULTHEX.set(k, a = []); a.push(c); }); }); }
  const out = []; ids.forEach(id => { const ix = D.levels.hex.id.indexOf(id); if (ix >= 0) out.push(ix); else (CULTHEX.get(id) || []).forEach(c => out.push(c)); }); return out; }
function cultScope(){ const H = D.levels.hex;
  if (S.box && S.box.cells && S.box.cells.length){ const L_ = D.levels[S.box.lv]; return [cultHexIn(S.box.cells.map(c => L_.id[c])), `the ${S.box.cells.length} selected cells`]; }
  if (S.cell != null && D.levels[S.cellLv]) return [cultHexIn([D.levels[S.cellLv].id[S.cell]]), 'the selected cell'];
  const b = map.getBounds(), out = []; for (let c = 0; c < H.id.length; c++) if (inSec('hex', c) && b.contains(H.c[c])) out.push(c); return [out, 'the map view']; }
function cultTopHTML(){ if (!cultReady('hex')) return '';
  const inv = S.m && S.m.id === 'withinv', [all, where] = cultScope(), M = new Map();
  const cells = inv ? all.filter(c => (invL('EDRR_LIST', 'hex', c) || []).length) : all;
  cells.forEach(c => (cultL('hex', c) || []).forEach(i => { const e = cultOf(i); if (!e) return; const p = sppName(i), k = p.sci.toLowerCase(); let s = M.get(k); if (!s) M.set(k, s = {name:e[1] || p.common || p.sci, sci:p.sci, n:0}); s.n++; }));
  const tp = [...M.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 10);
  let g = `<div id="culttop"><h4 class="phh">${inv ? 'Culturally significant species recorded with priority invasives' : 'Most widely recorded species'}, ${esc(where)}</h4>`;
  if (!tp.length) return g + `<p class="none">${inv ? 'No listed species recorded where priority invasives are also recorded' : 'No listed species recorded'} in ${esc(where)}.</p></div>`;
  g += hbars(vRampRows(tp.map(s => [s.name, HUE.cult, s.n, fmt(s.n, 0), `${s.name} (${s.sci}): recorded in ${s.n} of the ${cells.length} square miles in ${where}. Click to map it.`, s.sci.toLowerCase()]), 'cult'), 'Most widely recorded species');
  if (inv){ const IV = new Map(); cells.forEach(c => { if (!(cultL('hex', c) || []).length) return; (invL('EDRR_LIST', 'hex', c) || []).forEach(i => { const p = sppName(i), k = p.sci.toLowerCase(); let s = IV.get(k); if (!s) IV.set(k, s = {name:p.common || p.sci, sci:p.sci, n:0}); s.n++; }); });
    const ti = [...IV.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 10);
    if (ti.length) g += `<h4 class="phh">Priority invasives recorded with them</h4>` + hbars(ti.map(s => [s.name, HUE.pinv, s.n, fmt(s.n, 0), `${s.name} (${s.sci}): in ${s.n} of the square miles where listed plants and priority invasives are both recorded.`]), 'Priority invasives recorded with them');
    return g + `<p class="phnote">Square miles in ${esc(where)} where a listed plant and a priority invasive plant are both recorded (research-grade iNaturalist records and EDDMapS reports): where invasive plant control would protect them. Ginseng, goldenseal, ramps and lady’s slippers are left out at this scale.</p></div>`; }
  return g + `<p class="phnote">Square miles with a research-grade iNaturalist record, in ${esc(where)}${where === 'the map view' ? ' (zoom or pan to change it, or select cells)' : ''}. Ginseng, goldenseal, ramps and lady’s slippers are left out at this scale. Records follow hikers, so a species recorded in few square miles may simply be overlooked. Click a species to map where it is recorded.</p></div>`; }
function cultVizRefresh(){ geoVizRefresh(); qVizRefresh(); const t = $('#culttop'); if (t && S.q.id === 'cult' && !S.m.find) t.outerHTML = cultTopHTML(); }
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-cultsp],[data-cultall]'); if (!t) return;
  if (t.dataset.cultall){ S.cultAll = !S.cultAll; const v = $('#cultviz'); if (v) v.innerHTML = cultCharts(); return; }
  const en = findIndex().get(t.dataset.cultsp); if (en) setFind(en, false); });
if (!D.themes.geo) D.themes.geo = {};
if (!D.themes.vis) D.themes.vis = {};
if (!D.themes.wx) D.themes.wx = {};
if (!D.themes.nrpz) D.themes.nrpz = {};
if (!D.themes.slope) D.themes.slope = {}; if (!D.themes.fhr) D.themes.fhr = {}; if (!D.themes.topo) D.themes.topo = {}; if (!D.themes.defic) D.themes.defic = {}; if (!D.themes.seg) D.themes.seg = {}; for (const th of ['dist','gedi','lsp','dym']) if (!D.themes[th]) D.themes[th] = {};
/* geologic maps and bedrock units shared by both extents: GEOT = {maps:[[id, name, year, scale, type, gis, reference, url, notes]],
   units:[[name, label, age, lithology class, age class, major lithologies, carbonate, mafic, state]], meta} */
let GEOT = null;
const geoNewest = (lv, c) => { const y = val('geo','MAP_NEWEST',lv,c); return y == null ? null : y >= 2010 ? 0 : y >= 1990 ? 1 : y >= 1970 ? 2 : 3; };
function geoMapItem(i, extra){ const m = GEOT.maps[i]; if (!m) return '';
  return `<li>${m[7] ? `<a href="${esc(m[7])}" target="_blank" rel="noopener">${esc(m[1])}</a>` : esc(m[1])}${extra || ''}<small>${m[2]} · 1:${fmt(m[3], 0)} · ${esc(m[4])}${m[5] === 'yes' ? ' · GIS data' : ''}${m[8] ? ' · ' + esc(m[8]) : ''}</small></li>`; }
function geoUnitItem(i, pct, extra){ const u = GEOT.units[i]; if (!u) return '';
  return `<li>${esc(u[0])}${u[1] && u[1] !== u[0] ? ` <span class="tag">${esc(u[1])}</span>` : ''}${extra || ''}${pct != null ? `<span class="tag">${pct < 1 ? '<1' : pct}%</span>` : ''}<small>${esc(u[2] || 'Age not given')}${u[5] ? ' · ' + esc(u[5]) : ''}</small></li>`; }
function geoLithRows(pairs){
  return '<div class="keys">' + pairs.map(([k, v]) => { const e = CATCOL.GEO_LITH[k] || ['Other', '#ccc']; return `<div><i style="background:${e[1]}"></i><span>${esc(e[0])}</span><span>${v < 1 ? '<1' : Math.round(v)}%</span></div>`; }).join('') + '</div>'; }
function geoBox(lv, cells){ const many = cells.length > 1; let b = `<div class="sec" style="--hue:${HUE.geo}"><h3>Geology</h3>`;
  if (!GEOT || !D.themes.geo[lv]) return b + '<p class="none">The geology summaries (geology.json) have not been built yet.</p></div>';
  const ci = cells.filter(c => has('geo', lv, c)); if (!ci.length) return b + `<p class="none">No geology summary for ${many ? 'the selected cells' : 'this cell'}.</p></div>`;
  const mean = f => { const a = ci.map(c => val('geo', f, lv, c)).filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const carb = mean('PCT_CARB'), maf = mean('PCT_MAFIC');
  /* bedrock: lithology mix averaged over the cells, units with their share (one cell) or the number of cells they are in */
  const lith = new Map(); let nl = 0; ci.forEach(c => { const p = val('geo','PCT_LITH',lv,c); if (!p) return; nl++; for (let k = 0; k < p.length; k += 2) lith.set(p[k], (lith.get(p[k]) || 0) + p[k + 1]); });
  if (carb != null || nl){
    const main = !many ? val('geo','GEO_LITH',lv,ci[0]) : (nl ? [...lith].sort((a, b) => b[1] - a[1])[0][0] : null);
    b += `<div class="facts"><div><b>${carb == null ? '–' : (carb > 0 && carb < 1 ? '<1' : Math.round(carb)) + '%'}</b>carbonate</div><div><b>${maf == null ? '–' : (maf > 0 && maf < 1 ? '<1' : Math.round(maf)) + '%'}</b>mafic, ultramafic</div></div>`;
    if (main != null) b += `<p>Mostly <b>${esc((CATCOL.GEO_LITH[main] || [''])[0].toLowerCase())}</b>${!many && val('geo','GEO_AGE',lv,ci[0]) != null ? `; the main unit is ${esc(D.cats.GEO_AGE[val('geo','GEO_AGE',lv,ci[0])])} in age` : ''}.</p>`;
    if (nl) b += '<p style="margin-top:8px">Bedrock by type, share of the mapped area:</p>' + geoLithRows([...lith].map(([k, v]) => [k, v / nl]).sort((a, b) => b[1] - a[1]));
    if (!many){ const u = val('geo','UNITS',lv,ci[0]) || []; if (u.length) b += `<p style="margin-top:8px">Main bedrock units:</p><ul class="spp geol">${u.filter((_, k) => k % 2 === 0).map((i, k) => geoUnitItem(i, u[2 * k + 1])).join('')}</ul>`; }
    else { const cnt = new Map(); ci.forEach(c => { const u = val('geo','UNITS',lv,c) || []; for (let k = 0; k < u.length; k += 2) cnt.set(u[k], (cnt.get(u[k]) || 0) + 1); });
      const top = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 10); if (top.length) b += `<p style="margin-top:8px">Main bedrock units, with the number of selected cells where each is among the largest:</p><ul class="spp geol">${top.map(([i, n]) => geoUnitItem(i, null, `<span class="tag">${nCells(n)}</span>`)).join('')}</ul>`; }
  } else if (lv === 'hex' && S.ext === 'huc') b += '<p class="none">Bedrock types are listed for the 7 and 49 sq mi cells in the HUC10 shell.</p>';
  else b += '<p class="none">No bedrock summary for this cell.</p>';
  /* maps */
  const mc = new Map(); ci.forEach(c => (val('geo','MAPS',lv,c) || []).forEach(i => mc.set(i, (mc.get(i) || 0) + 1)));
  const best = !many ? val('geo','MAP_BEST',lv,ci[0]) : Math.min(...ci.map(c => val('geo','MAP_BEST',lv,c)).filter(x => x != null)), surf = !many ? val('geo','SURF',lv,ci[0]) : Math.min(...ci.map(c => val('geo','SURF',lv,c)).filter(x => x != null)), gis = !many ? val('geo','GIS_BEST',lv,ci[0]) : Math.min(...ci.map(c => val('geo','GIS_BEST',lv,c)).filter(x => x != null));
  b += `<p style="margin-top:12px;font-weight:600">Geologic maps</p>`;
  b += `<div class="keys nosw"><div><span>Most detailed geologic map${many ? ' (best cell)' : ''}</span><span>${isFinite(best) ? esc(D.cats.MAP_BEST[best]) : '–'}</span></div><div><span>Surficial geologic map</span><span>${isFinite(surf) ? esc(show(Q.find(q => q.id === 'geo').m.find(m => m.id === 'surf'), surf)) : '–'}</span></div><div><span>Digital (GIS) data</span><span>${isFinite(gis) ? esc(show(Q.find(q => q.id === 'geo').m.find(m => m.id === 'gis'), gis)) : '–'}</span></div>${!many && val('geo','PCT_DETAIL',lv,ci[0]) != null ? `<div><span>Area mapped at 1:24,000</span><span>${val('geo','PCT_DETAIL',lv,ci[0])}%</span></div>` : ''}</div>`;
  const ms = [...mc].sort((a, b) => GEOT.maps[a[0]][3] - GEOT.maps[b[0]][3] || GEOT.maps[b[0]][2] - GEOT.maps[a[0]][2]);
  if (ms.length) b += `<details${ms.length <= 6 ? ' open' : ''}><summary>${ms.length} geologic ${ms.length === 1 ? 'map covers' : 'maps cover'} ${many ? 'the selected cells' : 'this cell'}, most detailed first</summary><ul class="spp geol">${ms.map(([i, n]) => geoMapItem(i, many ? `<span class="tag">${nCells(n)}</span>` : '')).join('')}</ul></details>`;
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">Bedrock from the USGS State Geologic Map Compilation (Horton and others, 2017), compiled from the state geologic maps at 1:50,000 to 1:1,000,000 scale; for detail, use the maps listed. Map footprints from the NPS Geologic Resources Inventory are approximate${S.ext === 'huc' ? ', and maps were searched for only around the trail, so some further out may be missing' : ''}.</p>`;
  return b + '</div>'; }
const geoSection = (lv, c) => geoBox(lv, [c]);
/* ---------- weather and climate. Fixed classes per extent and cell size (equal steps between the 2nd and 98th percentiles),
   the same in every month or year while an animation plays. S.wxMon: month shown (0-11) or null for the year; S.wxYr: storm year or null */
let WXMETA = {};
const WXRAMP = {wet:['#EEF4F9','#CFE0EF','#A7C7E3','#79A8D3','#4F86BD','#2F64A0','#1B437A'],
  temp:['#2F5597','#5B84C2','#9DBCE0','#E9E4CF','#F3B37E','#E0774A','#B13B2C'],
  grow:['#F3F1DA','#DCE6AE','#B8D486','#8DBD63','#62A048','#3F7F37','#255E28'],
  wind:['#EFF0F7','#D2D6EA','#AEB5D7','#8B93C0','#6C73A8','#4F568B','#353B69'],
  WIND:['#F2EDF7','#DCCDEA','#C1A8DA','#A47FC6','#8659AE','#683B8F','#4B2570'],
  FLOOD:['#EAF5F7','#C6E5EB','#95CEDA','#5DB1C6','#2F90AD','#1A6E8E','#0E4D69'],
  WINTER:['#F1F4F8','#D6DFEA','#B5C5D9','#91A9C6','#6E8BB0','#536F96','#3A5276']};
const wxEvFmt = v => fmt(v, v > 0 && v < 1 ? 2 : v < 10 ? 1 : 0) + (S.wxYr ? '' : ' a year');
const WXEV = {WIND:'damaging wind', FLOOD:'flooding', WINTER:'winter storm'}, WXEVK = ['WIND','FLOOD','WINTER'];
const wxMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const wxIn = v => fmt(v, v < 10 || !Number.isInteger(v) ? 1 : 0) + ' in', wxF = v => fmt(Math.round(v), 0) + '°F', wxMph = v => fmt(v, 1) + ' mph';
function wxNY(){ const y = WXMETA.storms_info && WXMETA.storms_info.years; return y ? y[1] - y[0] + 1 : null; }
function wxYears(){ const y = WXMETA.storms_info && WXMETA.storms_info.years; return y ? y : null; }
/* monthly and yearly lists. The HUC10 square miles don't carry them (file size): they come from the surrounding 7 sq mi cell,
   scaled to the square mile's own annual value (precipitation and storm counts in proportion, temperature shifted by the difference) */
function wxList(lv, c, f){ const a = val('wx', f, lv, c); if (a || !has('wx', lv, c)) return a; const t = D.themes.wx[lv]; if (t && t.f[f]) return null;
  const p = parentOf(lv, c); if (!p || !has('wx', p[0], p[1])) return null; const b = val('wx', f, p[0], p[1]); if (!b) return null;
  const pair = g => [val('wx', g, lv, c), val('wx', g, p[0], p[1])];
  if (f === 'WX_PPT_M'){ const [r, q] = pair('WX_PPT'); return r != null && q ? b.map(x => x * r / q) : b; }
  if (f === 'WX_TMEAN_M'){ const [r, q] = pair('WX_TMEAN'); return r != null && q != null ? b.map(x => x + r - q) : b; }
  if (f === 'WX_EV_Y'){ const out = b.slice(); WXEVK.forEach((g, k) => { const [r, q] = pair('WX_EV_' + g), sc = q ? (r || 0) / q : 0; for (let i = 0; i < out.length; i += 4) out[i + 1 + k] = Math.round(b[i + 1 + k] * sc * 100) / 100; }); return out; }
  return b; }
const wxHasList = (lv, f) => { const t = D.themes.wx && D.themes.wx[lv]; return !!t && (!!t.f[f] || (lv === 'hex' && !!D.themes.wx.cog && !!D.themes.wx.cog.f[f])); };
function wxMonVal(lv, c, f){ const a = wxList(lv, c, f); return a ? a[S.wxMon] : null; }
function wxEvYear(lv, c, g, y){ if (!has('wx', lv, c) || val('wx','WX_EV_' + g, lv, c) == null) return null; const a = wxList(lv, c, 'WX_EV_Y'), k = WXEVK.indexOf(g); if (!a) return null;
  for (let i = 0; i < a.length; i += 4) if (a[i] === y) return a[i + 1 + k]; return 0; }
function wxEv(lv, c, g){ if (S.wxYr) return wxEvYear(lv, c, g, S.wxYr); const n = val('wx','WX_EV_' + g, lv, c), ny = wxNY(); return n == null || !ny ? null : n / ny; }
/* classes: one set per measure for every cell size and both extents, worked out in the build from all the cells (meta.classes),
   so a color means the same at 49, 7 and 1 sq mi, in the corridor and the HUC10 shell, and in every month or year as it plays.
   Older files without them: worked out here from this extent's 7 sq mi cells, again the same at every cell size */
const WXB = {};
function wxClsKey(m){ return m.wxAnim === 'mon' && S.wxMon != null ? m.wxMonF : m.wxAnim === 'yr' && S.wxYr ? 'WX_EV_' + m.wxG + '_Y' : m.wxG ? 'WX_EV_' + m.wxG : m.wxKey || m.f; }
function wxClasses(m, lv){ const ck = wxClsKey(m), M = WXMETA.classes && WXMETA.classes[ck]; if (M && M.b) return M;
  const rl = D.themes.wx && D.themes.wx.cog ? 'cog' : lv, key = ck + '|' + S.ext; if (WXB[key] && WXB[key].lev === D.levels[rl]) return WXB[key];
  const t = D.themes.wx && D.themes.wx[rl], a = [];
  if (t){ const L_ = D.levels[rl];
    if (m.wxAnim === 'mon' && S.wxMon != null){ (t.f[m.wxMonF] || []).forEach(x => { if (x) x.forEach(v => v != null && a.push(v)); }); }
    else if (m.wxAnim === 'yr' && S.wxYr){ const k = WXEVK.indexOf(m.wxG); (t.f.WX_EV_Y || []).forEach(x => { if (x) for (let i = 0; i < x.length; i += 4) a.push(x[i + 1 + k]); }); }
    else for (let c = 0; c < L_.id.length; c++){ const v = m.get(rl, c); if (v != null) a.push(v); } }
  const s = a.filter(v => Number.isFinite(v)).sort((p, q) => p - q); let b = [];
  if (s.length){ const lo = s[Math.floor(.02 * (s.length - 1))], hi = s[Math.ceil(.98 * (s.length - 1))];
    if (m.wxSkew){ const pos = s.filter(v => v > 0), q = f => pos[Math.min(pos.length - 1, Math.floor(f * pos.length))];
      if (pos.length) b = [.3, .55, .75, .9, .97].map(f => { const v = niceNum(q(f)); return v >= 1 ? Math.round(v) : +v.toFixed(2); }); }
    else { const st = niceNum((hi - lo) / 6) || 1, s0 = Math.floor(lo / st) * st; for (let i = 1; i <= 6; i++){ const v = +(s0 + st * i).toFixed(4); if (v < hi) b.push(v); } }
    b = b.filter((v, i) => i === 0 || v > b[i - 1]); }
  return (WXB[key] = {lev:D.levels[rl], b, lo:s.length ? s[0] : 0, hi:s.length ? s[s.length - 1] : 1}); }
function wxCol(m, v, lv){ if (v == null) return null; if (m.wxSkew && v === 0) return ZERO; const B = wxClasses(m, lv).b, R = WXRAMP[m.wxRamp]; let i = 0; while (i < B.length && v > B[i]) i++;
  return R[Math.round(i * (R.length - 1) / Math.max(1, B.length))]; }
function wxLegend(m, lv){ const B = wxClasses(m, lv).b, R = WXRAMP[m.wxRamp], sh = m.showFn || (v => fmt(v, m.d)); if (!D.themes.wx[lv]) return '<p class="sub">The weather summaries (weather.json) have not been built yet.</p>';
  let h = m.wxSkew ? `<div class="row"><i style="background:${ZERO}"></i><span>None reported</span></div>` : '';
  if (!B.length){ h += `<div class="row"><i style="background:${R[3]}"></i><span>${m.wxSkew ? 'Some reported' : 'All cells'}</span></div>`; }
  else { const n = B.length + 1; for (let i = 0; i < n; i++){ const t = i === 0 ? (m.wxSkew ? `up to ${sh(B[0])}` : `under ${sh(B[0])}`) : i === n - 1 ? `${sh(B[i - 1])} or more` : `${sh(B[i - 1])} to ${sh(B[i])}`;
    h += `<div class="row"><i style="background:${R[Math.round(i * (R.length - 1) / Math.max(1, B.length))]}"></i><span>${t}</span></div>`; } }
  if (m.wxAnim === 'mon') h += `<p class="sub">${S.wxMon != null ? MONTHS_LONG[S.wxMon] + ' average, ' : 'Annual, '}1991–2020 normal.${S.wxMon != null ? ' Classes stay the same in every month.' : ''}</p>`;
  if (m.wxAnim === 'yr') h += `<p class="sub">${S.wxYr ? 'Events in ' + S.wxYr + '. Classes stay the same in every year.' : 'Average events a year since ' + (wxYears() || ['1996'])[0] + '.'}</p>`;
  return h; }
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/* the bars along the trail: temperatures sit on a floor below the lowest value, so they read as warmer and colder */
function wxStripTop(m, lv){ const C = wxClasses(m, lv); m._floor = m.wxFloor ? Math.floor(C.lo / 5) * 5 - 5 : 0; return Math.max(1e-6, (m.wxSkew ? (C.b.length ? C.b[C.b.length - 1] * 1.3 : 1) : C.hi) - m._floor); }
const wxM = (o) => Object.assign(o, {colorFn(v, lv){ return wxCol(this, v, lv); }, legendFn(lv){ return wxLegend(this, lv); }, stripTop(lv){ return wxStripTop(this, lv); }, stripH(v){ return Math.max(.001, v - (this._floor || 0)); }});
/* the Weather and climate section in the cell details, for one cell or a selection (averages over the cells) */
function wxBox(lv, cells){ const many = cells.length > 1; let b = `<div class="sec" style="--hue:${HUE.wx}"><h3>Weather and climate</h3>`;
  if (!D.themes.wx || !D.themes.wx[lv]) return b + '<p class="none">The weather summaries (weather.json) have not been built yet.</p></div>';
  const ci = cells.filter(c => has('wx', lv, c)); if (!ci.length) return b + `<p class="none">No weather summary for ${many ? 'the selected cells' : 'this cell'}.</p></div>`;
  const mean = f => { const a = ci.map(c => val('wx', f, lv, c)).filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const d = (v, f) => v == null ? '–' : f(v), ny = wxNY();
  const ppt = mean('WX_PPT'), tm = mean('WX_TMEAN'), ff = mean('WX_FROSTFREE'), hi = mean('WX_TMAX7'), lo = mean('WX_TMIN1'), hv = mean('WX_HEAVY'), p25 = mean('WX_P25'), w = mean('WX_WIND'), wd = mean('WX_WINDY');
  b += `<div class="facts"><div><b>${d(ppt, v => fmt(v, 0) + '″')}</b>precipitation a year</div><div><b>${d(tm, wxF)}</b>mean temperature</div><div><b>${d(ff, v => fmt(Math.round(v), 0))}</b>frost-free days</div></div>`;
  b += `<div class="facts"><div><b>${d(hi, wxF)}</b>July high</div><div><b>${d(lo, wxF)}</b>January low</div><div><b>${d(hv, v => fmt(v, 1))}</b>days with 1″+ of rain</div></div>`;
  const mm = ci.map(c => wxList(lv, c, 'WX_PPT_M')).filter(Boolean); let wet = null;
  if (mm.length){ const s = Array(12).fill(0); mm.forEach(a => a.forEach((x, i) => s[i] += x)); wet = s.indexOf(Math.max(...s)); }
  else if (!many && val('wx','WX_WETM',lv,ci[0]) != null) wet = val('wx','WX_WETM',lv,ci[0]);
  b += `<p>${wet != null ? `Wettest month: <b>${MONTHS_LONG[wet]}</b>. ` : ''}${p25 != null ? `A 25-year storm brings about <b>${fmt(p25, 1)} inches</b> in 24 hours. ` : ''}${w != null ? `Average wind ${fmt(w, 1)} mph, with ${fmt(wd || 0, 1)} windy days a year.` : ''}</p>`;
  if (ny){ const ev = WXEVK.filter(g => g !== 'FLOOD').map(g => [g, mean('WX_EV_' + g)]);
    if (ev.some(e => e[1] != null)) b += `<div class="keys nosw">${ev.map(([g, n]) => `<div><span>${WXEV[g][0].toUpperCase() + WXEV[g].slice(1)} events</span><span>${n == null ? '–' : n / ny < .1 ? (n ? fmt(n, n < 10 ? 1 : 0) + ' since ' + wxYears()[0] : 'none since ' + wxYears()[0]) : fmt(n / ny, 1) + ' a year'}</span></div>`).join('')}</div>`; }
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">${many ? 'Averages over the selected cells. ' : ''}Normals for 1991–2020 from PRISM (Oregon State University); frost-free season and heavy-rain days from NOAA nClimGrid-Daily; the 25-year storm from NOAA Atlas 14. Wind is from gridMET, a research dataset on a 4 km grid that smooths ridge-top winds, so read it as relative. Storm events from the NOAA Storm Events Database since ${(wxYears() || [1996])[0]}; each event counts in every cell in the forecast zone or county it was reported for.</p>`;
  return b + '</div>'; }
const wxSection = (lv, c) => wxBox(lv, [c]);
/* ---------- trail vulnerability: points from each factor (weights add to 100 by default), scaled to 0-100 over the factors with data.
   Factor values: shares and NRCS ratings are used as they are (0 to 1); rain, the 25-year storm and use hot spots are scored by how the cell ranks among
   cells of its size (0 lowest, 1 highest), as restoration does with counts. Weights can be changed under Model weights */
const TVDEF = [
  ['g90', 'Steepest trail grade', 40, 'seg', 'The steepest sustained grade (over 40 m) on the steepest 10% of the cell’s trail, ranked among cells (USGS 3DEP, measured in 500-foot trail segments). Trail grade is the strongest driver of soil loss in recreation ecology research, which finds it substantially greater above 11% (Olive &amp; Marion 2009). On the A.T., a segment with a recorded erosion problem is steeper than one without in the same club section 67% of the time'],
  ['side90', 'Hillside steepness', 10, 'seg', 'How steep the hillside is where the trail crosses it (landform grade), on the steepest 10% of the cell’s trail, ranked among cells. On the A.T., the potential for soil loss rises with the steepness of the ground the trail crosses, most of all where the trail also climbs directly; low-grade sidehill trail on steep ground holds up best (Meadema et al. 2019). Flatter ground is more prone to mud and widening instead. Here too, segments on steeper hillsides recorded more erosion, much of it because they are also steeper'],
  ['align', 'How directly the trail climbs', 10, 'seg', 'Whether the trail climbs straight up the slope, at a slant, or runs across it, judged on the stretches that climb most directly (the top 10% of the cell’s trail) and ranked among cells. Water runs down trail that climbs straight up: alignment is as influential as grade on soil loss (Marion &amp; Wimpey 2017), and on the A.T. trail on the fall line recorded 1.9 times its club section’s erosion rate, trail across the slope 0.7 times'],
  ['rain', 'Heavy rain', 15, 'wx', 'Days a year with 1 inch or more of rain (NOAA nClimGrid-Daily), ranked among cells'],
  ['use', 'Use hot spots', 10, 'feat', 'Parking areas, shelters, campsites and vistas on the trail (A.T. facilities inventory), ranked among cells: where hikers gather, stop and spread out'],
  ['eros', 'Soil erosion hazard', 5, 'soil', 'NRCS erosion hazard for unsurfaced trails, 0 (slight) to 1 (very severe)'],
  ['wet', 'Wet, organic soils', 5, 'soil', 'Share of hydric soils, with soil organic matter as a tiebreak (gSSURGO), ranked among cells: soft, wet ground that muddies and widens'],
  ['pest', 'Forest pests', 2.5, 'inat', 'Forest pest species reported to iNaturalist or EDDMapS, ranked among cells: an early sign of declining forest health. Dying canopy trees bring more light and runoff, falling trees and root loss loosen trail soils, and the effects cascade through the forest'],
  ['inv', 'Invasive plants', 2.5, 'inat', 'Invasive plant species reported to iNaturalist or EDDMapS, ranked among cells: another sign of a forest under stress. Invasive plants take hold in gaps and along the tread, crowd out the native ground cover and roots that hold trail soils, and spread along the trail corridor']];
const TVW = Object.fromEntries(TVDEF.map(d => [d[0], d[2]]));
const tvSlopeOn = () => !!(D.themes.slope && (D.themes.slope.hex || D.themes.slope.cog || D.themes.slope.wheel));
/* which cells are scored: those the trail passes through (from the slope build); before it has run, corridor cells with soils */
function tvGate(lv, c){ if (tvSlopeOn()) return (val('slope','TS_MI',lv,c) || 0) > 0; return has('soil', lv, c) && (S.ext === 'corr' || inCorr(lv, c)); }
function tvRaw(k, lv, c){ const v = (th, f) => val(th, f, lv, c);
  switch (k){
    case 'grade': { const a = v('slope','TS_G10'), b = v('slope','TS_G20'); return a == null ? null : Math.min(1, (a + (b || 0)) / 200); }
    case 'fall': { const a = v('slope','TS_FALL'); return a == null ? null : a / 100; }
    case 'eros': return v('soil','EROS_HR');
    case 'g90': return v('seg','SG_G90');
    case 'side90': return v('seg','SG_S90');
    case 'align': { const a = v('seg','SG_A10'); return a == null ? null : 90 - a; }
    case 'side': { const a = v('slope','TS_SIDE'); return a == null ? null : Math.min(1, a / 100); }
    case 'wet': { const a = v('soil','HYDRIC'), o = v('soil','OM'); return a == null && o == null ? null : (a || 0) + (o || 0) / 20; }
    case 'rain': return v('wx','WX_HEAVY');
    case 'inv': { const a = invL('INVASIVE_LIST', lv, c); return a == null && !hasInv(lv, c) ? null : (a || []).length; }
    case 'pest': { const a = invL('PEST_LIST', lv, c); return a == null && !hasInv(lv, c) ? null : (a || []).length; }
    case 'use': { if (!has('feat', lv, c)) return D.themes.feat && D.themes.feat[lv] && S.ext === 'corr' ? 0 : null; return ['N_PARKING','N_SHELTER','N_CAMPSITE','N_VISTA'].reduce((t, f) => t + (val('feat', f, lv, c) || 0), 0); } } }
const TVRANK = {}, tvRanked = k => k === 'rain' || k === 'wet' || k === 'use' || k === 'pest' || k === 'inv' || k === 'g90' || k === 'side90' || k === 'align';
/* a cell with trail but no segment of its own (a short piece; the segment's middle lies next door) takes the rank of its cell-wide slope measure */
const TVSEGFB = {g90:'grade', side90:'side', align:'fall'};
function tvScale(k, lv, c){ const x = tvRaw(k, lv, c); if (x == null) return TVSEGFB[k] ? tvScale(TVSEGFB[k], lv, c) : null; if (!tvRanked(k)) return Math.max(0, Math.min(1, x)); if (!(x > 0)) return 0;
  const key = k + '|' + lv + '|' + S.ext; let R = TVRANK[key]; if (!R || R.lev !== D.levels[lv]){ const a = []; for (let i = 0; i < D.levels[lv].id.length; i++) if (tvGate(lv, i)){ const y = tvRaw(k, lv, i); if (y > 0) a.push(y); } R = TVRANK[key] = {lev:D.levels[lv], a:a.sort((p, q) => p - q)}; }
  const a = R.a; if (!a.length) return 0; let lo = 0, hi = a.length; while (lo < hi){ const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid + 1; else hi = mid; } return lo / a.length; }
/* [score, parts [key, label, points, weight, raw], weight with data] */
function tvParts(lv, c){ if (!tvGate(lv, c)) return [null, [], 0];
  const parts = TVDEF.map(([k, lab]) => { const w = +TVW[k] || 0, s = tvScale(k, lv, c); return [k, lab, s == null ? null : w * s, w, tvRaw(k, lv, c)]; });
  const wAvail = parts.reduce((t, p) => t + (p[2] == null ? 0 : p[3]), 0), pts = parts.reduce((t, p) => t + (p[2] || 0), 0);
  return [wAvail > 0 ? Math.round(100 * pts / wAvail) : null, parts, wAvail]; }
const tvScore = (lv, c) => tvParts(lv, c)[0];
function tvRawText(k, x){ if (x == null) return 'no data'; switch (k){
  case 'grade': return fmt(x * 100, 0) + '% steep-trail score'; case 'fall': return fmt(x * 100, 0) + '% of the trail'; case 'side': return 'crosses a ' + fmt(x * 100, 0) + '% hillside on average'; case 'wet': return x ? fmt(Math.floor(x), 0) + '% hydric soils' : 'none';
  case 'eros': return fmt(x, 2) + ' of 1'; case 'rain': return fmt(x, 1) + ' days a year';
  case 'g90': return fmt(x, 0) + '% grade on its steepest stretches'; case 'side90': return 'crosses a ' + fmt(x, 0) + '% hillside on its steepest stretches'; case 'align': return 'its most direct stretches ' + alignWords(90 - x).replace(/^climbs/, 'climb').replace(/^runs/, 'run');
  case 'use': return x ? `${fmt(x, 0)} ${x === 1 ? 'site' : 'sites'}` : 'none';
  case 'inv': return x ? `${fmt(x, 0)} invasive plant species reported` : 'none reported';
  case 'pest': return x ? `${fmt(x, 0)} pest ${x === 1 ? 'species' : 'species'} reported` : 'none reported'; } return ''; }
function tvFacts(lv, cells){ const ci = cells.filter(c => (val('slope','TS_MI',lv,c) || 0) > 0); if (!ci.length) return '';
  const mi = ci.reduce((t, c) => t + val('slope','TS_MI',lv,c), 0), w = f => ci.reduce((t, c) => t + (val('slope', f, lv, c) || 0) * val('slope','TS_MI',lv,c), 0) / mi;
  return `<div class="facts"><div><b>${fmt(w('TS_GRADE'), 0)}%</b>average grade</div><div><b>${fmt(w('TS_FALL'), 0)}%</b>on the fall line</div><div><b>${fmt(w('TS_G10'), 0)}%</b>of trail over 10%</div></div>` +
    `<p style="font-size:13.5px">${((t) => t + (t === '1' ? ' mile' : ' miles'))(mi > 0 && mi < .05 ? '<0.1' : fmt(mi, 1))} of trail measured; ${fmt(w('TS_G20'), 0)}% over 20% grade.</p>`; }
const tvNote = () => `A screening tool, not a trail condition assessment.${tvSlopeOn() ? '' : ' Trail slope has not been built yet (trail_slope.json), so these scores use soils, rain and use hot spots only, scaled to the factors with data.'}`;
function tvBox(lv, cells){ let b = `<div class="sec" style="--hue:${HUE.tvul}"><h3>Trail vulnerability</h3>`; const many = cells.length > 1;
  const R = cells.map(c => [c, tvParts(lv, c)]).filter(x => x[1][0] != null);
  if (!R.length) return b + `<p class="none">${tvSlopeOn() ? 'The trail does not pass through ' + (many ? 'the selected cells' : 'this cell') + '.' : 'No scores here yet.'}</p></div>`;
  const sc = R.map(x => x[1][0]), avg = a => a.reduce((t, x) => t + x, 0) / a.length;
  b += `<p><b>${Math.round(avg(sc))}</b> of 100${many ? ` on average <span style="color:var(--muted)">(${Math.min(...sc)} to ${Math.max(...sc)}; ${R.length} of ${cells.length} cells scored)</span>` : ''}</p>`;
  b += tvFacts(lv, R.map(x => x[0]));
  if (D.themes.seg && D.themes.seg[lv]){ const cs = R.map(x => x[0]).filter(c => val('seg', 'SG_N', lv, c)), N = cs.reduce((t, c) => t + (val('seg', 'SG_N', lv, c) || 0), 0);
    if (N){ const avg = f => cs.reduce((t, c) => t + (val('seg', f, lv, c) || 0) * (val('seg', 'SG_N', lv, c) || 0), 0) / N, hi = avg('SG_HI'), wet = avg('SG_WET');
      b += `<p style="font-size:13.5px">${fmt(N, 0)} trail ${N === 1 ? 'segment' : 'segments'} of about 500 feet; ${fmt(hi, 0)}% of the trail in the top fifth of segment erosion risk${wet >= .5 ? `, ${fmt(wet, 0)}% low, flat trail (often wet)` : ''}. Zoom in under this question to see each segment.</p>`;
      if (SEGS){ const cnt = [0, 0, 0, 0]; let n = 0; R.forEach(x => segsIn(lv, x[0]).forEach(i => { const k = tsrOf(i); if (k >= 0){ cnt[k]++; n++; } }));
        if (n) b += `<p style="font-size:13.5px">Sustainability rating: ${[0, 1, 2, 3].filter(k => cnt[k]).map(k => `${Math.round(100 * cnt[k] / n)}% ${TSR[k].t.toLowerCase()}`).join(', ')}.</p>`; } } }
  if (deficOn()){ const cs = R.map(x => x[0]), S_ = f => cs.reduce((t, c) => t + (val('defic', f, lv, c) || 0), 0), n = S_('DF_N'), ex = S_('DF_EXP'), st = S_('DF_SITE');
    b += `<p style="font-size:13.5px">Recorded in the trail assessments: ${n ? `<b>${fmt(n, 0)}</b> treadway ${n === 1 ? 'problem' : 'problems'} (${fmt(S_('DF_EROS'), 0)} erosion, ${fmt(S_('DF_DRAIN'), 0)} drainage, ${fmt(S_('DF_OTHER'), 0)} other; ${fmt(S_('DF_SEV'), 0)} serious or critical)${ex >= .5 ? `, ${fmt(n / ex, 1)}× the average of ${many ? 'their club sections' : 'its club section'}` : ''}` : 'no treadway problems'}${st ? `; ${fmt(st, 0)} at sites and in the corridor` : ''}.</p>`; }
  b += '<div class="keys nosw">' + TVDEF.map(([k, lab], i) => { const ps = R.map(x => x[1][1][i]).filter(p => p[2] != null), w = +TVW[k] || 0;
    if (!ps.length) return soilRow(`${lab} <span style="color:var(--muted)">(no data)</span>`, '–');
    const raw = ps.map(p => p[4]).filter(x => x != null);
    const gs = k === 'grade' ? (f => { const a = R.map(x => val('slope', f, lv, x[0])).filter(v => v != null); return a.length ? avg(a) : null; }) : null;
    const txt = k === 'grade' && gs('TS_G10') != null ? `${fmt(gs('TS_G10'), 0)}% of the trail over 10% grade, ${fmt(gs('TS_G20'), 0)}% over 20%` : tvRawText(k, raw.length ? avg(raw) : null);
    return soilRow(`${lab} <span style="color:var(--muted)">(${txt}${many ? ', average' : ''})</span>`, ptsOf(avg(ps.map(p => p[2])), w)); }).join('') + '</div>';
  return b + `<p class="none" style="font-size:13.5px;margin-top:8px">${tvNote()}</p></div>`; }
const tvSection = (lv, c) => tvBox(lv, [c]) + tfBox(lv, [c]);
/* tree fall vulnerability in the popup: the score and where it stands, what was measured at the trail and high-use sites, each
   factor with its value and how high it runs here, and the forest pests recorded */
const WFSC = {};
function wfPct(lv, x){ const key = lv + '|' + S.ext + '|' + WFDEF.map(d => WFW[d[0]]).join(','); let R = WFSC[key];
  if (!R || R.lev !== D.levels[lv]){ const a = []; for (let i = 0; i < D.levels[lv].id.length; i++){ const s = wfScore(lv, i); if (s != null) a.push(s); } R = WFSC[key] = {lev:D.levels[lv], a:a.sort((p, q) => p - q)}; }
  const a = R.a; if (!a.length) return null; let lo = 0; while (lo < a.length && a[lo] < x) lo++; return Math.round(100 * lo / a.length); }
const WFLEV = s => s == null ? '–' : s >= .67 ? 'High' : s >= .33 ? 'Moderate' : s > 0 ? 'Low' : 'None';
const WFFEATN = {N_SHELTER:['shelter','shelters'], N_CAMPSITE:['campsite','campsites'], N_PRIVY:['privy','privies'], N_PARKING:['parking area','parking areas'], N_VISTA:['vista','vistas']};
function tfBox(lv, cells){ if (!(D.themes.topo && D.themes.topo[lv])) return ''; const many = cells.length > 1;
  let b = `<div class="sec" style="--hue:${HUE.tvul}"><h3>Tree fall vulnerability</h3>`;
  const R = cells.map(c => [c, wfParts(lv, c)]).filter(x => x[1][0] != null);
  if (!R.length) return b + `<p class="none">${cells.some(c => wfGate(lv, c)) ? 'Not enough data to score ' + (many ? 'the selected cells' : 'this cell') + '.' : 'No scored trail or high-use sites in forest ' + (many ? 'in the selected cells' : 'in this cell') + '.'}</p></div>`;
  const cs = R.map(x => x[0]), sc = R.map(x => x[1][0]), avg = a => a.length ? a.reduce((t, x) => t + x, 0) / a.length : null;
  const A = (th, f) => avg(cs.map(c => val(th, f, lv, c)).filter(v => v != null)), S_ = (th, f) => cs.reduce((t, c) => t + (val(th, f, lv, c) || 0), 0);
  const m = Math.round(avg(sc)), pc = many ? null : wfPct(lv, m);
  b += `<p><b>${m}</b> of 100${many ? ` on average <span style="color:var(--muted)">(${Math.min(...sc)} to ${Math.max(...sc)}; ${R.length} of ${cells.length} cells scored)</span>` : pc != null ? ` <span style="color:var(--muted)">· higher than ${pc}% of scored trail cells this size</span>` : ''}</p>`;
  /* what was measured on the ground */
  const exp = A('topo','TOPO_EXP'), tpi = A('topo','TOPO_TPI'), ch = A('topo','CH_MEAN'), mort = A('topo','IDS_MORT'), def = A('topo','IDS_DEF'), ns = S_('topo','TOPO_SITE'), nse = S_('topo','TOPO_SITE_EXP');
  b += '<div class="facts">' + (exp != null ? `<div><b>${fmt(exp, 0)}%</b>of trail and sites exposed</div>` : '') + (ch != null ? `<div><b>${fmt(ch, 0)} m</b>average canopy height</div>` : '') +
    (mort != null ? `<div><b>${fmt(Math.min(100, mort + (def || 0)), 0)}%</b>in tree damage mapped since 2016</div>` : '') + '</div>';
  /* the factors */
  const rows = WFDEF.map(([k, lab], i) => { const ss = R.map(x => x[1][1][i][5]).filter(v => v != null); const s = avg(ss); let t = '';
    switch (k){
      case 'expo': t = tpi == null ? 'no data' : `${fmt(Math.abs(tpi), 0)} m ${tpi >= 0 ? 'above' : 'below'} the ground 1 km around${exp != null ? `; ${fmt(exp, 0)}% of points exposed` : ''}`; break;
      case 'storm': { const yr = typeof wxYears === 'function' && wxYears(); const w = A('wx','WX_EV_WIND'), wi = A('wx','WX_EV_WINTER'); t = w == null && wi == null ? 'no data' : `${fmt(w || 0, 0)} damaging wind and ${fmt(wi || 0, 0)} ice or winter storm reports${yr ? ', ' + yr.join('–') : ''}`; break; }
      case 'pest': { const p = []; const fr = A('fhr','FHR_PCT'); if (fr != null) p.push(`${fmt(fr, 0)}% of treed area at risk, modeled`);
        if (mort != null) p.push(mort > 0 || def > 0 ? `${fmt(mort, 0)}% of points in mapped mortality, ${fmt(def || 0, 0)}% in defoliation since 2016` : 'no mortality or defoliation mapped at the trail since 2016');
        const hs = avg(cs.map(c => { const cp = val('veg','COMP',lv,c); if (!cp) return null; WFHX = wfTypes(/hemlock/i, WFHX); return wfShare(cp, WFHX.s); }).filter(v => v != null));
        if (hs) p.push(`hemlock types ${fmt(100 * hs, 0)}% of the vegetation`); t = p.length ? p.join('; ') : 'no data'; break; }
      case 'root': { const a = A('soil','SHALLOW_ROCK'), bb = A('soil','POOR_DRAIN'); const cf = avg(cs.map(c => { const cp = val('veg','COMP',lv,c); if (!cp) return null; WFCX = wfTypes(WFCONIF, WFCX); return wfShare(cp, WFCX.s); }).filter(v => v != null));
        const p = []; if (a != null || bb != null) p.push(`${fmt((a || 0) + (bb || 0), 0)}% shallow or poorly drained soils`); if (cf != null) p.push(`${fmt(100 * cf, 0)}% conifer types`); t = p.length ? p.join('; ') : 'no data'; break; }
      case 'tall': t = ch == null ? 'no data' : `${fmt(ch, 0)} m average`; break;
      case 'use': { const p = WFFEAT.map(f => [f, S_('feat', f)]).filter(x => x[1] > 0).map(([f, n]) => `${fmt(n, 0)} ${WFFEATN[f][n === 1 ? 0 : 1]}`);
        t = p.length ? p.join(', ') + (ns ? `; ${fmt(nse, 0)} of ${fmt(ns, 0)} exposed` : '') : 'trail only'; break; } }
    return [k, lab, s, t]; });
  b += '<div class="keys nosw">' + rows.map(([k, lab, s, t]) => soilRow(`${esc(lab)} <span style="color:var(--muted)">(${t}${many ? ', selected cells' : ''})</span>`, WFLEV(s))).join('') + '</div>';
  const top = rows.filter(r => r[2] != null && r[2] >= .67).sort((p, q) => (+WFW[q[0]] || 0) * q[2] - (+WFW[p[0]] || 0) * p[2]).slice(0, 3).map(r => r[1].toLowerCase());
  const low = rows.filter(r => r[2] != null && r[2] < .33 && (+WFW[r[0]] || 0) >= 15).map(r => r[1].toLowerCase());
  if (top.length || low.length) b += `<p style="font-size:13.5px;margin-top:8px">${top.length ? 'Driven here by ' + top.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : ''}${low.length ? ` Held down by low ${low.join(' and ')}.` : ''}</p>`;
  /* forest pests recorded */
  const pl = [...new Set(cs.flatMap(c => invL('PEST_LIST', lv, c) || []))].map(i => sppName(i)).filter(n => n && (n.common || n.sci));
  if (pl.length) b += `<p style="font-size:13.5px">Forest pests recorded: ${pl.map(n => esc(n.common || n.sci)).join(', ')}.</p>`;
  return b + `<p class="none" style="font-size:13.5px;margin-top:8px">High, moderate and low show how strongly each factor runs here compared with other scored trail cells. The score multiplies wind loading, tree weakness and people at risk, so it is high only where all three line up. A screening score for where trees are most likely to come down across the trail and at high-use sites, not a stand or hazard tree assessment; the windfall study’s models will replace it.</p></div>`; }
/* the top of the bar chart along the trail for the slope measures: a little over the 95th percentile of the cells, rounded up to 5,
   so the differences between stretches show (the few taller bars are drawn to the top and marked) */
const TVTOP = {};
function tvTop(lv, f){ const key = f + '|' + lv + '|' + S.ext, t = D.themes.slope && D.themes.slope[lv]; if (!t || !t.f[f]) return 100;
  if (TVTOP[key] && TVTOP[key].lev === D.levels[lv]) return TVTOP[key].v; const a = t.f[f].filter(v => v != null).sort((p, q) => p - q);
  const v = a.length ? Math.max(5, Math.ceil(a[Math.floor(.95 * (a.length - 1))] * 1.1 / 5) * 5) : 100; TVTOP[key] = {lev:D.levels[lv], v}; return v; }
/* Model weights: one row per factor, a number from 0 to 50; Reset puts back the recommended weights */
let TVD = null;   /* the weights being edited; TVW (what the scores use) changes only on Apply */
const tvSame = (a, b) => TVDEF.every(d => (+a[d[0]] || 0) === (+b[d[0]] || 0));
function tvWeightsHTML(){ if (!TVD) TVD = Object.assign({}, TVW); const tot = TVDEF.reduce((t, d) => t + (+TVD[d[0]] || 0), 0), left = Math.round((100 - tot) * 10) / 10, f1 = x => fmt(x, x % 1 ? 1 : 0);
  const changed = !tvSame(TVD, TVW), isRec = TVDEF.every(d => (+TVD[d[0]] || 0) === d[2]);
  return '<div class="tvw2" role="group" aria-label="Model weights">' + TVDEF.map(([k, lab, w0, th, note]) => { const w = +TVD[k] || 0;
    return `<div class="tvr"><span class="tvl" title="${esc(note)}">${esc(lab)}</span><span class="tvbar" aria-hidden="true"><i style="width:${Math.min(100, w * 2)}%"></i></span>` +
      `<button type="button" class="tvs" data-tvs="${k}" data-d="-1" aria-label="Lower ${esc(lab)}"${w <= 0 ? ' disabled' : ''}>−</button><b aria-live="polite">${f1(w)}</b>` +
      `<button type="button" class="tvs" data-tvs="${k}" data-d="1" aria-label="Raise ${esc(lab)}"${left <= 0 ? ' disabled' : ''}>+</button></div>`; }).join('') + '</div>' +
    `<p class="tvleft${left ? ' due' : ''}">${left > 0 ? `<b>${f1(left)}</b> ${left === 1 ? 'point' : 'points'} left to assign. Raise a factor to use ${left === 1 ? 'it' : 'them'}.` : 'All 100 points are assigned.'}${changed ? ' Press Apply to update the scores.' : ''}</p>` +
    `<div class="tvbtns"><button type="button" class="tvapply" data-tvapply="1"${changed && !left ? '' : ' disabled'}>Apply</button>` +
    (changed ? '<button type="button" class="lbtn" data-tvundo="1">Undo changes</button>' : '') + (isRec ? '' : '<button type="button" class="lbtn" data-tvreset="1">Reset to recommended</button>') + '</div>' +
    `<details class="tvabout"${store.get('tvabout', false) ? ' open' : ''}><summary>About the weights</summary>` + '<p class="phnote">The weights share 100 points. Lower one factor to free points, then raise another. Recommended weights were tested against the 16,373 problems recorded in the trail assessments. Grade matched recorded erosion best, measured on the steepest 500-foot segments rather than averaged over the cell, then heavy rain, hillside steepness, how directly the trail runs up the slope, and use hot spots; the soil ratings matched little, and erodible soils, rutting hazard and the 25-year storm not at all, so they are left out. Forest pests and invasive plants carry a low weight as early signs of declining forest health.</p></details>'; }
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('tvabout')) store.set('tvabout', e.target.open); }, true);
function tvRefresh(full){ for (const k in TVRANK) delete TVRANK[k]; BRK.clear(); restyle(); strip(); legend(); qVizRefresh(); if (full) side(); else { const p = $('#pbody'); if (p && (S.cell != null || S.box)) profileRefresh(); } }
const profileRefresh = () => { if (S.box) side(); else if (S.cell != null) profile(); };
let TVBASE = null;
function tvRebalance(k, v){ if (!TVBASE) TVBASE = Object.assign({}, TVW); const ks = TVDEF.map(d => d[0]), oth = ks.filter(x => x !== k), st = 2.5;
  v = Math.max(0, Math.min(100, Math.round(v / st) * st)); const rem = 100 - v, o = oth.reduce((t, x) => t + (+TVBASE[x] || 0), 0);
  oth.forEach(x => { const raw = o > 0 ? (+TVBASE[x] || 0) * rem / o : rem / oth.length; TVW[x] = Math.round(raw / st) * st; }); TVW[k] = v;
  let diff = Math.round((100 - ks.reduce((t, x) => t + TVW[x], 0)) / st);   // rounding left over, in steps: given to (or taken from) the largest
  for (let g = 0; diff !== 0 && g < 200; g++){ const pool = oth.filter(x => diff > 0 || TVW[x] >= st); if (!pool.length) break;
    const x = pool.reduce((a, b) => (TVBASE[b] || 0) > (TVBASE[a] || 0) || ((TVBASE[b] || 0) === (TVBASE[a] || 0) && TVW[b] > TVW[a]) ? b : a); TVW[x] += diff > 0 ? st : -st; diff += diff > 0 ? -1 : 1; }
  document.querySelectorAll('[data-tvw]').forEach(el => { const w = TVW[el.dataset.tvw]; if (el.dataset.tvw !== k) el.value = w; const b = el.parentNode.querySelector('b'); if (b) b.textContent = w; }); }
document.addEventListener('input', e => { const t = e.target.closest && e.target.closest('[data-tvw]'); if (!t) return; tvRebalance(t.dataset.tvw, +t.value); tvRefresh(false); });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('[data-tvw]')){ TVBASE = null; side(); } });
const tvwDraw = () => { const el = $('#tvwts'); if (el) el.innerHTML = tvWeightsHTML(); };
document.addEventListener('click', e => { const s = e.target.closest('[data-tvs]');
  if (s){ const k = s.dataset.tvs, tot = TVDEF.reduce((t, d) => t + (+TVD[d[0]] || 0), 0), st = 2.5;
    TVD[k] = +s.dataset.d > 0 ? Math.min((+TVD[k] || 0) + st, (+TVD[k] || 0) + Math.max(0, 100 - tot)) : Math.max(0, (+TVD[k] || 0) - st);
    tvwDraw(); const again = document.querySelector(`[data-tvs="${k}"][data-d="${s.dataset.d}"]`); if (again && !again.disabled) again.focus(); return; }
  if (e.target.closest('[data-tvapply]')){ TVDEF.forEach(d => TVW[d[0]] = +TVD[d[0]] || 0); tvRefresh(true); return; }
  if (e.target.closest('[data-tvundo]')){ TVD = Object.assign({}, TVW); tvwDraw(); return; }
  if (e.target.closest('[data-tvreset]')){ TVDEF.forEach(d => TVD[d[0]] = d[2]); tvwDraw(); } });
/* Visualizations. Climograph: precipitation bars and mean temperature line by month, averaged over the cells */
function wxClimo(lv, cells, hiMon){ const P = Array(12).fill(0), T = Array(12).fill(0); let n = 0;
  cells.forEach(c => { const p = wxList(lv, c, 'WX_PPT_M'), t = wxList(lv, c, 'WX_TMEAN_M'); if (!p || !t) return; n++; p.forEach((x, i) => P[i] += x); t.forEach((x, i) => T[i] += x); });
  if (!n) return ''; for (let i = 0; i < 12; i++){ P[i] /= n; T[i] /= n; }
  const W = 272, H = 150, pl = 26, pr = 28, top = 10, base = 124, pw = W - pl - pr, bw = pw / 12, pm = Math.max(1, Math.ceil(Math.max(...P))), tlo = Math.floor(Math.min(...T, 20) / 10) * 10, thi = Math.ceil(Math.max(...T, 70) / 10) * 10;
  const yp = v => base - (base - top) * v / pm, yt = v => base - (base - top) * (v - tlo) / (thi - tlo), f = v => v.toFixed(1);
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Average precipitation and temperature by month">`;
  for (let v = 0; v <= pm; v += pm > 6 ? 2 : 1) g += `<line x1="${pl}" x2="${W - pr}" y1="${f(yp(v))}" y2="${f(yp(v))}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 4}" y="${f(yp(v) + 3)}" text-anchor="end" font-size="9" fill="#9FB2C8">${v}${v && v + (pm > 6 ? 2 : 1) > pm ? ' in' : ''}</text>`;
  for (let v = tlo; v <= thi; v += 20) g += `<text x="${W - pr + 4}" y="${f(yt(v) + 3)}" font-size="9" fill="#F0A47A">${v}°${v + 20 > thi ? 'F' : ''}</text>`;
  P.forEach((v, i) => { const on = hiMon != null && hiMon === i; g += `<g${S.m.wxAnim === 'mon' ? ` data-wxm="${i}" style="cursor:pointer"` : ''}><rect x="${f(pl + i * bw + 2)}" y="${f(yp(v))}" width="${f(bw - 4)}" height="${f(base - yp(v))}" rx="1.5" fill="${on ? '#FFFFFF' : HUE.wx}" opacity="${hiMon == null || on ? 1 : .55}"/>` +
    `<text x="${f(pl + (i + .5) * bw)}" y="${base + 12}" text-anchor="middle" font-size="9" fill="${on ? '#FFFFFF' : '#C9D4E2'}"${on ? ' font-weight="700"' : ''}>${wxMonths[i][0]}</text><title>${MONTHS_LONG[i]}: ${fmt(v, 1)} in of precipitation, ${fmt(T[i], 0)}°F average${S.m.wxAnim === 'mon' ? '. Tap to show this month on the map' : ''}</title></g>`; });
  g += `<polyline points="${T.map((v, i) => f(pl + (i + .5) * bw) + ',' + f(yt(v))).join(' ')}" fill="none" stroke="#F0A47A" stroke-width="2" stroke-linejoin="round"/>`;
  T.forEach((v, i) => g += `<circle cx="${f(pl + (i + .5) * bw)}" cy="${f(yt(v))}" r="${hiMon === i ? 3.6 : 2.2}" fill="#F0A47A" stroke="#12223A" stroke-width=".6"><title>${MONTHS_LONG[i]}: ${fmt(v, 0)}°F average temperature</title></circle>`);
  g += `<text x="${pl}" y="${H - 3}" font-size="9" fill="#9FB2C8">Precipitation, inches (bars)</text><text x="${W - pr + 22}" y="${H - 3}" text-anchor="end" font-size="9" fill="#F0A47A">Mean temperature (line)</text>`;
  return g + `</svg><p class="phstat">${fmt(P.reduce((s, x) => s + x, 0), 1)} inches a year; ${fmt(Math.min(...T), 0)}°F in ${MONTHS_LONG[T.indexOf(Math.min(...T))]} to ${fmt(Math.max(...T), 0)}°F in ${MONTHS_LONG[T.indexOf(Math.max(...T))]}${n > 1 ? `, averaged over ${nCells(n)}` : ''}.</p>`; }
/* storm events by year: average events per cell each year (a zone-wide event counts once in each cell it covers) */
function wxStorms(lv, cells, g){ const ys = wxYears(); if (!ys) return ''; const k = WXEVK.indexOf(g), s = new Map(); let n = 0;
  for (let y = ys[0]; y <= ys[1]; y++) s.set(y, 0);
  cells.forEach(c => { if (!has('wx', lv, c) || val('wx','WX_EV_' + g, lv, c) == null) return; n++; const a = wxList(lv, c, 'WX_EV_Y') || []; for (let i = 0; i < a.length; i += 4) if (s.has(a[i])) s.set(a[i], s.get(a[i]) + a[i + 1 + k]); });
  if (!n) return ''; const Y = [...s].map(([y, v]) => [y, v / n]), mx = Math.max(...Y.map(e => e[1]), .1), W = 272, H = 130, pl = 26, pr = 6, top = 8, base = 108, pw = W - pl - pr, bw = pw / Y.length, f = v => v.toFixed(1), col = WXRAMP[g][5];
  const st = niceNum(mx / 3) || .1; let h = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(WXEV[g])} events by year">`;
  for (let v = 0; v <= mx + 1e-9; v += st){ const y = base - (base - top) * v / mx; h += `<line x1="${pl}" x2="${W - pr}" y1="${f(y)}" y2="${f(y)}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 4}" y="${f(y + 3)}" text-anchor="end" font-size="9" fill="#9FB2C8">${fmt(v, st >= 1 ? 0 : Math.abs(st * 10 - Math.round(st * 10)) > 1e-9 ? 2 : 1)}</text>`; }
  Y.forEach(([y, v], i) => { const on = S.wxYr === y, hh = (base - top) * v / mx; h += `<g data-wxm="${y}" style="cursor:pointer"><rect x="${f(pl + i * bw)}" y="${top}" width="${f(bw)}" height="${base - top}" fill="transparent"/><rect x="${f(pl + i * bw + .6)}" y="${f(base - hh)}" width="${f(Math.max(.8, bw - 1.2))}" height="${f(hh)}" fill="${on ? '#FFFFFF' : col}"/><title>${y}: ${fmt(v, 2)} ${WXEV[g]} events per cell. Tap to show this year on the map</title></g>`;
    if (y % 5 === 0) h += `<text x="${f(pl + (i + .5) * bw)}" y="${base + 12}" text-anchor="${i >= Y.length - 2 ? 'end' : 'middle'}" font-size="9" fill="#C9D4E2">${y}</text>`; });
  const tot = Y.reduce((a, e) => a + e[1], 0), big = Y.slice().sort((a, b) => b[1] - a[1])[0];
  const sy = S.wxYr && Y.find(e => e[0] === S.wxYr);
  return h + `</svg><p class="phstat">${sy ? `<b>${sy[0]}:</b> ${fmt(sy[1], sy[1] < 1 ? 2 : 1)} events per cell. ` : ''}${fmt(tot / Y.length, tot / Y.length < 1 ? 2 : 1)} events a year per cell on average${n > 1 ? ` over ${nCells(n)}` : ''}; the most in ${big[0]} (${fmt(big[1], big[1] < 1 ? 2 : 1)}).</p>`; }
/* everything else: cells by the map's classes */
function wxClassRows(lv, cells, m){ const C = wxClasses(m, lv), B = C.b, R = WXRAMP[m.wxRamp], sh = m.showFn || (v => fmt(v, m.d)), cnt = Array(B.length + 1).fill(0); let n = 0, z = 0;
  cells.forEach(c => { const v = m.get(lv, c); if (v == null) return; n++; if (m.wxSkew && v === 0){ z++; return; } let i = 0; while (i < B.length && v > B[i]) i++; cnt[i]++; });
  if (!n) return []; const rows = cnt.map((k, i) => [!B.length ? (m.wxSkew ? 'Some reported' : 'All cells') : i === 0 ? (m.wxSkew ? 'up to ' : 'under ') + sh(B[0]) : i === B.length ? sh(B[i - 1]) + ' or more' : sh(B[i - 1]) + ' to ' + sh(B[i]), R[Math.round(i * (R.length - 1) / Math.max(1, B.length))], k, vPct(k, n), '']).filter(r => r[2] > 0);
  if (z) rows.unshift(['None reported', ZERO, z, vPct(z, n), '']); rows.forEach(r => r[4] = `${r[0]}: ${nCells(r[2])} of ${n}`); return rows.reverse(); }
/* animation: months of the normals (precipitation, temperature) or years of storm events */
let wxTimer = null;
function wxAnimOn(){ return S.q.id === 'wx' && !!S.m.wxAnim && !S.m.find; }
/* controls: Play, an always-visible "All year" / "Average" button (pressed when nothing is picked), and the months as buttons or the
   years on a slider. Tapping the picked month or year again, a month bar or a year column in the chart, or "All year" goes back.
   Picking a new measure or question starts again from the whole year / average */
function wxCtl(){ const m = S.m; if (!m.wxAnim) return '';
  if (m.wxAnim === 'mon'){ if (!wxHasList(dispLevel(), m.wxMonF)) return '';
    return `<div id="wxctl"><div class="acqctl"><button type="button" class="phplay" data-wxplay="1" aria-pressed="${!!wxTimer}">${wxTimer ? 'Pause' : 'Play months'}</button>` +
      `<span class="wxnow">${S.wxMon != null ? 'Showing <b>' + MONTHS_LONG[S.wxMon] + '</b>' : 'Showing the <b>whole year</b>'}</span></div>` +
      `<div class="wxmon" role="group" aria-label="Month"><button type="button" data-wxall="1" aria-pressed="${S.wxMon == null}">All year</button>` +
      wxMonths.map((n, i) => `<button type="button" data-wxm="${i}" aria-pressed="${S.wxMon === i}" title="${MONTHS_LONG[i]}">${n}</button>`).join('') + '</div></div>'; }
  const ys = wxYears(); if (!ys) return '';
  return `<div id="wxctl"><div class="acqctl"><button type="button" class="phplay" data-wxplay="1" aria-pressed="${!!wxTimer}">${wxTimer ? 'Pause' : 'Play years'}</button>` +
    `<span class="wxnow">${S.wxYr ? 'Showing <b>' + S.wxYr + '</b>' : 'Showing the <b>average year</b>'}</span></div>` +
    `<div class="wxyrs"><button type="button" data-wxall="1" aria-pressed="${!S.wxYr}">Average</button>` +
    `<label class="wxsl${S.wxYr ? '' : ' off'}"><span>${ys[0]}</span><input type="range" id="wxyr" min="${ys[0]}" max="${ys[1]}" step="1" value="${S.wxYr || ys[1]}" aria-label="Pick a year"><span>${ys[1]}</span></label></div>` +
    `<p class="phstat" style="margin-top:2px">${S.wxYr ? 'Drag the slider or tap a column to change the year; tap Average to go back.' : 'Drag the slider or tap a column to show one year.'}</p></div>`; }
function wxCtlRefresh(){ const c = $('#wxctl'); if (c) c.outerHTML = wxCtl(); }
function wxFrame(full, keepCtl){ if (!keepCtl) wxCtlRefresh(); else { const t = document.querySelector('#wxctl .wxnow'), sl = document.querySelector('#wxctl .wxsl'), av = document.querySelector('#wxctl [data-wxall]');
    if (t) t.innerHTML = S.m.wxAnim === 'mon' ? (S.wxMon != null ? 'Showing <b>' + MONTHS_LONG[S.wxMon] + '</b>' : 'Showing the <b>whole year</b>') : (S.wxYr ? 'Showing <b>' + S.wxYr + '</b>' : 'Showing the <b>average year</b>');
    if (sl) sl.classList.toggle('off', !S.wxYr); if (av) av.setAttribute('aria-pressed', String(S.m.wxAnim === 'mon' ? S.wxMon == null : !S.wxYr)); }
  BRK.clear(); restyle(); strip(); legend(); phTick(); qVizRefresh(); if (full) side(); }
function wxReset(){ if (wxTimer){ clearInterval(wxTimer); wxTimer = null; } S.wxMon = null; S.wxYr = null; }
function wxPick(v){ if (wxTimer){ clearInterval(wxTimer); wxTimer = null; } if (S.m.wxAnim === 'mon') S.wxMon = v == null || S.wxMon === v ? null : v; else S.wxYr = v == null || S.wxYr === v ? null : v; wxFrame(true); }
function wxPlay(on){ if (wxTimer){ clearInterval(wxTimer); wxTimer = null; } const m = S.m, ys = wxYears();
  if (on && m.wxAnim){ const mon = m.wxAnim === 'mon';
    if (mon){ if (S.wxMon == null || S.wxMon >= 11) S.wxMon = -1; } else if (ys){ if (!S.wxYr || S.wxYr >= ys[1]) S.wxYr = ys[0] - 1; } else return;
    wxTimer = setInterval(() => { if (S.q.id !== 'wx' || S.m !== m){ clearInterval(wxTimer); wxTimer = null; return; }
      if (mon ? S.wxMon >= 11 : S.wxYr >= ys[1]){ clearInterval(wxTimer); wxTimer = null; S.wxMon = null; S.wxYr = null; wxFrame(true); return; }
      if (mon) S.wxMon++; else S.wxYr++; wxFrame(false); const r = $('#wxyr'); if (r && S.wxYr) r.value = S.wxYr; }, mon ? 650 : 800);
    wxFrame(false); return; }
  wxFrame(true); }
document.addEventListener('click', e => { if (e.target.closest('[data-wxplay]')) wxPlay(!wxTimer);
  else if (e.target.closest('[data-wxall]')) wxPick(null);
  else { const t = e.target.closest('[data-wxm]'); if (t && S.q.id === 'wx') wxPick(+t.dataset.wxm); } });
document.addEventListener('input', e => { if (e.target.id === 'wxyr'){ if (wxTimer){ clearInterval(wxTimer); wxTimer = null; } S.wxYr = +e.target.value; wxFrame(false, true); } });
document.addEventListener('change', e => { if (e.target.id === 'wxyr') side(); });
/* share of cells in each class of the measure on show, whole trail or the trail section picked */
function geoBars(rows, label, tip){ return hbars(rows.map(([nm, col, v]) => { const t = v === 0 ? '0' : v < 1 ? '<1' : Math.round(v); return [nm, col, v, t + '%', `${nm}: ${t}% ${tip}`]; }), label); }
/* share of cells in each class of the measure on show, for the selection or the cells in view */
function geoShareHTML(lv){ const m = S.m; if (m.kind !== 'cat' || m.id === 'lith' || !D.themes.geo[lv]) return '';
  const [sl, cells, where] = geoScope(lv), cnt = new Map(); let n = 0;
  cells.forEach(c => { const v = m.get(sl, c); if (v == null) return; n++; cnt.set(v, (cnt.get(v) || 0) + 1); });
  let g = `<div id="geoshare"><h4 class="phh">Share of cells: ${esc(m.label.toLowerCase())}, ${esc(where)}</h4>`;
  if (!n) return g + `<p class="none">No data for ${esc(where)}.</p></div>`;
  const order = m.many ? [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => CATMAP[m.f].get(D.cats[m.f][x[0]])) : CATCOL[m.f];
  const rows = order.map(e => [String(e[2] || e[0]).replace(/ \(.*\)/, ''), e[1], 100 * (cnt.get(D.cats[m.f].indexOf(e[0])) || 0) / n]).filter(r => r[2] > 0);
  return g + geoBars(rows, 'Share of cells, ' + where, `of ${n === 1 ? 'the cell' : 'the ' + n + ' cells'} in ${where}`) + `<p class="phnote">${n === 1 ? 'The selected cell, by' : `Share of the ${fmt(n, 0)} cells with data in ${esc(where)}, each counted by`} the class covering the most of ${n === 1 ? 'it' : 'the cell'}${where === 'the map view' ? ' (zoom or pan to change it, or select cells)' : ''}.</p></div>`; }
/* the cells behind the bedrock chart: the selection, else the cells in view (and in the trail section picked) */
function geoScope(lv){
  if (S.box && S.box.cells && S.box.cells.length) return [S.box.lv, S.box.cells, `the ${S.box.cells.length} selected cells`];
  if (S.cell != null && D.levels[S.cellLv]) return [S.cellLv, [S.cell], 'the selected cell'];
  const L_ = D.levels[lv], b = map.getBounds(), out = []; for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c) && b.contains(L_.c[c])) out.push(c); return [lv, out, 'the map view']; }
function geoLithHTML(lv){ if (!GEOT || !D.themes.geo[lv]) return '';
  const [sl, cells, where] = geoScope(lv), ci = cells.filter(c => has('geo', sl, c)), sum = new Map(); let n = 0, byMain = false;
  ci.forEach(c => { const p = val('geo','PCT_LITH',sl,c); if (!p) return; n++; for (let k = 0; k < p.length; k += 2) sum.set(p[k], (sum.get(p[k]) || 0) + p[k + 1]); });
  if (!n){ byMain = true; ci.forEach(c => { const v = val('geo','GEO_LITH',sl,c); if (v == null) return; n++; sum.set(v, (sum.get(v) || 0) + 100); }); }
  let g = `<div id="geolith"${S.m.id === 'lith' ? '' : ' style="margin-top:14px;padding-top:12px;border-top:1px solid #2E4460"'}><h4 class="phh">Bedrock by type, ${esc(where)}</h4>`;
  if (!n) return g + `<p class="none">No bedrock summary for ${esc(where)}.</p></div>`;
  const rows = [...sum].map(([k, v]) => [k, v / n]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
  g += hbars(rows.map(([k, v]) => { const e = CATCOL.GEO_LITH[k] || ['Other', '#ccc'], t = v < 1 ? '<1' : Math.round(v);
    return [e[0].replace(/ \(.*\)/, ''), e[1], v, t + '%', `${e[0]}: ${t}% of ${byMain ? 'the cells (by main type)' : 'the mapped area'} in ${where}`]; }), 'Bedrock by type, ' + where);
  return g + `<p class="phnote">${byMain ? 'Share of cells by their main bedrock type (the area split is given only for the 7 and 49 sq mi cells here)' : (n === 1 ? 'Share of the mapped area' : 'Share of the mapped area, averaged over ' + nCells(n) + ',')} in ${esc(where)}${where === 'the map view' ? ' (zoom or pan to change it, or select cells)' : ''}. USGS State Geologic Map Compilation.</p></div>`; }
/* one horizontal bar chart per question. rows: [label, color, value, value text, tooltip, species key (click to map it)] */
function hbars(rows, aria){ const mx = Math.max(...rows.map(r => r[2]), 1e-9), sel = S.m.find && S.m.find.ls;
  return `<div class="hb" role="list" aria-label="${esc(aria)}">` + rows.map(([name, col, v, txt, tip, sp, hi]) => { const on = sp && sel === sp, w = v > 0 ? Math.max(.006, v / mx) : 0;
    return `<div class="hbr${sp ? ' hbc' : ''}${on || hi ? ' on' : ''}" role="listitem"${sp ? ` data-cultsp="${esc(sp)}"` : ''} title="${esc(tip || name + ': ' + txt)}"><span class="hbl">${esc(name)}</span>` +
      `<span class="hbt"><i style="width:calc((100% - 70px) * ${w.toFixed(4)});background:${col}"></i><b>${esc(txt)}</b></span></div>`; }).join('') + '</div>'; }
function vizBars(rows, aria){ return hbars(rows, aria); }
const vPct = (v, t) => { const p = t ? 100 * v / t : 0; return p > 0 && p < 1 ? '<1%' : Math.round(p) + '%'; };
const vTop = (m, n) => [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n || 10);
const vSpp = (lv, cells, f, th) => { const m = new Map(); cells.forEach(c => (f ? f(c) : val(th, 'X', lv, c) || []).forEach(i => m.set(i, (m.get(i) || 0) + 1))); return m; };
const vSpRow = (i, n, col, tip) => { const p = sppName(i); return [p.common || p.sci, col, n, fmt(n, 0), `${p.common ? p.common + ' (' + p.sci + ')' : p.sci}: ${tip}. Click to map it.`, p.sci.toLowerCase()]; };
const FCOL = {'Shelters':'#D62839', 'Campsites':'#2E6B3A', 'Privies':'#74224E', 'Parking areas':'#23436B', 'Bridges':'#4FA096', 'Vistas':'#B38E2F', 'Buildings':'#A089CC', 'Dams':'#801818', 'Tunnels':'#3D3D3D'};
const QVIZ = {
  land: {title:'Land by administrator', note:'Share of the mapped A.T. land, from the tract records summarized to each cell. Generalized to the grid; not a boundary determination.', fn(lv, cells, nTop){
    const m = new Map(); let tot = 0; cells.forEach(c => { const p = val('lands','MGRS',lv,c), ac = val('lands','LAND_AC',lv,c) || 0; if (!p) return; for (let k = 0; k < p.length; k += 2){ const a = ac * p[k + 1] / 100; m.set(p[k], (m.get(p[k]) || 0) + a); tot += a; } });
    return vTop(m, nTop || 10).map(([i, a]) => [tcase(D.cats.MGR[i]), HUE.lands, a, vPct(a, tot), `${tcase(D.cats.MGR[i])}: ${fmt(Math.round(a), 0)} acres, ${vPct(a, tot)} of the mapped land`]); }},
  veg: {title:'Top 10 vegetation types', note:'Acres of each type in the APPA vegetation map.', fn(lv, cells){
    const m = new Map(); cells.forEach(c => { const cp = val('veg','COMP',lv,c), ac = val('veg','VEG_AREA',lv,c) || 0; if (!cp) return; for (let k = 0; k < cp.length; k += 2) m.set(cp[k], (m.get(cp[k]) || 0) + ac * cp[k + 1] / 100); });
    return vTop(m).map(([i, a]) => { const nm = D.cats.DOM_TYPE[i], e = CATMAP.DOM_TYPE.get(nm); return [nm, e ? e[1] : HUE.veg, a, fmt(Math.round(a), 0) + ' ac', `${nm}: ${fmt(Math.round(a), 0)} acres`]; }); }},
  rec: {title:'Top 10 most-recorded species', note:'Research-grade iNaturalist records, counted from each cell’s ten most-recorded species (quarterly summary). Click a species to map it.', fn(lv, cells){
    const m = new Map(); cells.forEach(c => { const t = val('inat','TOP10_SPECIES',lv,c) || [], n = val('inat','TOP10_COUNTS',lv,c) || []; t.forEach((i, k) => m.set(i, (m.get(i) || 0) + (n[k] || 0))); });
    return vTop(m).map(([i, n]) => vSpRow(i, n, HUE.live, `${fmt(n, 0)} records`)); }},
  inv: {title:'Top 10 invasive species', note:'Cells where each invasive species has been reported to iNaturalist or EDDMapS. Click a species to map it.', fn(lv, cells){
    return vTop(vSpp(lv, cells, c => invL('INVASIVE_LIST', lv, c) || [])).map(([i, n]) => vSpRow(i, n, HUE.inat, `reported in ${nCells(n)}`)); }},
  eff: {get title(){ return S.visAdj ? 'Visitation index by year' : 'Observer-days per year'; }, get note(){ return S.visAdj ? 'Each column compares this area’s observer-days per cell with the average cell in the whole extent that same year, so the growth in iNaturalist use cancels out: 100 is average, 200 twice as busy. An observer-day is one person active in a square mile on one day (iNaturalist, eBird and EDDMapS together). Tap a column for its count and to show that year on the map. eBird reaches GBIF about a year late, so the latest years lean on iNaturalist.' : 'Total observer-days each year (one person active in a square mile on one day; iNaturalist, eBird and EDDMapS together). iNaturalist use has grown many times over since 2010, so most of the rise is more people using the app rather than more visitors: compare years with care. Tap a column to show that year on the map.'; }, x_note:'Observer-days each year since 2010, iNaturalist, eBird and EDDMapS together. eBird reaches GBIF about a year late, so the latest years lean on iNaturalist; the current year is partial.', fn(lv, cells){
    const m = new Map(); cells.forEach(c => { const a = visList(lv, c, 'VIS_OD_Y'); if (!a) return; for (let k = 0; k < a.length; k += 2) m.set(a[k], (m.get(a[k]) || 0) + a[k + 1]); });
    const y = new Date().getFullYear(), N = cells.length || 1; return vHi([...m].sort((a, b) => a[0] - b[0]).map(([yy, n]) => { const ix = S.visAdj ? visIdx(n / N, lv, yy) : null;
      return ix != null ? [String(yy), HUE.eff, ix, fmt(ix, 0), `${yy}: index ${fmt(ix, 0)} (${fmt(n, 0)} observer-days; 100 = the average cell that year)`] : [String(yy), HUE.eff, n, fmt(n, 0), `${yy}: ${fmt(n, 0)} observer-days`]; }), r => S.visYr ? +r[0] === S.visYr : +r[0] >= y - 3 && +r[0] < y); }},
  bird: {title:'Top 10 birds of conservation concern', note:'Cells with eBird checklists that recorded each species on the USFWS Birds of Conservation Concern or Partners in Flight watch lists. Click a species to map it.', fn(lv, cells){
    return vTop(vSpp(lv, cells, c => val('ebird','SOC_LIST',lv,c) || [])).map(([i, n]) => vSpRow(i, n, HUE.ebird, `recorded in ${nCells(n)}`)); }},
  soil: {title:'Cells by trail vulnerability', note:'Each cell’s trail vulnerability index (NRCS gSSURGO): low under 0.33, high over 0.67.', fn(lv, cells){
    const m = new Map([['High', 0], ['Moderate', 0], ['Low', 0]]); let n = 0; cells.forEach(c => { const k = vulnClass(val('soil','VULN',lv,c)); if (k){ m.set(k, m.get(k) + 1); n++; } });
    const col = {High:'#7A4A24', Moderate:'#B9844C', Low:'#E3C9A1'}; return n ? [...m].filter(([, v]) => v > 0).map(([k, v]) => [k, col[k], v, vPct(v, n), `${k}: ${nCells(v)} of ${n}`]) : []; }},
  wet: {title:'Wetland acres by type', note:'USFWS National Wetlands Inventory, acres in the whole cell.', fn(lv, cells){
    const T = [['T_FFS','Forested/shrub wetland','#008837'],['T_FEM','Emergent wetland','#7FC31C'],['T_POND','Pond','#688CC0'],['T_LAKE','Lake','#13007C'],['T_RIV','Riverine','#0190BF'],['T_EST','Estuarine and marine','#66C2A5'],['T_OTH','Other','#B28653']];
    const rows = T.map(([f, nm, col]) => { let a = 0; cells.forEach(c => a += val('wet', f, lv, c) || 0); return [nm, col, a, fmt(Math.round(a), 0) + ' ac', `${nm}: ${fmt(Math.round(a), 0)} acres`]; });
    return rows.some(r => r[2] > 0) ? rows.filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]) : []; }},
  rest: {title:'What drives the score', note:'Average points from each factor, over the cells with a score. Herbicide use and the lands setting apply as on the map.', fn(lv, cells){
    const kind = S.m.id === 'forest' ? 'forest' : 'grass', d = RESTDEF[kind], s = d.parts.map(() => 0); let n = 0;
    cells.forEach(c => { if (!has('veg', lv, c)) return; const r = restParts(kind, lv, c); if (r[0] == null) return; n++; r[1].forEach((p, k) => s[k] += p[2]); });
    return n ? d.parts.map(([k, lab, w], i) => [lab, HUE.rest, s[i] / n, `${fmt(s[i] / n, 1)} of ${w}`, `${lab}: ${fmt(s[i] / n, 1)} of ${w} points on average, over ${nCells(n)}`]) : []; }},
  pri: {title:'Cells by unique species rating', note:'Number of cells in each rating, from the rare species priority zones. A cell takes the rating of the zone it falls in.', fn(lv, cells){
    if (!D.themes.nrpz[lv]) return []; const m = new Map(); let n = 0; cells.forEach(c => { const t = val('nrpz','review_tie',lv,c); if (t == null) return; const lab = D.cats.review_tie[t]; m.set(lab, (m.get(lab) || 0) + 1); n++; });
    return n ? CATCOL.review_tie.filter(e => m.get(e[0])).map(e => [e[2] || e[0], e[1], m.get(e[0]), vPct(m.get(e[0]), n), `${e[2] || e[0]}: ${nCells(m.get(e[0]))} of ${n}`]) : []; }},
  hist: {title:'Historic resources by type', note:'National Register of Historic Places (NPS) by property type, and cemeteries mapped in OpenStreetMap.', fn(lv, cells){
    const A = hAgg(lv); if (!A) return []; const m = new Map(), lab = {building:'Buildings', structure:'Structures', district:'Districts', site:'Sites', object:'Objects'};
    cells.forEach(c => (A.list.get(c) || []).forEach(i => { const x = HIST.items[i], k = x.t === 'cem' ? 'Cemeteries' : lab[String(x.a.type || '').toLowerCase()] || 'Other National Register'; m.set(k, (m.get(k) || 0) + 1); }));
    return vRampRows(vTop(m).map(([k, n]) => [k, HUE.hist, n, fmt(n, 0), `${k}: ${fmt(n, 0)}`]), 'hist'); }},
  feat: {title:'Facilities by type', note:'A.T. facilities inventory, official and additional features.', fn(lv, cells){
    const T = [['N_SHELTER','Shelters'],['N_CAMPSITE','Campsites'],['N_PRIVY','Privies'],['N_PARKING','Parking areas'],['N_BRIDGE','Bridges'],['N_VISTA','Vistas'],['N_BUILDING','Buildings'],['N_DAM','Dams'],['N_TUNNEL','Tunnels']];
    return T.map(([f, nm]) => { let n = 0; cells.forEach(c => n += val('feat', f, lv, c) || 0); return [nm, FCOL[nm] || HUE.feat, n, fmt(n, 0), `${nm}: ${fmt(n, 0)}`]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]); }}
};
/* measure-specific charts. pick(measure id) returns {title, note, fn} to use in place of the question's default chart */
const vRampRows = (rows, rp) => { const R = RAMP[rp], v = rows.map(r => +r[2] || 0), u = [...new Set(v)].sort((a, b) => a - b), n = u.length; rows.forEach((r, i) => { const k = u.indexOf(v[i]); r[1] = R[n < 2 ? R.length - 1 : Math.round((R.length - 1) * k / (n - 1))]; }); return rows; };
const vHi = (rows, test) => rows.map(r => (r[6] = !!test(r), r));
const vSpTop = (lv, cells, get, col, verb) => vTop(vSpp(lv, cells, get)).map(([i, n]) => vSpRow(i, n, col, `${verb} in ${nCells(n)}`));
const vHist = (lv, cells, m, col) => { const B = [[0, 0, 'None'], [0.0001, 10, 'Under 10%'], [10, 25, '10 to 25%'], [25, 50, '25 to 50%'], [50, 75, '50 to 75%'], [75, 101, '75% or more']], cnt = B.map(() => 0); let n = 0;
  cells.forEach(c => { const v = m.get(lv, c); if (v == null) return; n++; const k = v <= 0 ? 0 : B.findIndex((b, i) => i && v >= b[0] && v < b[1]); cnt[k < 0 ? B.length - 1 : k]++; });
  return n ? B.map((b, i) => [b[2], col, cnt[i], vPct(cnt[i], n), `${b[2]}: ${nCells(cnt[i])} of ${n}`]).filter(r => r[2] > 0) : []; };
const vVegTypes = (lv, cells, keep) => { const m = new Map(); cells.forEach(c => { const cp = val('veg','COMP',lv,c), ac = val('veg','VEG_AREA',lv,c) || 0; if (!cp) return; for (let k = 0; k < cp.length; k += 2) if (!keep || keep(D.typeL2[cp[k]])) m.set(cp[k], (m.get(cp[k]) || 0) + ac * cp[k + 1] / 100); });
  return vTop(m).map(([i, a]) => { const nm = D.cats.DOM_TYPE[i], e = CATMAP.DOM_TYPE.get(nm); return [nm, e ? e[1] : HUE.veg, a, fmt(Math.round(a), 0) + ' ac', `${nm}: ${fmt(Math.round(a), 0)} acres`]; }); };
const FORESTL2 = ['Deciduous Forest', 'Evergreen Forest', 'Mixed Forest'], OPENL2 = ['Shrub/Scrub', 'Grassland/Herbaceous', 'Pasture/Hay', 'Cultivated Crops'];
const RECGRP = {gplant:'PLANT', ginsect:'INSECT', gfungi:'FUNGI', gamphib:'AMPHIB', gmammal:'MAMMAL'};
const BIRDM = {fi:'FOREST_INT', fg:'FOREST_GEN', co:'CONIFER', sh:'SHRUB', gr:'GRASS', ed:'EDGE', we:'WETLAND', ri:'RIPARIAN', wb:'WATERBIRD', sb:'SHORE', se:'SEABIRD'};
const FEATT = [['N_SHELTER','Shelters','shel'],['N_CAMPSITE','Campsites','camp'],['N_PRIVY','Privies','priv'],['N_PARKING','Parking areas','park'],['N_BRIDGE','Bridges','brid'],['N_VISTA','Vistas','vist'],['N_BUILDING','Buildings'],['N_DAM','Dams'],['N_TUNNEL','Tunnels']];
QVIZ.land.pick = id => id === 'appa' ? {title:'Land by administrator', note:'Share of the mapped A.T. land, from the tract records summarized to each cell; NPS - APPA is highlighted. Generalized to the grid; not a boundary determination.', fn(lv, cells){ const all = vHi(QVIZ.land.fn(lv, cells, 999), r => /\bAPPA\b/.test(r[0])), top = all.slice(0, 10); all.slice(10).forEach(r => { if (r[6]) top.push(r); }); return top; }} : null;
QVIZ.veg.pick = id => id === 'cover' ? {title:'Land cover (NLCD level 2)', note:'Share of the mapped area in each National Land Cover Database class.', fn(lv, cells){
    const fld = k => String(k).startsWith('L2_') ? k : 'L2_' + k; let tot = 0; const s = L2.map(() => 0); cells.forEach(c => { const ac = val('veg','VEG_AREA',lv,c) || 0; L2.forEach(([k], i) => { const a = ac * (val('veg', fld(k), lv, c) || 0) / 100; s[i] += a; tot += a; }); });
    return L2.map(([k, nm, c2], i) => { const e = CATCOL.L2_DOM.find(x => x[0] === nm); return [nm, c2 || (e ? e[1] : HUE.veg), s[i], vPct(s[i], tot), `${nm}: ${fmt(Math.round(s[i]), 0)} acres, ${vPct(s[i], tot)}`]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 10); }}
  : id === 'open' ? {title:'Top 10 open-habitat types', note:'Acres of shrubland, grassland and agricultural vegetation types in the APPA vegetation map.', fn:(lv, cells) => vVegTypes(lv, cells, t => OPENL2.includes(t))}
  : id === 'forest' ? {title:'Top 10 forest types', note:'Acres of forest vegetation types in the APPA vegetation map.', fn:(lv, cells) => vVegTypes(lv, cells, t => FORESTL2.includes(t))} : null;
QVIZ.rec.pick = id => RECGRP[id] || id === 'native' ? {title:'Records by group', note:'Research-grade iNaturalist records in each group (quarterly summary); the group on the map is highlighted.', fn(lv, cells){
    return vHi(RECG.map(([lab, k]) => { let n = 0; cells.forEach(c => n += val('inat', k + '_OBS', lv, c) || 0); return [lab, HUE.live, n, fmt(n, 0), `${lab}: ${fmt(n, 0)} records`, null, k]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]), r => r[6] === (RECGRP[id] || (id === 'native' ? 'PLANT' : ''))); }}
  : id === 'recent' ? {title:'iNaturalist records per year', note:'Research-grade records each year since 2010; the last three years are highlighted. The latest year is partial.', fn(lv, cells){ const r = QVIZ.eff.fn(lv, cells), y = new Date().getFullYear(); return vHi(r, x => +x[0] >= y - 2); }} : null;
QVIZ.inv.pick = id => id === 'edrr' ? {title:'Top 10 priority invasives', note:'Cells where each priority (early detection) invasive has been reported to iNaturalist or EDDMapS. Click a species to map it.', fn:(lv, cells) => vSpTop(lv, cells, c => invL('EDRR_LIST', lv, c) || [], HUE.inat, 'reported')}
  : id === 'pest' ? {title:'Top forest pests', note:'Cells where each forest pest has been reported to iNaturalist or EDDMapS. Click a pest to map it.', fn:(lv, cells) => vSpTop(lv, cells, c => invL('PEST_LIST', lv, c) || [], HUE.inat, 'reported')}
  : id === 'eddrec' ? {title:'Top 10 invasives in EDDMapS', note:'Cells where each invasive species has an EDDMapS report. Click a species to map it.', fn:(lv, cells) => vSpTop(lv, cells, c => val('edd','EDD_INV_LIST',lv,c) || [], HUE.inat, 'reported')}
  : id === 'obs' ? {title:'Top 10 invasives on iNaturalist', note:'Cells where each invasive species has a research-grade iNaturalist record. Click a species to map it.', fn:(lv, cells) => vSpTop(lv, cells, c => val('inat','INVASIVE_LIST',lv,c) || [], HUE.inat, 'recorded')} : null;
QVIZ.eff.pick = id => VISPICK[id] ? Object.assign({html:null}, VISPICK[id]) : null;
QVIZ.eff.html = (lv, cells) => visYearChart(lv, cells);
/* one column per year from the first year with data to the current one. Adjusted: the cells' observer-days per cell as an index of the
   average cell in the whole extent that year (100 = average; growth in iNaturalist use cancels out). Not adjusted: total observer-days.
   Years with few observer-days are faded, since one or two visits swing the index a long way; the current year is partial */
const VISTHIN = 10;
function visYearChart(lv, cells){ const yr = visYears(); if (!yr) return ''; const N = cells.length || 1, now = new Date().getFullYear(), od = new Map(); let any = false;
  for (let y = yr[0]; y <= yr[1]; y++) od.set(y, 0);
  cells.forEach(c => { const a = visList(lv, c, 'VIS_OD_Y'); if (!a) return; any = true; for (let k = 0; k < a.length; k += 2) if (od.has(a[k])) od.set(a[k], od.get(a[k]) + a[k + 1]); });
  if (!any) return '';
  const Y = [...od].map(([y, n]) => ({y, n, v:S.visAdj ? visIdx(n / N, lv, y) : n, part:y > visFull(), thin:n < VISTHIN})).filter(e => e.v != null);
  if (!Y.length) return ''; const mx0 = Math.max(...Y.map(e => e.v), S.visAdj ? 120 : 1), st = niceNum(mx0 / 4) || 1, mx = Math.ceil(mx0 / st) * st;
  const W = 272, H = 142, pl = 10 + 5.2 * fmt(mx, 0).length, pr = 6, top = 10, base = 126, pw = W - pl - pr, bw = pw / Y.length, f = v => v.toFixed(1), Yp = v => base - (base - top) * v / mx;
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${S.visAdj ? 'Visitation index' : 'Observer-days'} by year">`;
  for (let v = 0; v <= mx + 1e-9; v += st) g += `<line x1="${pl}" x2="${W - pr}" y1="${f(Yp(v))}" y2="${f(Yp(v))}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 4}" y="${f(Yp(v) + 3)}" text-anchor="end" font-size="9" fill="#9FB2C8">${fmt(v, 0)}</text>`;
  g += '<defs><pattern id="vispart" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#B03A73" opacity=".45"/><line x1="0" y1="0" x2="0" y2="4" stroke="#8FA6D8" stroke-width="1.6"/></pattern></defs>';
  const lab = Math.max(1, Math.ceil(Y.length / 6));
  Y.forEach((e, i) => { const on = S.visYr === e.y, x = pl + i * bw, h = base - Yp(e.v);
    g += `<g data-visy="${e.y}" style="cursor:pointer"><rect x="${f(x)}" y="${top}" width="${f(bw)}" height="${base - top}" fill="transparent"/>` +
      `<rect x="${f(x + bw * .12)}" y="${f(base - h)}" width="${f(bw * .76)}" height="${f(Math.max(e.v > 0 ? .8 : 0, h))}" rx="1" fill="${on ? '#FFFFFF' : e.part ? 'url(#vispart)' : HUE.eff}" opacity="${e.thin && !on ? .4 : 1}" stroke="${on ? '#FFFFFF' : '#5F7FC8'}" stroke-width=".5"/>` +
      `<title>${e.y}${e.part ? (e.y >= now ? ' (so far, no eBird yet)' : ' (no eBird yet)') : ''}: ${S.visAdj ? 'index ' + fmt(e.v, 0) + ', from ' : ''}${fmt(e.n, 0)} observer-days${N > 1 ? ' in the ' + N + ' cells' : ''}${e.thin ? '. Few observer-days, so the value is unsteady' : ''}. Tap to show this year on the map.</title></g>`;
    const last = i === Y.length - 1; if (last || ((e.y - Y[0].y) % lab === 0 && Y.length - 1 - i >= lab)) g += `<text x="${f(x + bw / 2)}" y="${base + 12}" text-anchor="middle" font-size="9" fill="${on ? '#FFFFFF' : '#C9D4E2'}">${"'" + String(e.y).slice(2)}${e.part ? '*' : ''}</text>`; });
  if (S.visAdj){ const y100 = Yp(100); g += `<line x1="${pl}" x2="${W - pr}" y1="${f(y100)}" y2="${f(y100)}" stroke="#F0C419" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${W - pr}" y="${f(y100 - 3)}" text-anchor="end" font-size="9" fill="#F0C419" stroke="#142235" stroke-width="2.5" paint-order="stroke">100 = average cell</text>`; }
  g += '</svg>' + `<p class="phstat" style="font-size:12.5px;margin-top:0">${Y.some(e => e.thin) ? `Faded: under ${VISTHIN} observer-days, where a visit or two swings the value. ` : ''}${Y.some(e => e.part) ? `Hatched (*): ${visFull() + 1}${visFull() + 1 < now ? '–' + now + ' have' : ' has'} no eBird checklists yet (eBird reaches GBIF about a year late)${Y.some(e => e.y >= now) ? ', and ' + now + ' is partial' : ''}, so ${visFull() + 1 < now ? 'these years look' : 'it looks'} low: compare years up to ${visFull()}.` : ''}</p>`;
  /* the summary: the last three full years together, which steadies the year-to-year swings */
  const rec = Y.filter(e => !e.part).slice(-3), rn = rec.reduce((s, e) => s + e.n, 0);
  let st2 = '';
  if (rec.length){ const ix = S.visAdj ? rec.reduce((s, e) => s + e.v, 0) / rec.length : null;
    st2 = `${rec[0].y}–${rec[rec.length - 1].y}: ${fmt(Math.round(rn / rec.length), 0)} observer-days a year${N > 1 ? ' in these cells' : ''}` + (ix != null ? `, index ${fmt(ix, 0)}: ${ix >= 100 ? 'about ' + fmt(ix / 100, ix >= 1000 ? 0 : 1) + ' times' : 'about ' + fmt(ix, 0) + '% of'} the average cell${N > 1 ? ' (per cell)' : ''}.` : '.');
    if (rn / rec.length < VISTHIN) st2 += ' Few observer-days here, so treat year-to-year changes with caution.'; }
  const sy = S.visYr && Y.find(e => e.y === S.visYr);
  if (sy) st2 = `<b>${sy.y}${sy.part ? ' (no eBird yet)' : ''}:</b> ${fmt(sy.n, 0)} observer-days${N > 1 ? ' in these cells' : ''}${S.visAdj ? ', index ' + fmt(sy.v, 0) : ''}. ` + st2;
  return g + `<p class="phstat">${st2}</p>`; }
document.addEventListener('click', e => { const t = e.target.closest('[data-visy]'); if (!t) return; if (typeof visTimer !== 'undefined' && visTimer) visPlay(false); const y = +t.dataset.visy; S.visYr = S.visYr === y ? null : y; visFrame(true); });
QVIZ.bird.pick = id => BIRDM[id] ? {title:'Top 10 ' + S.m.label.toLowerCase(), note:'Cells with eBird checklists that recorded each species in this habitat group. Click a species to map it.', fn:(lv, cells) => vSpTop(lv, cells, c => val('ebird', BIRDM[id] + '_LIST', lv, c) || [], HUE.ebird, 'recorded')}
  : id === 'spp' || id === 'sppraw' ? {title:'Species by habitat group', note:'Different bird species recorded in each habitat group on eBird checklists.', fn(lv, cells){
    return BIRD_GROUPS.map(g => { const s = new Set(); cells.forEach(c => (val('ebird', g.list, lv, c) || []).forEach(i => s.add(i))); return [g.full, HUE.ebird, s.size, fmt(s.size, 0), `${g.full}: ${s.size} species`]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]); }} : null;
QVIZ.soil.pick = id => id === 'vuln' ? null : {title:'Cells by ' + S.m.label.toLowerCase(), note:'Share of each cell’s area (NRCS gSSURGO), grouped.', fn:(lv, cells) => vHist(lv, cells, S.m, HUE.soil)};
QVIZ.wet.pick = id => id === 'vegw' ? {title:'Vegetated wetland acres by type', note:'USFWS National Wetlands Inventory, acres in the whole cell; open water is left out.', fn(lv, cells){
    return [['C_FO','Forested','#008837'],['C_SS','Scrub-shrub','#5DAA45'],['C_EM','Emergent','#7FC31C'],['C_AB','Aquatic bed','#3FA796']].map(([f, nm, col]) => { let a = 0; cells.forEach(c => a += val('wet', f, lv, c) || 0); return [nm, col, a, fmt(Math.round(a), 0) + ' ac', `${nm}: ${fmt(Math.round(a), 0)} acres`]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]); }}
  : id === 'lands' ? {title:'Main wetland type on A.T. lands', note:'Cells by the wetland type covering the most of their A.T. land.', fn(lv, cells){
    const m = new Map(); let n = 0; cells.forEach(c => { const v = val('wet','WET_LDOM',lv,c); if (v == null) return; n++; m.set(v, (m.get(v) || 0) + 1); });
    return vTop(m).map(([k, v]) => { const nm = D.cats.WET_LDOM[k], e = CATCOL.WET_DOM.find(x => x[0] === nm); return [nm, e ? e[1] : HUE.wet, v, vPct(v, n), `${nm}: ${nCells(v)} of ${n}`]; }); }} : null;
QVIZ.hist.pick = id => id === 'hcem' ? {title:'Historic resources by type', note:'National Register of Historic Places (NPS) by property type, and cemeteries mapped in OpenStreetMap; cemeteries are highlighted.', fn:(lv, cells) => vHi(QVIZ.hist.fn(lv, cells), r => r[0] === 'Cemeteries')}
  : id === 'hnr' ? {title:'National Register properties by type', note:'National Register of Historic Places (NPS), by property type.', fn(lv, cells){ return QVIZ.hist.fn(lv, cells).filter(r => r[0] !== 'Cemeteries'); }} : null;
QVIZ.feat.pick = id => ['drain', 'drainmi', 'steps'].includes(id) ? {title:'Estimated trail structures', note:'Estimates, spread from maintainer sections by trail miles.', fn(lv, cells){
    return vHi([['S_DRAIN','Drainage structures','drain'],['S_STEPS','Steps and climbs','steps'],['S_SIGNS','Signs'],['S_BARR','Barriers']].map(([f, nm, mid]) => { let n = 0; cells.forEach(c => n += val('feat', f, lv, c) || 0); return [nm, HUE.feat, n, fmt(Math.round(n), 0), `${nm}: about ${fmt(Math.round(n), 0)}`, null, mid]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]), r => r[6] === id || (id === 'drainmi' && r[6] === 'drain')); }}
  : {title:'Facilities by type', note:'A.T. facilities inventory, official and additional features' + (FEATT.some(t => t[2] === id) ? '; the type on the map is highlighted.' : '.'), fn(lv, cells){
    return vHi(FEATT.map(([f, nm, mid]) => { let n = 0; cells.forEach(c => n += val('feat', f, lv, c) || 0); return [nm, FCOL[nm] || HUE.feat, n, fmt(n, 0), `${nm}: ${fmt(n, 0)}`, null, mid]; }).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]), r => r[6] && r[6] === id); }};
const VISPICK = {
  obsr: {title:'Observers by source', note:'People with an iNaturalist record or eBird checklist, and EDDMapS report-days (EDDMapS publishes no observer names). Added up cell by cell, so someone active in several cells counts in each.', fn(lv, cells){
    const s = [0, 0, 0]; cells.forEach(c => { const a = val('vis','VIS_SRC',lv,c); if (a) a.forEach((x, i) => s[i] += x || 0); });
    return [['iNaturalist observers', s[0]], ['eBird observers', s[1]], ['EDDMapS report-days', s[2]]].filter(r => r[1] > 0).map(([nm, n]) => [nm, HUE.eff, n, fmt(n, 0), `${nm}: ${fmt(n, 0)}`]); }},
  peak: {title:'Observer-days by month', note:'Observer-days in each month, all years together; the busiest month is highlighted.', fn(lv, cells){
    const s = Array(12).fill(0); cells.forEach(c => { const a = visList(lv, c, 'VIS_OD_M'); if (a) a.forEach((x, i) => s[i] += x || 0); }); const mx = Math.max(...s);
    return mx ? vHi(s.map((n, i) => [CATCOL.VIS_PEAK[i][0], CATCOL.VIS_PEAK[i][1], n, fmt(n, 0), `${CATCOL.VIS_PEAK[i][0]}: ${fmt(n, 0)} observer-days`]), r => r[2] === mx) : []; }},
  busy: {title:'Top 10 busiest days', get note(){ return 'The dates with the most observers active, from each cell’s ten busiest days added together' + (dispLevel() === 'hex' && S.ext === 'huc' ? '. For square miles in the HUC10 shell, the surrounding 7 sq mi cells’ busiest days are used.' : '.'); }, fn(lv, cells){
    const m = new Map(); visBusyLists(lv, cells)[0].forEach(a => a.forEach(([d, n]) => m.set(d, (m.get(d) || 0) + n)));
    return vTop(m).map(([d, n]) => { const s = String(d), dt = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))), lab = dt.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC'});
      return [lab, HUE.eff, n, fmt(n, 0), `${lab}: ${fmt(n, 0)} observers`]; }); }},
  ld: {title:'Long-distance hiker observer-days by month', note:'Observer-days from people whose records span at least 100 trail miles within 30 days, by month: the long-distance hiking season along this stretch.', fn(lv, cells){
    const s = Array(12).fill(0); cells.forEach(c => { const a = visList(lv, c, 'VIS_LD_M'); if (a) a.forEach((x, i) => s[i] += x || 0); });
    return s.some(x => x) ? s.map((n, i) => [CATCOL.VIS_PEAK[i][0], HUE.eff, n, fmt(n, 0), `${CATCOL.VIS_PEAK[i][0]}: ${fmt(n, 0)} long-distance observer-days`]) : []; }},
  off: {title:'Records on and off the trail', note:'iNaturalist and eBird records within 100 m of the mapped A.T. centerline, and farther away. Side trails, shelters, vistas and parking areas count as off the trail.', fn(lv, cells){
    let off = 0, all = 0; cells.forEach(c => { const a = val('vis','VIS_RPD_SRC',lv,c); if (a){ all += a[0] + a[2]; off += val('vis','VIS_OFFN',lv,c) || 0; } });
    return all ? [['Within 100 m of the A.T.', HUE.eff, all - off, vPct(all - off, all), `${fmt(all - off, 0)} records within 100 m`], ['More than 100 m away', HUE.eff, off, vPct(off, all), `${fmt(off, 0)} records more than 100 m away`]] : []; }},
  rpd: {title:'Records per observer-day by source', note:'iNaturalist records, and eBird species records, per observer-day of each system.', fn(lv, cells){
    let ri = 0, pi = 0, re = 0, pe = 0; cells.forEach(c => { const a = val('vis','VIS_RPD_SRC',lv,c); if (a){ ri += a[0]; pi += a[1]; re += a[2]; pe += a[3]; } });
    return [['iNaturalist', pi ? ri / pi : 0, pi], ['eBird', pe ? re / pe : 0, pe]].filter(r => r[2]).map(([nm, v, n]) => [nm, HUE.eff, v, fmt(v, 1), `${nm}: ${fmt(v, 1)} records per observer-day, over ${fmt(n, 0)} observer-days`]); }}
};
QVIZ.wx = {title:'Average precipitation and temperature by month', note:'PRISM 1991–2020 normals, averaged over the cells. For square miles in the HUC10 shell, the months come from the surrounding 7 sq mi cell, scaled to the square mile’s own annual values.',
  html:(lv, cells) => wxClimo(lv, cells, S.wxMon), fn:() => []};
QVIZ.wx.pick = id => {
  const m = S.q.m.find(x => x.id === id);
  if (['ppt','tmean','wetm','tmax7','tmin1'].includes(id)) return {html:(lv, cells) => { let hm = S.wxMon; if (id === 'tmax7') hm = 6; else if (id === 'tmin1') hm = 0;
      else if (id === 'wetm' && hm == null){ const s = Array(12).fill(0); cells.forEach(c => (wxList(lv, c, 'WX_PPT_M') || []).forEach((x, i) => s[i] += x)); hm = Math.max(...s) > 0 ? s.indexOf(Math.max(...s)) : null; }
      return wxClimo(lv, cells, hm); }};
  if (m && m.wxG) return {title:WXEV[m.wxG][0].toUpperCase() + WXEV[m.wxG].slice(1) + ' events by year', note:'NOAA Storm Events Database: events per cell each year, averaged over the cells. Each event counts in every cell in the forecast zone or county it was reported for, so the counts mean the same at every cell size. Tap a column to show that year on the map; tap it again, or Average, to go back.', html:(lv, cells) => wxStorms(lv, cells, m.wxG)};
  if (m) return {title:'Cells by ' + m.label.toLowerCase(), note:'Cells in each of the map’s classes.', html:null, fn:(lv, cells) => wxClassRows(lv, cells, m)};
  return null; };
QVIZ.tvul = {title:'Where the score comes from', get note(){ return 'Each gray bar is the most a factor can add to the 100-point score. The colored part is what it adds on average in the cells shown. ' + tvNote(); }, fn(lv, cells){
    const s = TVDEF.map(() => 0), n = TVDEF.map(() => 0); let k = 0;
    cells.forEach(c => { const r = tvParts(lv, c); if (r[0] == null) return; k++; r[1].forEach((p, i) => { if (p[2] != null){ s[i] += p[2]; n[i]++; } }); });
    return k ? TVDEF.map(([key, lab], i) => [lab, HUE.tvul, n[i] ? s[i] / n[i] : 0, n[i] ? `${fmt(s[i] / n[i], 1)} of ${TVW[key]}` : 'no data', `${lab}: ${n[i] ? fmt(s[i] / n[i], 1) + ' of ' + TVW[key] + ' points on average, over ' + nCells(n[i]) : 'no data'}`]) : []; }};
QVIZ.tvul.pick = id => id === 'score' ? null : {title:'Trail miles by grade', note:'Miles of trail measured in each cell, grouped by the cell’s average grade (USGS 3DEP, every 10 m).', fn(lv, cells){
    const B = [[0, 5, 'Under 5%'], [5, 10, '5 to 10%'], [10, 15, '10 to 15%'], [15, 20, '15 to 20%'], [20, 1e9, '20% or more']], m = B.map(() => 0); let tot = 0;
    cells.forEach(c => { const g = val('slope','TS_GRADE',lv,c), mi = val('slope','TS_MI',lv,c); if (g == null || !mi) return; tot += mi; m[B.findIndex(b => g >= b[0] && g < b[1])] += mi; });
    return tot ? B.map((b, i) => [b[2], HUE.tvul, m[i], fmt(m[i], 0) + ' mi', `${b[2]}: ${fmt(m[i], 1)} miles, ${vPct(m[i], tot)}`]).filter(r => r[2] > 0) : []; }};
/* states along the trail, by trail mile (scaled to this centerline's length); NC and TN share the trail along their border */
const VST = [[0,'Georgia'],[78,'NC and Tennessee'],[469,'Virginia'],[1023,'Maryland'],[1064,'Pennsylvania'],[1290,'New Jersey'],[1361,'New York'],
  [1459,'Connecticut'],[1510,'Massachusetts'],[1600,'Vermont'],[1744,'New Hampshire'],[1910,'Maine']];
const VSTNOTE = ' Cells are placed in states by trail mile, so a cell on a state line counts in one state; North Carolina and Tennessee are combined where the trail follows their border.';
function vStOf(lv, c){ const m = D.levels[lv].mi; if (!m || m[c] == null) return -1; const x = m[c] / ((D.totalMi || 2190) / 2190); let k = 0; for (let i = 0; i < VST.length; i++) if (x >= VST[i][0]) k = i; return k; }
function tvStateRows(lv, cells, f, what){ const mi = VST.map(() => 0), on = VST.map(() => 0);
  cells.forEach(c => { const s = vStOf(lv, c), t = val('slope','TS_MI',lv,c), p = val('slope',f,lv,c); if (s < 0 || !t || p == null) return; mi[s] += t; on[s] += t * p / 100; });
  return VST.map((v, i) => [v[1], HUE.tvul, mi[i] ? 100 * on[i] / mi[i] : 0, mi[i] ? `${fmt(100 * on[i] / mi[i], 0)}% · ${fmt(on[i], on[i] < 10 ? 1 : 0)} mi` : '', `${v[1]}: about ${fmt(on[i], 1)} of ${fmt(mi[i], 1)} trail miles ${what} (${fmt(100 * on[i] / mi[i], 0)}%)`]).filter((r, i) => mi[i] > 0); }
{ const tp0 = QVIZ.tvul.pick;
  QVIZ.tvul.pick = id => id === 'g10' ? {title:'Trail over 10% grade by state', note:'Share of the measured trail steeper than 10% in each state, with the miles it adds up to (USGS 3DEP elevation every 10 m).' + VSTNOTE, fn:(lv, cells) => tvStateRows(lv, cells, 'TS_G10', 'steeper than 10%')}
    : id === 'fall' ? {title:'Trail on the fall line by state', note:'Share of the measured trail running nearly straight up and down the slope (on the fall line) on ground steeper than 5% in each state, with the miles it adds up to.' + VSTNOTE, fn:(lv, cells) => tvStateRows(lv, cells, 'TS_FALL', 'on the fall line')}
    : tp0(id); }
const MLCOL = {'Meadow/Field':'#B5A33A', 'Agricultural Crop/Pasture':'#C98E4B', 'Bald':'#7FA06A'};
{ const fp0 = QVIZ.feat.pick;
  QVIZ.feat.pick = id => id === 'mlac' ? {title:'Maintained landscapes', note:'Acres of open landscapes kept open by mowing, grazing or crops, from the A.T. facilities inventory. A landscape spanning cells is added up across them.', html(lv, cells){
    const ty = new Map(), nm = new Map(); let tot = 0;
    cells.forEach(c => (val('feat','ML',lv,c) || []).forEach(x => { const t = x[1] || 'Other', a = x[2] || 0; tot += a; ty.set(t, (ty.get(t) || 0) + a); const o = nm.get(x[0]) || {a:0, t}; o.a += a; nm.set(x[0], o); }));
    if (!tot) return '';
    const r1 = [...ty].sort((a, b) => b[1] - a[1]).map(([t, a]) => [t, MLCOL[t] || '#8A97A6', a, `${fmt(a, a < 10 ? 1 : 0)} ac`, `${t}: ${fmt(a, 1)} acres, ${vPct(a, tot)}`]);
    const top = [...nm].sort((a, b) => b[1].a - a[1].a).slice(0, 10), r2 = top.map(([n, o]) => [n, MLCOL[o.t] || '#8A97A6', o.a, `${fmt(o.a, o.a < 10 ? 1 : 0)} ac`, `${n} (${o.t}): ${fmt(o.a, 1)} acres`]);
    return `<p class="phsub">${fmt(tot, 0)} acres in ${nm.size === 1 ? 'one landscape' : fmt(nm.size, 0) + ' landscapes'}, by type</p>` + vizBars(r1, 'Maintained landscape acres by type') +
      `<p class="phsub">${nm.size > 10 ? 'The 10 largest' : 'Each landscape'}</p>` + vizBars(r2, 'Largest maintained landscapes'); }} : fp0(id); }
QVIZ.land.pick = id => id === 'appa' ? {title:'NPS - APPA acres by state', note:'Acres of land administered by NPS - APPA in each state, from the tract records summarized to each cell. Generalized to the grid; not a boundary determination.' + VSTNOTE, fn(lv, cells){
    const k = D.cats.MGR.indexOf('NPS - APPA'), a = VST.map(() => 0); let tot = 0;
    cells.forEach(c => { const s = vStOf(lv, c), p = val('lands','MGRS',lv,c), ac = val('lands','LAND_AC',lv,c) || 0; if (s < 0 || !p) return; for (let i = 0; i < p.length; i += 2) if (p[i] === k){ const x = ac * p[i + 1] / 100; a[s] += x; tot += x; } });
    return VST.map((v, i) => [v[1], HUE.lands, a[i], `${fmt(Math.round(a[i]), 0)} ac`, `${v[1]}: ${fmt(Math.round(a[i]), 0)} acres of NPS - APPA land, ${vPct(a[i], tot)} of the total in view`]).filter(r => r[2] > 0); }} : null;
QVIZ.tvul.html = (lv, cells) => { const s = TVDEF.map(() => 0), n = TVDEF.map(() => 0); let k = 0;
  cells.forEach(c => { const r = tvParts(lv, c); if (r[0] == null) return; k++; r[1].forEach((p, i) => { if (p[2] != null){ s[i] += p[2]; n[i]++; } }); });
  if (!k) return ''; const mw = Math.max(...TVDEF.map(d => +TVW[d[0]] || 0), 1e-9);
  return '<div class="hb tvtk" role="list" aria-label="Where the score comes from">' + TVDEF.map(([key, lab], i) => { const w = +TVW[key] || 0, p = n[i] ? s[i] / n[i] : null;
    const txt = p == null ? 'no data' : `${fmt(p, 1)} of ${fmt(w, w % 1 ? 1 : 0)}`, tip = `${lab}: ${p == null ? 'no data' : 'adds ' + fmt(p, 1) + ' of its ' + fmt(w, 1) + ' possible points on average, over ' + nCells(n[i])}`;
    return `<div class="hbr" role="listitem" title="${esc(tip)}"><span class="hbl">${esc(lab)}</span><span class="hbt"><span class="tvtr" style="width:calc((100% - 70px) * ${(w / mw).toFixed(4)})"><i style="width:${p == null || !w ? 0 : Math.min(100, 100 * p / w).toFixed(1)}%;background:${HUE.tvul}"></i></span><b>${esc(txt)}</b></span></div>`; }).join('') + '</div>'; };
{ const tq = QVIZ.tvul.pick; QVIZ.tvul.pick = id => { const r = tq(id); return r ? Object.assign({html:null}, r) : null; }; }
/* the gray-track chart: each row's track is as long as its weight, filled to the average points it adds */
function trackChart(rows, aria, col){ const mw = Math.max(...rows.map(r => r[2]), 1e-9);
  return `<div class="hb tvtk" role="list" aria-label="${esc(aria)}">` + rows.map(([lab, p, w, tip, nt]) => { const txt = p == null ? (nt || 'no data') : `${fmt(p, 1)} of ${fmt(w, w % 1 ? 1 : 0)}`;
    return `<div class="hbr" role="listitem" title="${esc(tip || lab + ': ' + txt)}"><span class="hbl">${esc(lab)}</span><span class="hbt"><span class="tvtr" style="width:calc((100% - 70px) * ${(w / mw).toFixed(4)})"><i style="width:${p == null || !w ? 0 : Math.min(100, 100 * p / w).toFixed(1)}%;background:${col}"></i></span><b>${esc(txt)}</b></span></div>`; }).join('') + '</div>'; }
QVIZ.rest.title = 'Where the score comes from';
QVIZ.rest.note = 'Each gray bar is the most a factor can add to the 100-point score. The colored part is what it adds on average in the cells shown. Herbicide use and the lands setting apply as on the map. A screening tool, not a site assessment.';
QVIZ.rest.html = (lv, cells) => { const kind = S.m.id === 'forest' ? 'forest' : 'grass', d = RESTDEF[kind], s = d.parts.map(() => 0); let n = 0;
  cells.forEach(c => { if (!has('veg', lv, c)) return; const r = restParts(kind, lv, c); if (r[0] == null) return; n++; r[1].forEach((p, k) => s[k] += p[2]); });
  if (!n) return ''; return trackChart(d.parts.map(([k, lab], i) => { const w = +RW[kind][k] || 0; if (k === 'rare' && !JERRY) return [lab, null, w, `${lab}: not shown; the other factors are scaled up to fill the score`, 'not shown']; return [lab, s[i] / n, w, `${lab}: adds ${fmt(s[i] / n, 1)} of its ${fmt(w, 1)} possible points on average, over ${nCells(n)}`]; }), 'Where the score comes from', HUE.rest); };
const RWABOUT = {grass:'Grassland and shrubland birds carry the most weight, since they are declining and their habitat is scarce; open habitat comes next, then rare species, soils suited to grassland management, vistas and priority invasive plants.',
  forest:'The five forest factors are weighted equally: forest, rare species, forest pests, priority invasive plants and places where hikers gather.'};
function restWeightsHTML(){ const kind = S.m.id === 'forest' ? 'forest' : 'grass', d = RESTDEF[kind]; if (!RWD[kind]) RWD[kind] = Object.assign({}, RW[kind]); const D2 = RWD[kind];
  const tot = d.parts.reduce((t, p) => t + (+D2[p[0]] || 0), 0), left = Math.round((100 - tot) * 10) / 10, f1 = x => fmt(x, x % 1 ? 1 : 0);
  const changed = d.parts.some(p => (+D2[p[0]] || 0) !== (+RW[kind][p[0]] || 0)), isRec = d.parts.every(p => (+D2[p[0]] || 0) === p[2]);
  return `<p class="phsub" style="margin-top:2px">${esc(d.label)} score</p><div class="tvw2" role="group" aria-label="${esc(d.label)} weights">` + d.parts.map(([k, lab]) => { const w = +D2[k] || 0;
    return `<div class="tvr"><span class="tvl" title="${esc(RNOTE[k] || '')}">${esc(lab)}</span><span class="tvbar" aria-hidden="true"><i style="width:${Math.min(100, w * 2)}%;background:${HUE.rest}"></i></span>` +
      `<button type="button" class="tvs" data-rws="${k}" data-d="-1" aria-label="Lower ${esc(lab)}"${w <= 0 ? ' disabled' : ''}>−</button><b aria-live="polite">${f1(w)}</b>` +
      `<button type="button" class="tvs" data-rws="${k}" data-d="1" aria-label="Raise ${esc(lab)}"${left <= 0 ? ' disabled' : ''}>+</button></div>`; }).join('') + '</div>' +
    `<p class="tvleft${left ? ' due' : ''}">${left > 0 ? `<b>${f1(left)}</b> ${left === 1 ? 'point' : 'points'} left to assign. Raise a factor to use ${left === 1 ? 'it' : 'them'}.` : 'All 100 points are assigned.'}${changed ? ' Press Apply to update the scores.' : ''}</p>` +
    `<div class="tvbtns"><button type="button" class="tvapply" data-rwapply="1"${changed && !left ? '' : ' disabled'}>Apply</button>` +
    (changed ? '<button type="button" class="lbtn" data-rwundo="1">Undo changes</button>' : '') + (isRec ? '' : '<button type="button" class="lbtn" data-rwreset="1">Reset to recommended</button>') + '</div>' +
    `<details class="rwabout"${store.get('rwabout', false) ? ' open' : ''}><summary>About the weights</summary><p class="phnote">The weights share 100 points. Lower one factor to free points, then raise another. The grassland and forest scores each keep their own weights. ${RWABOUT[kind]} Herbicide use (wetlands, up to −10 points) and the lands setting are applied after the weights. Scores are ranked the same way as the trail question: acres and counts by how a cell ranks among cells of its size, ratings and shares as they are.</p></details>`; }
const rwDraw = () => { const el = $('#rwts'); if (el) el.innerHTML = restWeightsHTML(); };
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('rwabout')) store.set('rwabout', e.target.open); if (e.target.classList && e.target.classList.contains('vzabout')) store.set('vzabout', e.target.open); }, true);
document.addEventListener('click', e => { const kind = S.m.id === 'forest' ? 'forest' : 'grass', s = e.target.closest('[data-rws]');
  if (s){ const D2 = RWD[kind], k = s.dataset.rws, tot = RESTDEF[kind].parts.reduce((t, p) => t + (+D2[p[0]] || 0), 0), st = 2.5;
    D2[k] = +s.dataset.d > 0 ? (+D2[k] || 0) + Math.min(st, Math.max(0, 100 - tot)) : Math.max(0, (+D2[k] || 0) - st);
    rwDraw(); const again = document.querySelector(`[data-rws="${k}"][data-d="${s.dataset.d}"]`); if (again && !again.disabled) again.focus(); return; }
  if (e.target.closest('[data-rwapply]')){ RW[kind] = Object.assign({}, RWD[kind]); tvRefresh(true); return; }
  if (e.target.closest('[data-rwundo]')){ RWD[kind] = Object.assign({}, RW[kind]); rwDraw(); return; }
  if (e.target.closest('[data-rwreset]')){ RWD[kind] = Object.fromEntries(RESTDEF[kind].parts.map(p => [p[0], p[2]])); rwDraw(); } });
{ const tq0 = QVIZ.tvul.pick; QVIZ.tvul.pick = id => id !== 'tfall' ? tq0(id) : {title:'Where the tree fall score comes from', note:'Each gray bar is a factor\u2019s weight; the colored part is how high the factor runs on average in the cells shown. The score multiplies three parts (wind loading, tree weakness, people at risk), so these bars show what feeds each part rather than points that add up. A screening score built from the layers on this page, not a stand or hazard tree assessment; the windfall study\u2019s models will replace it.',
  html(lv, cells){ const s = WFDEF.map(() => 0), n = WFDEF.map(() => 0); let k = 0;
    cells.forEach(c => { const r = wfParts(lv, c); if (r[0] == null) return; k++; r[1].forEach((p, i) => { if (p[2] != null){ s[i] += p[2]; n[i]++; } }); });
    if (!k) return ''; return trackChart(WFDEF.map(([key, lab], i) => [lab, n[i] ? s[i] / n[i] : null, WFW[key], n[i] ? `${lab}: adds ${fmt(s[i] / n[i], 1)} of its ${fmt(WFW[key], 1)} possible points on average, over ${nCells(n[i])}` : `${lab}: no data here`]), 'Where the tree fall score comes from', HUE.tvul); }}; }
let TFD = null;   /* tree fall weights being edited; WFW (what the score uses) changes only on Apply */
function tfWeightsHTML(){ if (!TFD) TFD = Object.assign({}, WFW); const tot = WFDEF.reduce((t, d) => t + (+TFD[d[0]] || 0), 0), left = Math.round((100 - tot) * 10) / 10, f1 = x => fmt(x, x % 1 ? 1 : 0);
  const changed = WFDEF.some(d => (+TFD[d[0]] || 0) !== (+WFW[d[0]] || 0)), isRec = WFDEF.every(d => (+TFD[d[0]] || 0) === WFD0[d[0]]);
  return `<p class="phsub" style="margin-top:2px">Tree fall vulnerability score</p><div class="tvw2" role="group" aria-label="Tree fall vulnerability weights">` + WFDEF.map(([k, lab, w0, note, g], i) => { const w = +TFD[k] || 0;
    return `<div class="tvr"><span class="tvl" title="${esc(note)}">${esc(lab)}</span><span class="tvbar" aria-hidden="true"><i style="width:${Math.min(100, w * 2)}%"></i></span>` +
      `<button type="button" class="tvs" data-tfs="${k}" data-d="-1" aria-label="Lower ${esc(lab)}"${w <= 0 ? ' disabled' : ''}>−</button><b aria-live="polite">${f1(w)}</b>` +
      `<button type="button" class="tvs" data-tfs="${k}" data-d="1" aria-label="Raise ${esc(lab)}"${left <= 0 ? ' disabled' : ''}>+</button></div>`; }).join('') + '</div>' +
    `<p class="tvleft${left ? ' due' : ''}">${left > 0 ? `<b>${f1(left)}</b> ${left === 1 ? 'point' : 'points'} left to assign. Raise a factor to use ${left === 1 ? 'it' : 'them'}.` : 'All 100 points are assigned.'}${changed ? ' Press Apply to update the scores.' : ''}</p>` +
    `<div class="tvbtns"><button type="button" class="tvapply" data-tfapply="1"${changed && !left ? '' : ' disabled'}>Apply</button>` +
    (changed ? '<button type="button" class="lbtn" data-tfundo="1">Undo changes</button>' : '') + (isRec ? '' : '<button type="button" class="lbtn" data-tfreset="1">Reset to recommended</button>') + '</div>' +
    `<details class="tfabout"${store.get('tfabout', false) ? ' open' : ''}><summary>About the weights</summary><p class="phnote">The weights share 100 points. Lower one factor to free points, then raise another. The score multiplies three parts, so a place ranks high only where they line up: wind loading (exposure and storm history), tree weakness (forest pests and disease, shallow rooting, tall canopy) and people at risk (the trail, more at shelters, campsites, parking and vistas). Within each part, factors count by their weights. Wind loading and tree weakness are then ranked among the cells, so each part pulls by its total weight. Exposure carries the most, since wind rises sharply on summits and exposed ridges; forest pests and disease come next, since dead and dying trees are the ones that come down. Ice and winter storms and windy days add smaller amounts. This is a screening score: tree size, height-to-diameter ratio, crown form, vigor and documented windfall events from the windfall study will refine or replace it.</p></details>`; }
const tfDraw = () => { const el = $('#tfwts'); if (el) el.innerHTML = tfWeightsHTML(); };
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('tfabout')) store.set('tfabout', e.target.open); }, true);
document.addEventListener('click', e => { const s = e.target.closest('[data-tfs]');
  if (s){ const k = s.dataset.tfs, tot = WFDEF.reduce((t, d) => t + (+TFD[d[0]] || 0), 0), st = 2.5;
    TFD[k] = +s.dataset.d > 0 ? (+TFD[k] || 0) + Math.min(st, Math.max(0, 100 - tot)) : Math.max(0, (+TFD[k] || 0) - st);
    tfDraw(); const again = document.querySelector(`[data-tfs="${k}"][data-d="${s.dataset.d}"]`); if (again && !again.disabled) again.focus(); return; }
  if (e.target.closest('[data-tfapply]')){ WFDEF.forEach(d => WFW[d[0]] = +TFD[d[0]] || 0); tvRefresh(true); return; }
  if (e.target.closest('[data-tfundo]')){ TFD = Object.assign({}, WFW); tfDraw(); return; }
  if (e.target.closest('[data-tfreset]')){ TFD = Object.assign({}, WFD0); tfDraw(); } });
const deficOn = () => !!(DEFIC && DEFIC.done);
{ const p1 = QVIZ.tvul.pick; QVIZ.tvul.pick = id => {
  if (id === 'defrel' || id === 'defrate') return {title:'Recorded trail problems by kind', html:null, note:'Problems recorded in the trail assessments in the cells shown. Erosion and drainage are treadway problems; sites are campsites, shelters, privies, parking, bridges and the corridor.', fn(lv, cells){
    const K = [['DF_EROS', 'Erosion'], ['DF_DRAIN', 'Drainage'], ['DF_OTHER', 'Other treadway'], ['DF_SITE', 'Sites and corridor']], t = K.map(() => 0);
    cells.forEach(c => K.forEach(([f], i) => { t[i] += val('defic', f, lv, c) || 0; })); const tot = t.reduce((a, b) => a + b, 0);
    return tot ? vRampRows(K.map(([f, lab], i) => [lab, HUE.tvul, t[i], fmt(t[i], 0), `${lab}: ${fmt(t[i], 0)} recorded (${vPct(t[i], tot)})`]), 'tvul') : []; }};
  return p1(id); }; }
/* trail segments on the map: under the trail question (not tree fall), zoomed in to about 7 miles across or closer, each
   stretch of trail (about 500 feet) drawn over the cells in its erosion risk class; a click opens its numbers */
let SEGL = null, segKey = '', segOn = true; try { segOn = localStorage.getItem('atgrid_segs') !== '0'; } catch (e) {}
const SEGZ = 12, SEGBRK = [40, 60, 80, 90];
const segCls = r => r == null ? -1 : SEGBRK.filter(b => r >= b).length;
function segDecode(g){ const p = []; let la = g[0], lo = g[1]; p.push([la / 1e5, lo / 1e5]); for (let k = 2; k < g.length; k += 2){ la += g[k]; lo += g[k + 1]; p.push([la / 1e5, lo / 1e5]); } return p; }
function segJoins(){ const s = SEGS.segs; if (s.join) return; s.join = new Map(); const C = new Map(), key = (a, o) => Math.floor(a / .0005) + ',' + Math.floor(o / .0005), ends = [];
  for (let i = 0; i < s.n; i++){ const p = segDecode(s.g[i]); [[p[0], 0], [p[p.length - 1], 1]].forEach(([q, w]) => { const e = [q[0], q[1], i, w]; ends.push(e); const k = key(q[0], q[1]); if (!C.has(k)) C.set(k, []); C.get(k).push(e); }); }
  const m = (a, b) => Math.hypot((a[0] - b[0]) * 111000, (a[1] - b[1]) * 111000 * Math.cos(a[0] * Math.PI / 180));
  for (const e of ends){ let best = null, bd = 45, touch = false; const ka = Math.floor(e[0] / .0005), ko = Math.floor(e[1] / .0005);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) (C.get((ka + x) + ',' + (ko + y)) || []).forEach(f => { if (f[2] === e[2]) return; const d = m(e, f); if (d < 1.5) touch = true; else if (d < bd){ bd = d; best = f; } });
    if (!touch && best) s.join.set(e[2] + ':' + e[3], [best[0], best[1]]); } }
function segPts(i){ const s = SEGS.segs; segJoins(); const p = segDecode(s.g[i]), a = s.join.get(i + ':0'), b = s.join.get(i + ':1'); if (a) p.unshift(a); if (b) p.push(b); return p; }
/* the angle between the trail and straight uphill, in words: 0° climbs straight up the slope, 90° runs level across it */
const alignWords = a => a < 20 ? 'climbs straight up the slope' : a < 45 ? 'climbs close to straight up the slope' : a < 70 ? 'climbs the slope at a slant' : 'runs mostly across the slope';
/* low, flat trail: gentle (average grade under 5%), on a gentle hillside (under 15%) and lower than the ground 30 m around (by 0.25 m or more).
   Within club sections these segments recorded about twice the drainage problems of other trail in 2004-2013; at a square mile the signal is lost. */
const segWet = i => { const s = SEGS.segs; return !!(s.tpi30 && s.tpi30[i] != null && s.gavg[i] != null && s.side[i] != null && s.gavg[i] < 5 && s.side[i] < 15 && s.tpi30[i] < -.25); };
const SEGWETC = '#3DF5C8';
/* Trail Sustainability Rating (Marion & Wimpey 2017), from the segment's average grade and its alignment with the slope:
   Good 3-10% grade and more than 30° off the fall line; Neutral 0-2% (flat: prone to mud and widening rather than erosion);
   Poor 3-10% within 30° of the fall line, or 11-20% more than 30° off it; Very poor 11-20% within 30° of the fall line, or over 20%.
   On the A.T. the four classes recorded 0.65, 0.27, 1.53 and 2.25 times their club section's erosion rate (2004-2013 trail assessments). */
const TSR = [{t:'Good', c:'#3FA672'}, {t:'Neutral (flat)', c:'#A7B3C2'}, {t:'Poor', c:'#E39A3B'}, {t:'Very poor', c:'#C8323C'}];
const tsrOf = i => { const s = SEGS.segs, g = s.gavg[i], a = s.align[i]; if (g == null || a == null) return -1; const gr = Math.round(g);
  return gr <= 2 ? 1 : gr <= 10 ? (a > 30 ? 0 : 2) : gr <= 20 ? (a > 30 ? 2 : 3) : 3; };
/* a cell's sustainability rating, led by its problem trail: Very poor when a quarter or more of its 500-foot segments are Very poor;
   Poor when a quarter or more are Poor or Very poor; otherwise Neutral when more of it is flat than Good, else Good */
const tsrMix = (lv, c) => { const cnt = [0, 0, 0, 0]; let n = 0; if (SEGS) segsIn(lv, c).forEach(i => { const k = tsrOf(i); if (k >= 0){ cnt[k]++; n++; } }); return {cnt, n}; };
const tsrCell = (lv, c) => { if (!SEGS || S.ext !== 'corr') return null; const {cnt, n} = tsrMix(lv, c); if (!n) return null; return cnt[3] / n >= .25 ? 3 : (cnt[2] + cnt[3]) / n >= .25 ? 2 : cnt[1] > cnt[0] ? 1 : 0; };
let segMode = (() => { try { return localStorage.getItem('atgrid_segmode') === 'tsr' ? 'tsr' : 'risk'; } catch (x) { return 'risk'; } })();
/* the segments in a cell: hex ids are the segment's grid id; a cog or wheel id is its leading part */
const segsIn = (lv, c) => { const s = SEGS.segs; if (!s.byCell) s.byCell = {}; let m = s.byCell[lv];
  if (!m){ m = s.byCell[lv] = new Map(); for (let i = 0; i < s.n; i++){ const g = s.grid[i]; if (!g) continue; const p = g.split('-'), id = lv === 'hex' ? g : lv === 'cog' ? p.slice(0, 4).join('-') : p.slice(0, 3).join('-'); if (!m.has(id)) m.set(id, []); m.get(id).push(i); } }
  return m.get(D.levels[lv].id[c]) || []; };
function segVisible(){ return !!(SEGS && segOn && S.q && S.q.id === 'tvul' && S.m && S.m.id !== 'tfall' && S.ext === 'corr' && map.getZoom() >= SEGZ); }
/* choosing the rating measure switches the segments to the rating colors; the Erosion risk button still switches them back */
let segLastM = null; function segSync(){ const k = (S.q && S.q.id) + ':' + (S.m && S.m.id); if (k !== segLastM){ segLastM = k; if (k === 'tvul:tsr') segMode = 'tsr'; } }
function segDraw(){ segSync(); if (!SEGS){ return; } if (!SEGL){ if (!map.getPane('segs')){ const sp = map.createPane('segs'); sp.style.zIndex = 430; sp.style.pointerEvents = 'none'; } SEGL = L.layerGroup().addTo(map); SEGL.r = L.canvas({pane:'segs', padding:.3}); }
  if (!segVisible()){ if (SEGL.getLayers().length) SEGL.clearLayers(); segKey = ''; return; }   /* turning the box off clears the segments right away */
  const b = map.getBounds().pad(.15), s = SEGS.segs, key = [b.toBBoxString(), map.getZoom() | 0, segMode].join('|'); if (key === segKey) return; segKey = key; SEGL.clearLayers();
  const R = RAMP.tvul, s_ = b.getSouth(), n_ = b.getNorth(), w_ = b.getWest(), e_ = b.getEast(), wt = map.getZoom() >= 14 ? 6 : 4.5;
  const vis = [];
  for (let i = 0; i < s.n; i++){ const o = 4 * i; if (s.bb[o + 2] < s_ || s.bb[o] > n_ || s.bb[o + 3] < w_ || s.bb[o + 1] > e_) continue;
    const pts = segPts(i); vis.push([i, pts]); }
  /* all the dark casing first, then the colors, with round ends, so neighboring segments join without notches or slivers */
  vis.forEach(([i, pts]) => L.polyline(pts, {renderer:SEGL.r, pane:'segs', color:'#0B1320', weight:wt + 3, opacity:.9, lineCap:'round', lineJoin:'round', interactive:false}).addTo(SEGL));
  for (const [i, pts] of vis){ const k = segCls(s.risk[i]);
    const ln = L.polyline(pts, {renderer:SEGL.r, pane:'segs', color:segMode === 'tsr' ? (tsrOf(i) < 0 ? '#8A96A8' : TSR[tsrOf(i)].c) : k < 0 ? '#8A96A8' : R[k], weight:wt, opacity:1, lineCap:'round', lineJoin:'round', interactive:false}); ln._si = i; ln.addTo(SEGL);
    if (segWet(i)) L.polyline(pts, {renderer:SEGL.r, pane:'segs', color:SEGWETC, weight:Math.max(2.5, wt - 1.5), opacity:1, dashArray:'4 6', lineCap:'round', interactive:false}).addTo(SEGL); } }
/* the segment layer lets clicks through to the cells under it; a click within a few pixels of a drawn segment opens the segment instead */
function segHit(ll){ if (!SEGL || !segKey || !segVisible()) return false; const pt = map.latLngToLayerPoint(ll); let best = null;
  SEGL.eachLayer(ly => { if (best == null && ly._si != null && ly._pxBounds && ly._containsPoint && ly._containsPoint(pt)) best = ly._si; });
  if (best == null) return false; segPopup(best, ll); return true; }
function segPopup(i, ll){ const s = SEGS.segs, v = (a, d = 0) => a && a[i] != null ? fmt(a[i], d) : '–', r = s.risk[i];
  let rec = ''; if (DEFIC && DEFIC.segs){ if (!DEFIC.segs.m) DEFIC.segs.m = new Map(DEFIC.segs.id.map((x, j) => [x, j])); const j = DEFIC.segs.m.get(s.id[i]);
    rec = j == null ? 'none recorded' : `${DEFIC.segs.eros[j]} erosion, ${DEFIC.segs.drain[j]} drainage, ${DEFIC.segs.other[j]} other`; }
  const low = s.tpi30 && s.tpi30[i] != null ? `<tr><td>Ground around it</td><td>${s.tpi30[i] < 0 ? fmt(-s.tpi30[i], 1) + ' m below the ground 30 m around (a low spot)' : fmt(s.tpi30[i], 1) + ' m above the ground 30 m around'}</td></tr>` : '';
  const html = `<div class="segpop"><b>Trail segment near mile ${v(s.mile, 1)}</b><br>Erosion risk <b>${r == null ? '–' : fmt(r, 0) + ' of 100'}</b>${r >= 80 ? ' · top fifth of the trail' : ''}<br>Sustainability rating <b>${tsrOf(i) < 0 ? '–' : TSR[tsrOf(i)].t}</b><table>
    <tr><td>Steepest sustained grade</td><td>${v(s.gmax, 1)}%</td></tr><tr><td>Average grade</td><td>${v(s.gavg, 1)}%</td></tr><tr><td>Over 10% / over 20%</td><td>${v(s.o10)}% / ${v(s.o20)}% of it</td></tr>
    <tr><td>Hillside steepness</td><td>${v(s.side)}%</td></tr><tr><td>Direction</td><td>${s.align[i] == null ? '–' : alignWords(s.align[i])}</td></tr><tr><td>On the fall line</td><td>${v(s.fall)}% of it</td></tr>${low}${segWet(i) ? '<tr><td>Low, flat trail</td><td>yes: water tends to sit here; stretches like this recorded about twice the drainage problems</td></tr>' : ''}
    ${rec ? `<tr><td>Recorded in trail assessments</td><td>${rec}</td></tr>` : ''}</table><span class="segnote">About 500 feet of trail. Risk ranks grade (60%), hillside steepness (20%) and how directly it climbs (20%) among all segments. The sustainability rating comes from average grade and how directly the trail climbs.</span></div>`;
  L.popup({maxWidth:300, className:'segpopw'}).setLatLng(ll).setContent(html).openOn(map); }
const EXTNO = ['tvul'];   /* questions that list the extent but measure only the trail itself, so HUC10 is shown greyed out */
QVIZ.pest = {title:'Forest at risk by state', note:'Share of the treed area at risk of losing 25% or more of its tree basal area to insects and diseases over 2024 to 2038, with the acres at risk (USDA Forest Service 2024 National Insect and Disease Risk Map).' + VSTNOTE, fn(lv, cells){
    const r = VST.map(() => 0), t = VST.map(() => 0);
    cells.forEach(c => { const s = vStOf(lv, c), a = val('fhr','FHR_AC',lv,c), ta = val('fhr','FHR_TAC',lv,c); if (s < 0 || !ta) return; r[s] += a || 0; t[s] += ta; });
    return VST.map((v, i) => [v[1], HUE.pest, t[i] ? 100 * r[i] / t[i] : 0, t[i] ? `${fmt(100 * r[i] / t[i], 0)}% · ${fmt(Math.round(r[i]), 0)} ac` : '', `${v[1]}: ${fmt(Math.round(r[i]), 0)} of ${fmt(Math.round(t[i]), 0)} treed acres at risk (${fmt(100 * r[i] / t[i], 0)}%)`]).filter((x, i) => t[i] > 0); }};
function fhrBox(lv, cells){ if (!D.themes.fhr || !D.themes.fhr[lv]) return ''; const ci = cells.filter(c => val('fhr','FHR_TAC',lv,c) != null); if (!ci.length) return '';
  const a = ci.reduce((s, c) => s + (val('fhr','FHR_AC',lv,c) || 0), 0), t = ci.reduce((s, c) => s + (val('fhr','FHR_TAC',lv,c) || 0), 0), p = t ? 100 * a / t : 0;
  return `<div class="sec" style="--hue:${HUE.pest}"><h3>Forest health risk</h3><div class="facts"><div><b>${fmt(p, 0)}%</b>of the treed area at risk</div><div><b>${fmt(Math.round(a), 0)}</b>acres at risk</div><div><b>${fmt(Math.round(t), 0)}</b>treed acres</div></div>` +
    `<p class="none" style="font-size:13.5px;margin-top:8px">At risk: 25% or more of the tree basal area expected to die from insects and diseases over 2024 to 2038 without treatment. USDA Forest Service 2024 National Insect and Disease Risk Map, 240 m; a broad-scale planning map, not a stand assessment.</p></div>`; }
const fhrSection = (lv, c) => fhrBox(lv, [c]);
var FHR = null; const FHRHUC = 'data/forest_risk_huc10.json';
var TOPO = null;
var DEFIC = null;
var SEGS = null;
function segApply(){ const j = SEGS; if (!j || j.done || S.ext !== 'corr') return; j.done = true; D.themes.seg = thConv(j, 'seg', D.levels); extIndex(); }
fetch('data/trail_segments.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (!j || !j.segs) return; SEGS = j;
  const s = j.segs, n = s.id.length; s.n = n; s.bb = new Float32Array(4 * n);
  for (let i = 0; i < n; i++){ const g = s.g[i]; let la = g[0], lo = g[1], a0 = la, a1 = la, o0 = lo, o1 = lo; for (let k = 2; k < g.length; k += 2){ la += g[k]; lo += g[k + 1]; if (la < a0) a0 = la; if (la > a1) a1 = la; if (lo < o0) o0 = lo; if (lo > o1) o1 = lo; } s.bb.set([a0 / 1e5, o0 / 1e5, a1 / 1e5, o1 / 1e5], 4 * i); }
  s.byId = new Map(s.id.map((v, i) => [v, i]));
  if (S.ext === 'corr'){ segApply(); TVRANK && Object.keys(TVRANK).forEach(k => delete TVRANK[k]); BRK.clear(); redraw(); } }).catch(() => {});
function deficApply(){ const j = DEFIC; if (!j || j.done || S.ext !== 'corr') return; j.done = true; D.themes.defic = thConv(j, 'defic', D.levels); extIndex(); }
fetch('data/trail_deficiencies.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ DEFIC = j; if (S.ext === 'corr'){ deficApply(); BRK.clear(); redraw(); } } }).catch(() => {});
function topoApply(){ const j = TOPO; if (!j || j.done || S.ext !== 'corr') return; j.done = true; D.themes.topo = thConv(j, 'topo', D.levels); for (const k in WFRANK) delete WFRANK[k]; extIndex(); }
fetch('data/topo_exposure.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ TOPO = j; if (S.ext === 'corr'){ topoApply(); BRK.clear(); redraw(); } } }).catch(() => {});
function fhrApply(){ const j = FHR; if (!j || j.done || S.ext !== 'corr') return; j.done = true; D.themes.fhr = thConv(j, 'fhr', D.levels); extIndex(); }
fetch('data/forest_risk.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ FHR = j; if (S.ext === 'corr'){ fhrApply(); redraw(); } } }).catch(() => {});
const qVizOn = q => !!QVIZ[q.id] && !(q.id === 'land' && S.m.id === 'acq') && (q.id !== 'pest' || !!(S.m && S.m.fhr));
function qVizHTML(){ const d0 = QVIZ[S.q.id]; if (!d0) return ''; const d = d0.pick ? Object.assign({}, d0, d0.pick(S.m.id)) : d0, lv = dispLevel(), th = d.th || S.q.th; const [sl, cells, where] = geoScope(lv);
  let g = `<div id="qvizc"><h4 class="phh">${esc(d.title)}, ${esc(where)}</h4>`;
  if (th && D.themes[th] && !D.themes[th][sl] && S.q.id !== 'hist' && S.q.id !== 'tvul') return g + `<p class="none">${!Object.keys(D.themes[th]).length && typeof nasaNot === 'function' && NASAF.some(x => x[0] === th) ? nasaNot(th) + '.' : 'Not summarized for this cell size.'}</p></div>`;
  if (d.html){ let x = ''; try { x = d.html(sl, cells) || ''; } catch (e) { x = ''; }
    return g + (x || `<p class="none">No data for ${esc(where)}${S.q.id === 'wx' && !D.themes.wx[sl] ? ' yet: the weather summaries (weather.json) have not been built' : ''}.</p>`) + (x ? (['rest', 'tvul', 'mig'].includes(S.q.id) ? `<details class="vzabout"${store.get('vzabout', false) ? ' open' : ''}><summary>About the chart</summary><p class="phnote">${esc(d.note)}${where === 'the map view' ? ' Zoom or pan to change it, or select cells.' : ''}</p></details>` : `<p class="phnote">${esc(d.note)}${where === 'the map view' ? ' Zoom or pan to change it, or select cells.' : ''}</p>`) : '') + '</div>'; }
  if (S.q.id === 'hist' && (!HIST || HIST.st !== 'done')) return g + `<p class="none">${HIST && HIST.st === 'error' ? 'The historic resources could not be loaded. Try again later.' : 'Loading the historic resources…'}</p></div>`;
  let rows = []; try { rows = d.fn(sl, cells) || []; } catch (e) { rows = []; }
  if (!rows.length) return g + `<p class="none">No data for ${esc(where)}.</p></div>`;
  return g + vizBars(rows, d.title + ', ' + where) + `<p class="phnote">${esc(d.note)}${where === 'the map view' ? ' Zoom or pan to change it, or select cells.' : ''}</p></div>`; }
function qVizRefresh(){ if (S.m.find || !qVizOn(S.q)) return; const t = $('#qvizc'); if (t) t.outerHTML = qVizHTML(); }
const geoCharts = lv => geoShareHTML(lv) + geoLithHTML(lv);
function geoVizRefresh(){ if (S.q.id !== 'geo' || S.m.find) return; const t = $('#geolith'), u = $('#geoshare'); if (t) t.outerHTML = geoLithHTML(dispLevel()); if (u) u.outerHTML = geoShareHTML(dispLevel()); }
const Q = [
 {id:'land', th:'lands', hue:HUE.lands, ramp:'land', title:'Who administers land here?',
  use:'Land protected over time maps the acres of A.T. tracts conveyed by each year, from the conveyance date (CONVEYED) in the A.T. administrative areas layer, loaded live; the slider and Play step from the first recorded conveyance to the latest. Tracts without a recorded conveyance date are left out. Number of land administrators counts the agencies and organizations that administer mapped land in each cell, to show how many parties a project may need to coordinate with, and NPS - APPA lands marks the cells with any APPA land. All three are generalized to grid cells and do not show boundaries or who administers any particular spot; check the tract records before relying on them.',
  m:[{id:'mgrs', label:'Number of land administrators', f:'N_MGR', int:1, noun:['administrator','administrators']},
     /* yes-or-no filter: cells where NPS - APPA administers at least one mapped acre are filled in a single color; all others are left empty */
     {id:'appa', label:'NPS - APPA lands', kind:'cat', f:'APPA_YN', yn:'NPS - APPA land', none:'No NPS - APPA land',
      fn:(lv,c)=>{ const r = val('lands','MGRS',lv,c); if (!r) return null; const k = D.cats.MGR.indexOf('NPS - APPA'); for (let i = 0; i < r.length; i += 2) if (r[i] === k) return 0; return null; }},
     {id:'acq', label:'Land protected over time', int:1, noun:['acre','acres'], none:'None conveyed by then', fn:(lv,c)=>acqVal(lv,c), colorFn:(v,lv)=>acqCol(v,lv), legendFn:lv=>acqLegend(lv),
      stripTop:lv=>acqTop(lv), note:'Acres of A.T. tracts conveyed by the year shown, from the conveyance dates in the administrative areas layer. Tracts without a recorded date are left out.'}]},
 {id:'veg', th:'veg', hue:HUE.veg, ramp:'veg', title:'What does the vegetation map say?',
  use:'Data from the NPS Vegetation Map. This is the finest scale vegetation information for the A.T. Corridor. The map covers only part of most cells, so vegetation types are shown in acres, and cells with under 10 mapped acres are faded.',
  m:[{id:'type', label:'Main vegetation type', kind:'cat', f:'DOM_TYPE', many:1, fade:1},
     {id:'types', label:'Number of vegetation types', f:'N_TYPES', int:1, fade:1, noun:['type','types']},
     {id:'cover', label:'Land cover (NLCD level 2)', kind:'cat', f:'L2_DOM', fade:1},
     {id:'open', label:'Open habitat, acres', int:1, zero:1, noun:['acre','acres'], fn:(lv,c)=>{ if(!has('veg',lv,c)) return null; return Math.round(val('veg','VEG_AREA',lv,c) * ((val('veg','L1_HERB',lv,c)||0)+(val('veg','L1_SHRUB',lv,c)||0)+(val('veg','L1_AGRIC',lv,c)||0)) / 100); }},
     {id:'forest', label:'Forest, acres', int:1, zero:1, noun:['acre','acres'], fn:(lv,c)=>{ if(!has('veg',lv,c)) return null; return Math.round(val('veg','VEG_AREA',lv,c) * (val('veg','L1_FOREST',lv,c)||0) / 100); }},
     {id:'acres', label:'Acres mapped', f:'VEG_AREA', int:1, noun:['acre','acres'], fn:(lv,c)=>{ const a = val('veg','VEG_AREA',lv,c); return a == null ? null : Math.round(a); }},
     {id:'mapped', label:'Share of cell mapped', f:'PCT_MAPPED', unit:'%', d:0}]},
 {id:'rec', th:'inat', hue:HUE.live, ramp:'rec', title:'What does iNaturalist show here?',
  use:'Research-grade iNaturalist records from the quarterly download: how many, how many species and observers, and what kinds of life people record here. Use it to see what a cell’s records are made of before leaning on the invasive, flowering or survey maps. Records follow hikers, so they show where people looked as much as what lives there. Select a cell for the full breakdown and a live lookup of the latest observations.',
  m:[{id:'obs', label:'Records', f:'N_OBS', int:1, noun:['record','records']},
     {id:'spp', label:'Species recorded', f:'N_SPP', int:1, fade:1, noun:['species','species']},
     {id:'obsr', label:'Observers', f:'N_OBSERVERS', int:1, noun:['observer','observers']},
     {id:'recent', label:'Records in the last 3 years', f:'N_OBS_RECENT', int:1, zero:1, noun:['record','records']},
     {id:'gplant', label:'Plants, share of records', unit:'%', d:0, zero:1, note:'Research-grade iNaturalist records of plants, as a share of all records in the cell.', fn:(lv,c)=>recPct(lv,c,'PLANT')},
     {id:'ginsect', label:'Insects, share of records', unit:'%', d:0, zero:1, note:'Research-grade iNaturalist records of insects, as a share of all records in the cell.', fn:(lv,c)=>recPct(lv,c,'INSECT')},
     {id:'gfungi', label:'Fungi, share of records', unit:'%', d:0, zero:1, note:'Research-grade iNaturalist records of fungi, including lichens, as a share of all records in the cell.', fn:(lv,c)=>recPct(lv,c,'FUNGI')},
     {id:'gamphib', label:'Amphibians, share of records', unit:'%', d:0, zero:1, note:'Research-grade iNaturalist records of salamanders, frogs and toads, as a share of all records in the cell.', fn:(lv,c)=>recPct(lv,c,'AMPHIB')},
     {id:'gmammal', label:'Mammals, share of records', unit:'%', d:0, zero:1, note:'Research-grade iNaturalist records of mammals, as a share of all records in the cell.', fn:(lv,c)=>recPct(lv,c,'MAMMAL')},
     {id:'native', label:'Native plants, share of plant species', unit:'%', d:0, zero:1, fade:1, note:'Plant species not on the invasive and introduced species lookup, as a share of all plant species recorded. Plants only: the lookup covers introduced plants well but few introduced animals.', fn:(lv,c)=>{ const n = val('inat','PLANT_SPP',lv,c), x = val('inat','N_NONNATIVE_PLANT_SPP',lv,c); return n && x != null ? 100 * (n - x) / n : null; }}]},
 {id:'inv', th:'inat', hue:HUE.inat, ramp:'inv', title:'Where are invasive plants showing up?',
  use:'Invasive plants and forest pests reported on iNaturalist and in EDDMapS, from the quarterly summary; an EDDMapS report that matches an iNaturalist record (same species, within a day and 50 m) is counted once. Use it to aim surveys and volunteer workdays at priority invasives. Under Priority invasives, pick a species to map where it has been recorded since 2010, year by year (Play steps through the years), from research-grade iNaturalist records and EDDMapS reports updated weekly; Visualizations add its range along the trail and the cells with records by year, and Share of plant records, by year uses iNaturalist alone. A blank cell means nothing was reported, which is not the same as nothing there. All records, and a live lookup of the latest, are under iNaturalist Records when you select a cell.',
  m:[{id:'spp', label:'Invasive species reported', int:1, zero:1, fade:1, noun:['species','species'], zeroText:'None reported', note:'Invasive plants and forest pests from iNaturalist and EDDMapS, counted together.', fn:(lv,c)=>invCount(lv,c)},
     {id:'edrr', label:'Priority invasives', int:1, zero:1, fade:1, noun:['species','species'], zeroText:'None reported', note:'Priority invasive plants plus forest pests, from iNaturalist and EDDMapS.', fn:(lv,c)=>priCount(lv,c)},
     {id:'pct', label:'Invasive share of records', unit:'%', d:1, zero:1, fade:1, zeroText:'None reported', note:'Records of invasive plants and forest pests, as a share of all iNaturalist records.', fn:(lv,c)=>invShare(lv,c)},
     {id:'pest', label:'Forest pest records', f:'N_PEST_OBS', int:1, zero:1, noun:['record','records'], note:'Research-grade iNaturalist records of forest pests.'},
     {id:'eddrec', label:'EDDMapS reports', th:'edd', f:'N_EDD_OBS', int:1, zero:1, noun:['report','reports'], zeroText:'None reported', note:'Reports of listed invasive plants and forest pests in EDDMapS. Reports that match an iNaturalist record (same species, within a day and 50 m) are counted once, as iNaturalist.'}]},
 {id:'eff', th:'vis', hue:HUE.eff, ramp:'eff', title:'How many observers are out there?',
  use:'Trail visitation as seen through citizen science: iNaturalist, eBird and EDDMapS together, counted in observer-days (one person active in a square mile on one day, however many records they made). An eBird checklist on the same day and square mile as an iNaturalist observer, within 250 m, counts as the same party, since the two systems’ user names cannot be matched; EDDMapS has no observer names, so each report is a report-day, merged the same way. This is an index of naturalist and birder activity, not a headcount of visitors: use it to compare places, seasons and years. eBird reaches GBIF about a year late, so the latest year leans on iNaturalist. Play the years under Visualizations to watch visitation change.',
  m:[{id:'od', get label(){ return S.visAdj ? 'Visitation index (observer-days)' : 'Observer-days per year'; }, get int(){ return !S.visAdj; }, get noun(){ return S.visAdj ? null : ['observer-day','observer-days']; }, d:0, zero:1, none:'No observers recorded', fn:(lv,c)=>visOD(lv,c), colorFn:(v,lv)=>visCol(v,lv), legendFn:lv=>visLegend(lv), stripTop:lv=>visTop(lv),
      note:'Observer-days in an average recent year (the latest three years with eBird data, as eBird reaches GBIF about a year late), or in the year picked under Visualizations. One person active in a square mile on one day is one observer-day.', boxFn:(lv, cells) => visBoxText('od', lv, cells)},
     {id:'obsr', label:'Unique observers', f:'VIS_OBSR', int:1, zero:1, noun:['observer','observers'], boxFn:(lv, cells) => visBoxText('obsr', lv, cells), note:'Different people with an iNaturalist record or eBird checklist in the cell, any year. EDDMapS does not publish observer names, so its reports are not in this count.'},
     {id:'peak', label:'Peak month', kind:'cat', f:'VIS_PEAK', boxFn:(lv, cells) => visBoxText('peak', lv, cells), fn:(lv,c)=>{ const v = val('vis','VIS_PEAK',lv,c); return v ? v - 1 : null; }, note:'The month with the most observer-days, all years together.'},
     {id:'rpd', label:'Records per observer-day', f:'VIS_RPD', d:1, noun:['record','records'], boxFn:(lv, cells) => visBoxText('rpd', lv, cells), note:'iNaturalist records and eBird species records per observer-day: how much each visit records.'}]},
 {id:'bird', th:'ebird', hue:HUE.ebird, ramp:'bird', title:'What birds are found here?',
  use:'Bird species recorded on eBird checklists (the eBird Observation Dataset via GBIF, updated yearly), grouped by the habitat each species depends on. Use it to see where forest-interior, grassland or high-elevation birds concentrate, and where species of conservation concern have been found. Counts follow birding effort: thinly birded cells are faded, and Bird species, standardized compares cells at equal sampling completeness.',
  m:[{id:'bcc', label:'Birds of Conservation Concern', f:'N_BCC_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'spp', label:'Bird species, standardized', f:'COV_RICHNESS', int:1, noun:['species','species'], none:'Too few checklists to estimate',
      note:'An estimate of bird species at equal sampling completeness (90% coverage), so heavily and lightly birded cells can be compared. Cells with too few checklists have no value.'},
     {id:'sppraw', label:'Bird species, raw count', f:'N_SPP', int:1, fade:1, noun:['species','species']},
     {id:'fi', label:'Forest-interior species', f:'FOREST_INT_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'fg', label:'Forest generalist species', f:'FOREST_GEN_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'co', label:'High-elevation conifer species', f:'CONIFER_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'sh', label:'Shrubland species', f:'SHRUB_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'gr', label:'Grassland species', f:'GRASS_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'ed', label:'Edge species', f:'EDGE_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'we', label:'Wetland species', f:'WETLAND_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'ri', label:'Riparian species', f:'RIPARIAN_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'wb', label:'Waterbird species', f:'WATERBIRD_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'sb', label:'Shorebird species', f:'SHORE_SPP', int:1, zero:1, fade:1, noun:['species','species']},
     {id:'se', label:'Seabird species', f:'SEABIRD_SPP', int:1, zero:1, fade:1, noun:['species','species']}]},
 {id:'soil', th:'soil', hue:HUE.soil, ramp:'soil', title:'Where are trail soils most vulnerable?',
  use:'Soil ratings from the NRCS soil survey (gSSURGO), averaged over each cell. The trail vulnerability index combines three NRCS ratings for trails: erosion hazard on unsurfaced trails, suitability for paths and trails, and rutting hazard. The classes of each rating are scored in even steps from 0, its best class, to 1, its worst, and the three are averaged. Use it to screen stretches for erosion, rutting and tread problems. It rates the soil, not the trail alignment or its condition.',
  m:[{id:'vuln', label:'Trail vulnerability index', f:'VULN', d:2, showFn:vulnShow, none:'Soils not rated',
      note:'0 to 1, higher is more vulnerable. Low is under 0.33, Moderate 0.33 to 0.67, High over 0.67.'},
     {id:'high', label:'Soils rated high vulnerability', f:'VULN_HIGH', unit:'%', d:0, zero:1, zeroText:'None', none:'Soils not rated'},
     {id:'paths', label:'Very limited for paths and trails', f:'PATHS_VLIM', unit:'%', d:0, zero:1, zeroText:'None', none:'Soils not rated'},
     {id:'rut', label:'Severe rutting hazard', f:'RUT_SEV', unit:'%', d:0, zero:1, zeroText:'None', none:'Soils not rated'},
     {id:'steep', label:'Slopes over 25%', f:'STEEP', unit:'%', d:0, zero:1, zeroText:'None'},
     {id:'kfac', label:'Highly erodible soils', f:'K_HIGH', unit:'%', d:0, zero:1, zeroText:'None', note:'Soils with a K factor over 0.32.'},
     {id:'rock', label:'Shallow to bedrock', f:'SHALLOW_ROCK', unit:'%', d:0, zero:1, zeroText:'None', note:'Bedrock within 50 cm of the surface.'},
     {id:'hydric', label:'Hydric (wet) soils', f:'HYDRIC', unit:'%', d:0, zero:1, zeroText:'None'},
     {id:'prime', label:'Prime farmland', f:'PRIME', unit:'%', d:0, zero:1, zeroText:'None'}]},
 {id:'wet', th:'wet', hue:HUE.wet, ramp:'wet', title:'Where are the wetlands?',
  use:'Wetlands and deepwater habitats from the USFWS National Wetlands Inventory (NWI), in acres for each whole cell. Use it to plan trail construction and relocations, keep herbicide work back from water, and find wetlands worth a field check before work. NWI is mapped from aerial imagery and misses many small, forested and seasonally wet wetlands, so it is a screen, not a delineation.',
  m:[{id:'type', label:'Main wetland type', kind:'cat', f:'WET_DOM', none:'None mapped'},
     {id:'acres', label:'Wetland acres', f:'WET_AC', zero:1, zeroText:'None mapped', noun:['acre','acres'], showFn:wetAc},
     {id:'vegw', label:'Vegetated wetland acres', f:'VEGW_AC', zero:1, zeroText:'None mapped', noun:['acre','acres'], showFn:wetAc, note:'Forested, shrub and emergent wetlands: swamps, bogs, fens, marshes and wet meadows. Open water is left out.'},
     {id:'sens', label:'Possibly sensitive wetlands', f:'SENS_AC', zero:1, zeroText:'None flagged', noun:['acre','acres'], showFn:wetAc,
      note:'Wetlands whose NWI codes suggest bogs or fens, seeps, aquatic beds, beaver-influenced areas or possible vernal pools. A flag for a field check, not a determination.'},
     {id:'n', label:'Number of wetlands', f:'N_WET', int:1, zero:1, zeroText:'None mapped', noun:['wetland','wetlands'], note:'NWI wetlands touching the cell. One that crosses several cells counts in each.'},
     {id:'lands', label:'Wetland acres on A.T. lands', f:'L_WET_AC', zero:1, zeroText:'None mapped', noun:['acre','acres'], showFn:wetAc,
      note:'Only the part of each wetland that lies on A.T. lands. Cells without A.T. lands show none.'}]},
 {id:'rest', th:'veg', hue:HUE.rest, ramp:'rest', title:'Where do we target restoration?',
  use:'Two restoration scores, from 0 to 100, for restoration on A.T. corridor lands, built from the other layers here. Grasslands and early successional habitat favors open habitat near rare species, with priority invasive plants, soils suited to grassland management, grassland and shrubland birds, and vistas. Forests favors forest near rare species, with forest pests, priority invasive plants and places where hikers gather. Grassland birds carry the most weight, since they are declining and their habitat is scarce. Turn on Herbicide use to lower the scores of cells with wetlands, since nearby wetlands can limit herbicide use. Priority invasive plants and forest pests count reports from iNaturalist and EDDMapS. Private land is left out: the points are scaled by the share of the cell\u2019s corridor land that is not private; switch Lands to APPA only to count NPS - APPA land alone, which leaves cells without APPA land blank. Use it to shortlist cells for a closer look; check the parts in the cell panel.',
  m:[{id:'grass', label:'Grasslands and early successional', int:1, brkP:[.4,.7,.85,.95], get none(){ return S.appa ? 'No APPA land, or no open habitat mapped' : 'No open habitat mapped'; }, showFn:v => v + ' of 100', get note(){ return 'Points: ' + restNote('grass'); }, fn:(lv,c) => restScore('grass', lv, c)},
     {id:'forest', label:'Forests', int:1, brkP:[.4,.7,.85,.95], get none(){ return S.appa ? 'No APPA land, or no forest mapped' : 'No forest mapped'; }, showFn:v => v + ' of 100', get note(){ return 'Points: ' + restNote('forest'); }, fn:(lv,c) => restScore('forest', lv, c)}]},
 {id:'phen', th:'inat', hue:HUE.phen, ramp:'phen', title:'When does it flower here?',
  use:'When nearly fifty plants flower along the trail, from research-grade iNaturalist records updated weekly: trail-wide species, A.T. Seasons (USA-NPN) focal plants, northern and southern indicators, and AMC focal species. Flowering, week by week opens first: each week’s flowering records show as dots, with the week before fading, over cells colored by records in the three weeks around it, so Play shows flowering moving up the trail; first, peak and season length follow USA National Phenology Network measures, pooled across years. Year first recorded shows where it has been recorded. Visualizations add a flowering calendar by latitude, drawn like USA-NPN calendars: the middle 80% and 50% of flowering-record dates and the median for each band, north to south, and the weekly share of records for one band. Records follow hikers, so a blank cell means too few records, not absence.',
  m:[{id:'spread', label:'Year first recorded', yr:'y', hasTxt:() => phYear() ? `had a record by ${phYear()}` : 'have records', sumFn:phSum, asc:1, sumTitle:() => phYear() ? `Recorded by ${phYear()}, earliest first` : 'Recorded earliest', d:0, none:'No records (yet)', showFn:v => 'first recorded ' + v, fn:(lv, c) => phFirst(lv, c), colorFn:phFirstCol,
      stripCnt:(lv, c, all) => phRecBy(lv, c, all),
      legendFn:lv => phFirstPal().map(e => `<div class="row"><i style="background:${e[1]}"></i><span>${e[2]}</span></div>`).join('') + `<p class="sub">${phYear(lv) ? 'Cells with a record by ' + phYear(lv) + ', by the year of the first one.' : 'The year of the first record in each cell.'} Bars under the map: the same cells in the same colors, taller where there are more records by then (iNaturalist and EDDMapS; square-root scale).</p>`},
     {id:'wave', hideFn:() => SPREADQ(), get label(){ const k = phSp().kind; return k === 'plant' ? 'Flowering, week by week' : k === 'adult' ? 'Adults, week by week' : 'Records, week by week'; },
      yr:'wk', st:() => phMain(), hasTxt:() => 'have records of this species', sumFn:phSum, sumTitle:() => `Most ${PHWORD[S.m.st()] === 'records' ? '' : PHWORD[S.m.st()] + ' '}records around ${wkDate(S.ph.wk)}${phYear() ? ', ' + phYear() : ''}`, showFn:v => `${v} ${v === 1 ? 'record' : 'records'}`, int:1, zero:1, zeroText:'Not these weeks', none:'No records', noun:['record','records'], fn:(lv, c) => phWin(lv, c, phMain()),
      colorFn:phWaveCol, legendFn:phWaveLegend, stripTop:lv => phTop(lv, phMain())},
     {id:'share', get label(){ return phSp().set === 'pinv' ? 'Share of plant records, by year' : 'Share of records, by year'; }, yr:'y', hideFn:() => !SPREADQ(),
      hasTxt:() => `have enough ${phSp().set === 'pinv' ? 'plant ' : ''}records${phYear() ? ' in ' + phYear() : ''} to tell`, sumFn:phSum,
      sumTitle:() => `Highest share of ${phSp().set === 'pinv' ? 'plant ' : ''}records${phYear() ? ', ' + phYear() : ', 2010 on'}`, d:1, zero:1,
      none:'Too few records to tell', showFn:v => phShTxt(v), fn:(lv, c) => phShare(lv, c), colorFn:v => phShCol(v),
      stripH:v => Math.min(v, 10), stripTop:() => 10, legendFn:lv => phShLegend(lv)},
     {id:'onset', get label(){ return `First ${phNoun()} date`; }, hasTxt:() => `have 5 or more ${phNoun()} records, enough to date`, sumFn:phSum, asc:1, sumTitle:() => `Earliest first ${phNoun()} dates`, hideFn:() => phSp().kind === 'spread', d:0, none:'Fewer than 5 records', showFn:v => doyDate(v),
      fn:(lv, c) => { const A = phAgg(lv); return A ? A.on[c] : null; }, colorFn:phDateCol, stripH:v => Math.max(1, v - 60), stripTop:() => 180,
      legendFn:() => phDateLegend(`Onset: the date of the earliest 10% of ${phNoun()} records in each cell, all years together. Cells need 5 or more records; larger cells fill in more.`)},
     {id:'peak', get label(){ return `Peak ${phNoun()} date`; }, hasTxt:() => `have 5 or more ${phNoun()} records, enough to date`, sumFn:phSum, asc:1, sumTitle:() => `Earliest peak ${phNoun()} dates`, hideFn:() => phSp().kind === 'spread', d:0, none:'Fewer than 5 records', showFn:v => doyDate(v),
      fn:(lv, c) => { const A = phAgg(lv); return A ? A.pk[c] : null; }, colorFn:phDateCol, stripH:v => Math.max(1, v - 60), stripTop:() => 180,
      legendFn:() => phDateLegend(`Peak: the middle (median) date of the ${phNoun()} records in each cell, all years together. Cells need 5 or more records.`)},
     {id:'len', get label(){ return phSp().kind === 'adult' ? 'Adult season length' : 'Flowering season length'; }, hasTxt:() => `have 8 or more ${phNoun()} records, enough for a season length`, sumFn:phSum, sumTitle:() => phSp().kind === 'adult' ? 'Longest adult seasons' : 'Longest flowering seasons', hideFn:() => phSp().kind === 'spread', d:0, unit:' days', none:'Fewer than 8 records',
      showFn:v => `${Math.max(1, Math.round(v / 7))} ${Math.round(v / 7) > 1 ? 'weeks' : 'week'}`, fn:(lv, c) => { const A = phAgg(lv); return A ? A.len[c] : null; }, colorFn:phLenCol, stripTop:() => 70,
      legendFn:() => PHLEN.map(e => `<div class="row"><i style="background:${e[1]}"></i><span>${e[2]}</span></div>`).join('') + `<p class="sub">Duration: from the earliest 10% to the latest 10% of ${phNoun()} records in each cell, all years together. Cells need 8 or more records.</p>`}]},
 {id:'hist', th:'hist', hue:HUE.hist, ramp:'hist', title:'Where are the historic resources?',
  use:'National Register properties (NPS) and OpenStreetMap cemeteries in each cell, rebuilt monthly, with links to the National Register record and Find a Grave. The extent buttons set the scale: A.T. corridor counts the records inside an A.T. administrative area, and HUC10 watershed counts every record in the watersheds around the trail. Recorded sites only: small family cemeteries are often missing.',
  m:[{id:'hany', label:'All historic resources', fn:(lv, c) => hCount(lv, c, 'any'), int:1, hollow0:1, none:'None recorded', noun:['resource','resources'], hasTxt:() => 'have a recorded historic resource'},
     {id:'hnr', label:'National Register properties', fn:(lv, c) => hCount(lv, c, 'nr'), int:1, hollow0:1, none:'None recorded', noun:['property','properties'], hasTxt:() => 'have a National Register property'},
     {id:'hcem', label:'Cemeteries (OpenStreetMap)', fn:(lv, c) => hCount(lv, c, 'cem'), int:1, hollow0:1, none:'None recorded', noun:['cemetery','cemeteries'], hasTxt:() => 'have a recorded cemetery'}]},
 {id:'feat', th:'feat', hue:HUE.feat, ramp:'feat', title:'What\u2019s built and maintained along the trail?',
  use:'Trail facilities and features in each cell, with its miles of A.T.: shelters, campsites, privies, parking, bridges and vistas are counted live from the A.T. facilities map service, the same points as the map layers; side trails, maintained landscapes and other features come from the A.T. facilities inventory. Trail structures such as waterbars and steps are recorded by maintainer section, so they are estimated for each cell from its share of the section\u2019s trail miles.',
  m:[{id:'fac', label:'Trail facilities', f:'N_FAC', int:1, hollow0:1, none:'None in this cell', noun:['facility','facilities'], note:'Shelters, campsites, privies, parking areas, bridges, buildings, dams and tunnels.'},
     {id:'atmi', label:'A.T. miles', f:'AT_MI', d:1, hollow0:1, none:'None in this cell', showFn:v => fmt(v, 1) + ' mi'},
     {id:'shel', label:'Shelters', f:'N_SHELTER', int:1, hollow0:1, none:'None in this cell', noun:['shelter','shelters']},
     {id:'camp', label:'Campsites', f:'N_CAMPSITE', int:1, hollow0:1, none:'None in this cell', noun:['campsite','campsites']},
     {id:'priv', label:'Privies', f:'N_PRIVY', int:1, hollow0:1, none:'None in this cell', noun:['privy','privies']},
     {id:'park', label:'Parking areas', f:'N_PARKING', int:1, hollow0:1, none:'None in this cell', noun:['parking area','parking areas']},
     {id:'brid', label:'Bridges', f:'N_BRIDGE', int:1, hollow0:1, none:'None in this cell', noun:['bridge','bridges']},
     {id:'vist', label:'Vistas', f:'N_VISTA', int:1, hollow0:1, none:'None in this cell', noun:['vista','vistas']},
     {id:'side', label:'Side trail miles', f:'SIDE_MI', d:1, hollow0:1, none:'None in this cell', showFn:v => fmt(v, 1) + ' mi'},
     {id:'mlac', label:'Maintained landscapes', f:'ML_AC', int:1, hollow0:1, none:'None in this cell', noun:['acre','acres']},
     {id:'drain', label:'Drainage structures (estimated)', f:'S_DRAIN', int:1, hollow0:1, none:'None in this cell', noun:['structure','structures'],
      note:'Waterbars, check dams, drainage dips, culverts and French drains. Estimated from maintainer section counts.'},
     {id:'drainmi', label:'Drainage structures per A.T. mile (estimated)', d:0, note:'Cells with under a quarter mile of A.T. are left blank.',
      fn:(lv,c) => { const m = val('feat','AT_MI',lv,c), n = val('feat','S_DRAIN',lv,c); return m == null || m < .25 ? null : Math.round(n / m); }},
     {id:'steps', label:'Steps and climbs (estimated)', f:'S_STEPS', int:1, hollow0:1, none:'None in this cell', noun:['item','items'],
      note:'Stair steps, step stones, metal rungs and ladders. Estimated from maintainer section counts.'}]},
 {id:'pri', th:'nrpz', hue:HUE.nrpz, ramp:'pri', title:'Where do projects need to take a closer look?',
  use:'Shows where unique species have sensitive populations, based on plant and animal records. Use it to screen a proposed project site early, and bring in resource staff before plans firm up where populations are highly or very highly sensitive.',
  m:[{id:'tier', label:'Unique Species', kind:'cat', f:'review_tie'}]},
 {id:'geo', th:'geo', hue:HUE.geo, ramp:'geo', title:'What are the geologic resources here?',
  use:'The bedrock under each cell, from the USGS State Geologic Map Compilation (one seamless map built from the state geologic maps), and how well the geology is mapped, from the NPS Geologic Resources Inventory’s footprints of published and in-progress geologic maps. Use it to spot carbonate bedrock where caves, sinkholes and sensitive groundwater are likely, mafic and ultramafic rock that often carries rare plants, and places where detailed geologic mapping exists or is still needed. Select a cell for its bedrock units and the geologic maps that cover it, with links to the National Geologic Map Database.',
  m:[{id:'lith', label:'Main bedrock type', kind:'cat', f:'GEO_LITH', note:'The bedrock type covering the most area in each cell (USGS State Geologic Map Compilation).'},
     {id:'age', label:'Age of the main bedrock unit', kind:'cat', f:'GEO_AGE', note:'Geologic age of the largest bedrock unit in each cell (its older age, where a range is given).'},
     {id:'best', grp:'Available geologic map data', label:'Most detailed geologic map', kind:'cat', f:'MAP_BEST', note:'The most detailed scale of bedrock or general geologic mapping covering at least half the cell (NPS Geologic Resources Inventory map footprints).'},
     {id:'det', grp:'Available geologic map data', label:'Mapped at 1:24,000 or more detail', f:'PCT_DETAIL', unit:'%', d:0, zero:1, zeroText:'None', note:'Share of the cell covered by bedrock or general geologic maps at 1:24,000 or more detail.'},
     {id:'surf', grp:'Available geologic map data', label:'Surficial geologic mapping', kind:'cat', f:'SURF', note:'Mapping of surface materials such as glacial, river and landslide deposits covering at least half the cell.'},
     {id:'gis', grp:'Available geologic map data', label:'Digital geologic map data', kind:'cat', f:'GIS_BEST', note:'The most detailed geologic mapping covering at least half the cell that is available as GIS data.'},
     {id:'new', grp:'Available geologic map data', label:'Newest geologic map', kind:'cat', f:'GEO_NEWEST', fn:(lv,c) => geoNewest(lv, c), note:'Publication year of the newest published geologic map covering at least a tenth of the cell. Maps still in progress are listed when you select a cell.'}]},
 {id:'tvul', th:'slope', hue:HUE.tvul, ramp:'tvul', title:'Where is the trail most at risk?',
  use:'A model, like the restoration score, that ranks where the trail is most likely to erode, rut or wash out. It adds points for trail grade, hillside steepness and how directly the trail runs up the slope, each taken from the cell’s steepest 500-foot trail segments (measured along the A.T. centerline from USGS 3DEP lidar elevation), heavy rain (NOAA), use hot spots: parking areas, shelters, campsites and vistas, where hikers gather and wear spreads (A.T. facilities inventory), and soil erosion hazard and wet soils (NRCS). The weights were tested against the problems recorded in the trail assessments, which are also mapped here, with a separate, provisional score for wet tread. Forest pests and invasive plants are added at a low weight as early signs of declining forest health, whose effects on canopy, ground cover, soils and downed trees cascade to the trail. Change the weights under Model weights. Select a cell to see what drives its score.',
  m:[{id:'score', label:'Vulnerability score', int:1, brkP:[.4,.7,.85,.95], fn:(lv,c)=>tvScore(lv,c), none:'No trail here', note:'0 to 100: points from each factor, scaled to 100 over the factors with data. Higher means more likely to erode, rut or wash out.'},
     {id:'grade', label:'Average trail grade', hideFn:() => !tvSlopeOn(), stripTop:lv => tvTop(lv, 'TS_GRADE'), th:'slope', f:'TS_GRADE', unit:'%', d:0, none:'No trail here', note:'Average grade along the trail, from USGS 3DEP elevation every 10 m, smoothed over 30 m.'},
     {id:'g10', label:'Trail over 10% grade', hideFn:() => !tvSlopeOn(), stripTop:lv => tvTop(lv, 'TS_G10'), th:'slope', f:'TS_G10', unit:'%', d:0, zero:1, zeroText:'None', none:'No trail here', note:'Share of the trail steeper than 10%, where soil loss rises sharply.'},
     {id:'tsr', label:'Sustainability rating (TSA)', kind:'cat', cite:'Trail sustainability rating and trail slope alignment (TSA): Marion, J.L., and Wimpey, J., 2017, Assessing the influence of sustainable trail design and maintenance on soil loss. Journal of Environmental Management 189: 46–57.', citeUrl:'https://doi.org/10.1016/j.jenvman.2016.11.074', f:'TSR', fn:(lv,c) => tsrCell(lv, c), hideFn:() => !SEGS || S.ext !== 'corr', none:'No trail here', note:'Each 500-foot trail segment is rated from its average grade and how directly it climbs the slope: Good (3–10% grade, angled across the slope), Neutral (flat, 0–2%, prone to mud and widening), Poor or Very poor (steeper, or climbing close to straight up). A cell is Very poor when a quarter or more of its trail is Very poor, and Poor when a quarter or more is Poor or Very poor; otherwise it is Neutral where more of the trail is flat than Good, and Good elsewhere. Zoom in to see each segment in the same colors.'},
     {id:'fall', label:'Trail on the fall line', hideFn:() => !tvSlopeOn(), stripTop:lv => tvTop(lv, 'TS_FALL'), th:'slope', f:'TS_FALL', unit:'%', d:0, zero:1, zeroText:'None', none:'No trail here', note:'Share of the trail running nearly straight up and down the slope (on the fall line) on ground steeper than 5%: water runs down the tread instead of off it.'}]},
 {id:'wx', th:'wx', hue:HUE.wx, ramp:'wx', title:'What climate shapes the trail here?',
  use:'Climate normals and damaging weather from authoritative sources: PRISM 1991–2020 normals (Oregon State University, the official climate data of the U.S. Department of Agriculture) for precipitation and temperature; NOAA nClimGrid-Daily for the frost-free season and heavy-rain days; NOAA Atlas 14 for the 25-year storm; and the NOAA Storm Events Database for damaging wind and winter storms since 1996. Wind comes from gridMET, a research dataset. Change since 1980 compares 1981–2000 with the latest 20 years, from Daymet (1 km daily, ORNL DAAC). Use it to plan work seasons, size drainage for big storms, and see where storms most often damage the trail. Play the months or years under Visualizations.',
  m:[wxM({id:'ppt', wxKey:'WX_PPT', wxRamp:'wet', wxFloor:1, wxAnim:'mon', wxMonF:'WX_PPT_M', showFn:wxIn, d:1, fn:(lv,c)=>S.wxMon != null ? wxMonVal(lv,c,'WX_PPT_M') : val('wx','WX_PPT',lv,c),
       get label(){ return S.wxMon != null ? 'Precipitation in ' + MONTHS_LONG[S.wxMon] : 'Annual precipitation'; },
       note:'Average rain and melted snow, 1991–2020 (PRISM 30-year normals, 800 m). Play the months under Visualizations to see the year go by.'}),
     {id:'wetm', label:'Wettest month', kind:'cat', f:'WX_WETM', note:'The month with the most precipitation on average, 1991–2020 (PRISM normals).'},
     wxM({id:'tmean', wxKey:'WX_TMEAN', wxRamp:'temp', wxFloor:1, wxAnim:'mon', wxMonF:'WX_TMEAN_M', showFn:wxF, d:0, fn:(lv,c)=>S.wxMon != null ? wxMonVal(lv,c,'WX_TMEAN_M') : val('wx','WX_TMEAN',lv,c),
       get label(){ return S.wxMon != null ? 'Mean temperature in ' + MONTHS_LONG[S.wxMon] : 'Mean annual temperature'; },
       note:'Average of the daily highs and lows, 1991–2020 (PRISM normals). Play the months under Visualizations.'}),
     wxM({id:'tmax7', label:'July average high', f:'WX_TMAX7', wxRamp:'temp', wxFloor:1, showFn:wxF, d:0, note:'Average daily high temperature in July, 1991–2020 (PRISM normals).'}),
     wxM({id:'tmin1', label:'January average low', f:'WX_TMIN1', wxRamp:'temp', wxFloor:1, showFn:wxF, d:0, note:'Average daily low temperature in January, 1991–2020 (PRISM normals).'}),
     wxM({id:'frost', label:'Frost-free season', f:'WX_FROSTFREE', wxRamp:'grow', showFn:v => fmt(Math.round(v), 0) + ' days', d:0, note:'Days between the last spring and first fall low of 32°F or colder, averaged over 1991–2020 (NOAA nClimGrid-Daily, about 4 km). Mountain tops have shorter seasons than the valleys around them.'}),
     wxM({id:'heavy', label:'Heavy-rain days', f:'WX_HEAVY', wxRamp:'wet', showFn:v => fmt(v, 1) + ' days', d:1, note:'Days a year with 1 inch or more of precipitation, averaged over 1991–2020 (NOAA nClimGrid-Daily). Heavy rain drives trail erosion and washouts.'}),
     wxM({id:'p25', label:'25-year, 24-hour storm', f:'WX_P25', wxRamp:'wet', showFn:v => fmt(v, 1) + ' in', d:1, note:'Rainfall in 24 hours with a 1-in-25 chance each year (4% annual chance), from NOAA Atlas 14. A common standard for sizing culverts and drainage.'}),
     wxM({id:'wind', grp:'Wind (gridMET, a research dataset)', label:'Average wind speed', f:'WX_WIND', wxRamp:'wind', showFn:wxMph, d:1, note:'Average daily wind speed at 10 m, 1991–2020, from gridMET (University of Idaho), a research dataset rather than an official record. Its 4 km grid smooths the terrain, so exposed ridges are windier than shown: compare places rather than reading exact speeds.'}),
     wxM({id:'windy', grp:'Wind (gridMET, a research dataset)', label:'Windy days', f:'WX_WINDY', wxRamp:'wind', wxSkew:1, showFn:v => fmt(v, 1) + ' days', d:1, note:'Days a year with an average wind of 15 mph or more, 1991–2020 (gridMET, a research dataset; ridge-top winds are understated).'}),
     wxM({id:'evwind', grp:'Damaging weather (NOAA Storm Events)', label:'Damaging wind events', wxG:'WIND', wxRamp:'WIND', wxSkew:1, wxAnim:'yr', d:1, showFn:wxEvFmt, fn:(lv,c)=>wxEv(lv,c,'WIND'),
       note:'Thunderstorm wind, high wind, strong wind and tornado events in the NOAA Storm Events Database, per year since 1996 (or in the year played). Each event counts in every cell in the National Weather Service forecast zone or county it was reported for, so cells of any size compare fairly.'}),
     wxM({id:'evwinter', grp:'Damaging weather (NOAA Storm Events)', label:'Winter storm events', wxG:'WINTER', wxRamp:'WINTER', wxSkew:1, wxAnim:'yr', d:1, showFn:wxEvFmt, fn:(lv,c)=>wxEv(lv,c,'WINTER'),
       note:'Ice storm, winter storm, heavy snow and blizzard events in the NOAA Storm Events Database, per year since 1996 (or in the year played). Nearly all are reported for National Weather Service forecast zones.'})]},
 {id:'cult', th:'inat', hue:HUE.cult, ramp:'cult', title:'Where are plants of cultural significance?',
  use:'Plants documented as culturally significant to Eastern Woodlands nations, where they have research-grade iNaturalist records in the quarterly summary. The list of ' + CULTD.length + ' plants comes from the Greenbelt Indigenous Botanical Survey (Plenty Canada, Dolan and Ni 2026), Mooney (1891), Mooney and Olbrechts (1932), Tantaquidgeon (1942), the Haudenosaunee Confederacy and Cherokee and Wabanaki sources. Use it as a starting point for consultation with Tribal Historic Preservation Officers, not as a statement of any nation’s knowledge. Ginseng, goldenseal, ramps and lady’s slippers are shown only at the 49 sq mi scale. A blank cell means no records, not that the plants are absent.',
  m:[{id:'spp', label:'Number of culturally significant species', int:1, zero:1, fade:1, noun:['species','species'], zeroText:'No species recorded', note:'How many different species on the cultural plants list have research-grade iNaturalist records in each cell.', fn:(lv,c)=>cultCount(lv,c)},
     {id:'withinv', label:'Culturally significant plants alongside priority invasives', int:1, zero:1, fade:1, noun:['species','species'], zeroText:'No priority invasives recorded with them',
      note:'Culturally significant species recorded in cells where priority invasive plants are also recorded (research-grade iNaturalist records and EDDMapS reports, quarterly summary): where invasive plant control would protect them. Cells with listed species but no priority invasives show as none.',
      hasTxt:() => 'have culturally significant plants alongside priority invasives',
      fn:(lv,c)=>{ const k = cultCount(lv,c); if (k == null) return null; return (invL('EDRR_LIST', lv, c) || []).length ? k : 0; }}]}
];
for (let i = Q.length - 1; i >= 0; i--) if (!D.themes[Q[i].th]) Q.splice(i, 1);
{ const p = Q.find(q => q.id === 'phen'); Q.push(Object.assign({}, p, {id:'pest', hue:HUE.pest, title:'Where are forest pests showing up?',
    use:'Where forest pests have been recorded along the trail since 2010, year by year, from research-grade iNaturalist records and EDDMapS reports, updated weekly: spotted lanternfly, spongy moth, hemlock woolly adelgid, beech leaf disease, emerald ash borer, elongate hemlock scale, and others with 100 or more iNaturalist records, most recorded first. Year first recorded maps the cells with a record by the year shown, and Play steps through the years; Share of records, by year shows how much of each cell\u2019s iNaturalist records the pest makes up. Visualizations add its range along the trail and the cells with records by year. Records follow observers, so a first record marks when a pest was noticed, and a blank cell means nothing reported, not absence.'})); }
/* forest health risk (USDA Forest Service NIDRM 2024): in "What shape is the forest in?" (FHRM, added there) */
const FHRM = {id:'fhr', fhr:1, grp:'Risk of tree loss (USFS)', th:'fhr', label:'Forest at risk of tree loss (USFS)', f:'FHR_PCT', unit:'%', d:0, zero:1, zeroText:'None at risk', none:'No trees mapped',
     note:'Share of the treed area where 25% or more of the tree basal area is expected to die from insects and diseases over 2024 to 2038, without treatment (USDA Forest Service 2024 National Insect and Disease Risk Map, 240 m).'};
/* tree fall vulnerability (screening): factors [key, label, weight, note, part] */
const WFG = {load:'Wind loading', weak:'Tree weakness', people:'People at risk'};
const WFDEF = [
  ['expo', 'Topographic exposure', 30, 'How high the trail and high-use sites sit above the ground 1 km around (USGS 3DEP elevation, every 30 m on the centerline), ranked among trail cells: summits, knobs and exposed ridges take the strongest wind', 'load'],
  ['storm', 'Storm history', 10, 'Damaging wind, ice storm and winter storm reports per year (NOAA Storm Events, by county or forecast zone), ranked among cells', 'load'],
  ['pest', 'Forest pests and disease', 25, 'The highest of three signs of trees weakened by insects and disease: modeled risk of losing 25% or more of the basal area (USFS 2024 risk map, ranked among cells); damage mapped from the air since 2016 along the trail and at high-use sites (USFS Insect and Disease Survey, mortality in full and defoliation at half); and hemlock types (APPA vegetation map), counted in full where hemlock woolly adelgid or elongate hemlock scale is recorded in the cell', 'weak'],
  ['root', 'Shallow rooting', 15, 'The higher of the share of soils with bedrock within 50 cm or poorly drained (gSSURGO) and the share of the mapped vegetation in shallow-rooted spruce, fir, hemlock, pine and cedar types (APPA vegetation map)', 'weak'],
  ['tall', 'Tall canopy', 10, 'Average canopy height along the trail and at high-use sites (LANDFIRE forest canopy height), ranked among cells: taller trees catch more wind and reach farther when they fall', 'weak'],
  ['use', 'High-use areas', 10, 'Shelters, campsites, privies, parking areas and vistas (A.T. facilities inventory), ranked among cells. Every scored cell has trail, so this part never drops below half', 'people']];
const WFW = Object.fromEntries(WFDEF.map(d => [d[0], d[2]])), WFD0 = Object.assign({}, WFW), WFRANK = {}, WFCONIF = /spruce|fir\b|fir -|hemlock|pine|cedar|conifer|krumholz/i;
let WFCX = null, WFHX = null;
const wfTypes = (re, cache) => { if (!cache || cache.n !== D.cats.DOM_TYPE.length) cache = {n:D.cats.DOM_TYPE.length, s:new Set(D.cats.DOM_TYPE.map((t, i) => re.test(t) ? i : -1).filter(i => i >= 0))}; return cache; };
const wfShare = (cp, set) => { let s = 0; for (let i = 0; i < cp.length; i += 2) if (set.has(cp[i])) s += cp[i + 1]; return Math.min(1, s / 100); };
const WFFEAT = ['N_SHELTER','N_CAMPSITE','N_PRIVY','N_PARKING','N_VISTA'];
function wfRaw(k, lv, c){ const v = (th, f) => val(th, f, lv, c);
  switch (k){
    case 'expo': return v('topo','TOPO_TPI');
    case 'storm': { const a = v('wx','WX_EV_WIND'), b = v('wx','WX_EV_WINTER'); return a == null && b == null ? null : (a || 0) + (b || 0); }
    case 'fhr': return v('fhr','FHR_TAC') ? v('fhr','FHR_PCT') : null;
    case 'pest': { const r = wfScale('fhr', lv, c), m = v('topo','IDS_MORT'), d = v('topo','IDS_DEF'), cp = v('veg','COMP');
      const dmg = m == null && d == null ? null : Math.min(1, ((m || 0) + .5 * (d || 0)) / 25);
      let hem = null; if (cp){ WFHX = wfTypes(/hemlock/i, WFHX); const sh = wfShare(cp, WFHX.s);
        hem = !sh ? 0 : Math.min(1, 2 * sh * ((invL('PEST_LIST', lv, c) || []).map(i => String(sppName(i).sci || '').toLowerCase()).some(t => /adelges tsugae|fiorinia externa/.test(t)) ? 1 : .4)); }
      const xs = [r, dmg, hem].filter(x => x != null); return xs.length ? Math.max(...xs) : null; }
    case 'tall': return v('topo','CH_MEAN');
    case 'root': { const a = v('soil','SHALLOW_ROCK'), b = v('soil','POOR_DRAIN'), cp = v('veg','COMP');
      const so = a == null && b == null ? null : Math.min(1, ((a || 0) + (b || 0)) / 100); let cf = null; if (cp){ WFCX = wfTypes(WFCONIF, WFCX); cf = wfShare(cp, WFCX.s); }
      return so == null && cf == null ? null : Math.max(so || 0, cf || 0); }
    case 'use': return WFFEAT.reduce((t, f) => t + (v('feat', f) || 0), 0); } }
const wfRanked = k => k === 'storm' || k === 'fhr' || k === 'use' || k === 'tall' || k === 'expo';
/* scored where the trail runs (trail slope build) or there is a high-use site, in forest: the APPA vegetation map decides where it covers the cell, the USFS treed area elsewhere */
function wfGate(lv, c){ if (tvSlopeOn() && !((val('slope','TS_MI',lv,c) || 0) > 0) && !WFFEAT.some(f => (val('feat', f, lv, c) || 0) > 0)) return false; return has('veg', lv, c) ? (val('veg','L1_FOREST',lv,c) || 0) > 0 : (val('fhr','FHR_TAC',lv,c) || 0) > 0; }
/* ranked factors: where the cell stands among scored cells of its size (exposure counts every value, the others only those above 0) */
function wfScale(k, lv, c){ const x = wfRaw(k, lv, c); if (x == null) return null; if (!wfRanked(k)) return Math.max(0, Math.min(1, x)); const all = k === 'expo'; if (!all && !(x > 0)) return 0;
  const key = k + '|' + lv + '|' + S.ext; let R = WFRANK[key]; if (!R || R.lev !== D.levels[lv]){ const a = []; for (let i = 0; i < D.levels[lv].id.length; i++) if (wfGate(lv, i)){ const y = wfRaw(k, lv, i); if (y != null && (all || y > 0)) a.push(y); } R = WFRANK[key] = {lev:D.levels[lv], a:a.sort((p, q) => p - q)}; }
  const a = R.a; if (!a.length) return 0; let lo = 0, hi = a.length; while (lo < hi){ const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid + 1; else hi = mid; } return lo / a.length; }
/* each part is the weighted average of its factors with data. Wind loading and tree weakness are then ranked among scored cells, so each
   part pulls by its weight rather than by how its layers happen to spread; the score multiplies the parts (a geometric mean weighted by
   each part's total weight), so a cell scores high only where wind loading, tree weakness and people at risk are all high */
function wfRawParts(lv, c){
  const parts = WFDEF.map(([k, lab, , , g]) => { const w = +WFW[k] || 0, s = wfScale(k, lv, c); return [k, lab, s == null ? null : w * s, w, g, s]; });
  const pv = {};
  for (const g of Object.keys(WFG)){ const P = parts.filter(p => p[4] === g && p[5] != null && p[3] > 0); const W = P.reduce((t, p) => t + p[3], 0);
    pv[g] = W ? P.reduce((t, p) => t + p[3] * p[5], 0) / W : null; }
  return [pv, parts]; }
const WFPR = {};
function wfPartRank(g, x, lv){ const key = g + '|' + lv + '|' + S.ext + '|' + WFDEF.map(d => WFW[d[0]]).join(','); let R = WFPR[key];
  if (!R || R.lev !== D.levels[lv]){ const a = []; for (let i = 0; i < D.levels[lv].id.length; i++) if (wfGate(lv, i)){ const y = wfRawParts(lv, i)[0][g]; if (y != null) a.push(y); } R = WFPR[key] = {lev:D.levels[lv], a:a.sort((p, q) => p - q)}; }
  const a = R.a; if (!a.length) return x; let lo = 0, hi = a.length; while (lo < hi){ const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid + 1; else hi = mid; } return lo / a.length; }
function wfParts(lv, c){ if (!wfGate(lv, c)) return [null, []];
  const [pv, parts] = wfRawParts(lv, c); let lg = 0, wt = 0;
  for (const g of Object.keys(WFG)){ let v = pv[g]; if (v == null) continue;
    v = g === 'people' ? .5 + .5 * v : wfPartRank(g, v, lv);
    const Wg = WFDEF.filter(d => d[4] === g).reduce((t, d) => t + (+WFW[d[0]] || 0), 0); if (!Wg) continue; lg += Wg * Math.log(Math.max(.02, v)); wt += Wg; }
  return [wt >= 40 ? Math.round(100 * Math.exp(lg / wt)) : null, parts]; }
const wfScore = (lv, c) => wfParts(lv, c)[0];
{ const tq = Q.find(q => q.id === 'tvul'); if (tq){
  tq.m.push({id:'defrel', label:'Trail problem hot spots', hideFn:() => !deficOn(), fn:(lv, c) => val('defic','DF_REL',lv,c), d:1, unit:'×', brkFix:[.5, 1, 2, 4], showFn:v => fmt(v, 1) + '× the rate for its club section', none:'None recorded',
    note:'Where more treadway problems were recorded than on the rest of the same club section: 1 is typical, 2 is twice as many. Many since fixed.'});
  tq.m.push({id:'defrate', label:'Recorded trail problems per mile', hideFn:() => !deficOn(), fn:(lv, c) => val('defic','DF_RATE',lv,c), d:1, showFn:v => fmt(v, 1) + ' a mile', none:'None recorded',
    note:'Treadway problems recorded per mile in the trail assessments. Rates vary by assessor as much as by trail.'}); } }
/* tree fall vulnerability: in "What shape is the forest in?" (TFALLM, added there) */
const TFALLM = {id:'tfall', grp:'Tree fall vulnerability', label:'Tree fall vulnerability', int:1, brkP:[.4,.7,.85,.95], none:'No forest mapped', fn:(lv, c) => wfScore(lv, c), showFn:v => v + ' of 100',
  note:'0 to 100: a screening score for where trees are most likely to come down across the trail and at shelters, campsites, parking and vistas. It multiplies wind loading (topographic exposure, storm history), tree weakness (forest pests and disease, shallow rooting, tall canopy) and people at risk, so it is high only where all three line up. Tree size and form and plot-level storm history are not in it yet; the windfall study\u2019s models will replace it.'};
/* the spread measures for one priority invasive live inside the invasives question; they open from its Priority invasives measure */
{ const inv = Q.find(q => q.id === 'inv'), ph = Q.find(q => q.id === 'phen');
  if (inv && ph) ph.m.filter(m => m.id === 'spread' || m.id === 'share').forEach(m => inv.m.push(Object.create(m, {pinv:{value:true}})));
  const cq = Q.find(x => x.id === 'cult'); if (cq && ph) ph.m.filter(m => m.id === 'wave').forEach(m => cq.m.push(Object.create(m, {cphen:{value:true}}))); }
{ const lq = Q.find(q => q.id === 'land'); if (lq){ const k = lq.m.findIndex(m => m.id === 'acq'); if (k > 0) lq.m.unshift(lq.m.splice(k, 1)[0]); } }
{ const iq = Q.find(q => q.id === 'inv'); if (iq){ const k = iq.m.findIndex(m => m.id === 'edrr'); if (k > 0) iq.m.unshift(iq.m.splice(k, 1)[0]); } }
let JERRY = false;
if (JERRY) document.body.classList.add('jerry');
/* ---------- When are birds migrating here? ----------
   data/birds/index.json lists the species (inputs/bird_migration_species.csv); each species file holds its eBird records as
   [day of year, year, lat, lon], one per checklist; effort.json holds the checklists in each corridor square mile by year and week.
   Values are the share of a cell's checklists that reported the species, so busy trailheads do not outweigh quiet ridges. */
const MIGF = 'data/birds/', MIGMIN = 8, MIGBAND = 30, MIGBR = [2, 5, 10, 20];
/* Casey's palette: spring migration greens, nesting yellows, fall migration oranges (lightest = fewest reports, kept strong enough to read) */
RAMP.mig = ['#05F37F','#05D16D','#04AE5B','#569045','#47783A'];   /* spring migration: green */
RAMP.migf = ['#E97610','#EB670E','#C8650E','#C9580C','#A7490A'];  /* fall migration: orange */
RAMP.mign = ['#FCDD8C','#FBCF4D','#F9BE00','#D6A200','#B28700'];  /* nesting season: yellow */
const MIGSC = '#05D16D', MIGNC = '#F9BE00', MIGFC = '#EB670E';  /* the eBird season bars and the weekly line */
const MIG = {st:'', idx:null, eff:null, sp:{}}, MIGIX = new WeakMap(), MIGE = new WeakMap(), MIGR = new WeakMap();
const MIGS = {sp:'leiothlypis-peregrina', season:'', wk:15, band:-1, auto:true};
let migTimer = null;
/* the weeks the slider and Play cover, and the season each story group opens on */
/* eBird Status and Trends (2023) season dates for each species across its whole range: spring migration, fall migration and breeding
   ('MM-DD/MM-DD'), and whether it nests along the trail (1 = show its nesting bar); blank where
   eBird's expert review did not publish one. data/birds/index.json carries the same dates from the species list once the eBird run
   has them, and those win; these are the fallback. Without a window: spring March–June, fall August–November. */
const MIGEB = {'Catharus bicknelli':['05-10/05-24', '', '05-31/07-26', 1], 'Setophaga striata':['04-12/06-07', '08-09/12-06', '06-14/08-02', 1], 'Catharus ustulatus':['03-15/06-07', '07-19/11-08', '06-14/07-12', 1], 'Contopus cooperi':['03-22/06-14', '07-26/11-08', '06-21/07-19', 1], 'Leiothlypis peregrina':['03-22/05-31', '08-02/11-29', '06-07/07-12', 0], 'Setophaga tigrina':['03-22/05-31', '08-02/11-08', '06-07/07-05', 0], 'Setophaga castanea':['03-29/06-07', '08-02/11-29', '06-14/07-12', 0], 'Buteo platypterus':['02-22/06-07', '08-02/11-22', '06-14/07-26', 1], 'Pandion haliaetus':['02-15/05-17', '08-02/12-20', '05-24/07-26', 1], 'Chordeiles minor':['03-22/06-14', '07-26/11-15', '06-21/07-19', 1], 'Accipiter striatus':['03-15/05-24', '08-30/11-29', '05-31/08-09', 1], 'Falco sparverius':['02-22/05-10', '08-09/11-08', '05-17/08-02', 1], 'Falco columbarius':['03-08/05-24', '08-02/11-29', '05-31/07-26', 0], 'Falco peregrinus':['02-22/05-31', '07-26/11-15', '06-07/07-19', 1], 'Circus hudsonius':['02-22/05-31', '07-12/12-06', '06-07/07-05', 1], 'Aquila chrysaetos':['02-08/05-31', '08-30/11-29', '06-07/08-23', 0], 'Dolichonyx oryzivorus':['04-19/05-31', '08-02/11-08', '06-07/07-26', 1], 'Tyrannus tyrannus':['03-01/05-31', '08-09/11-29', '06-07/08-02', 1], 'Setophaga discolor':['03-22/05-24', '07-12/11-08', '05-31/07-05', 1], 'Hylocichla mustelina':['03-08/05-24', '08-02/11-15', '05-31/07-26', 1], 'Setophaga cerulea':['03-08/05-10', '07-26/10-18', '05-17/07-19', 1], 'Cardellina canadensis':['03-22/06-07', '08-02/11-22', '06-14/07-26', 1], 'Antrostomus vociferus':['02-08/05-17', '', '05-24/07-26', 1], 'Coccyzus erythropthalmus':['03-15/06-07', '08-09/11-01', '06-14/08-02', 1]};
const MIGNOTE = {'High-peak breeders':'These birds nest on the high peaks in spruce-fir, so they show up mainly in the highest cells and arrive later than birds lower down. Blackpoll warblers and Swainson’s thrushes also pass through the whole trail in May and September.',
  'Passing through':'These birds nest north of the trail and are seen here only on the way through.',
  'Fall flights':'Hawk watch sites on the trail report far more hawks, eagles, falcons and nighthawks than the ridges between them, so a few cells stand out.'};
const MIGREG = [['NH · ME', 43.6, 90], ['CT · MA · VT', 41.6, 43.6], ['PA · NJ · NY', 39.72, 41.6], ['VA · WV · MD', 37.3, 39.72], ['GA · NC · TN', -90, 37.3]];
const migSp = () => MIG.idx && MIG.idx.species[MIGS.sp] || null;
/* Spring, Nesting, Fall or Year; Nesting only for birds that nest along the trail */
const migSeason = () => { const s = migSp(), m = MIGS.season === 'nest' && !migWins().breeding ? '' : MIGS.season; return m || 'year'; };
const MIGSEN = {spring:'spring migration', nest:'nesting season', fall:'fall migration', year:'the weeks it is reported'};
const migWkOf = md => { const [m, d] = md.split('-').map(Number); return Math.floor((Date.UTC(2025, m - 1, d) - Date.UTC(2025, 0, 1)) / 6048e5) + 1; };
const migMD = md => new Date(Date.UTC(2025, +md.slice(0, 2) - 1, +md.slice(3, 5))).toLocaleDateString('en-US', {month:'short', day:'numeric', timeZone:'UTC'});
function migWins(){ const s = migSp(), ok = x => typeof x === 'string' && /^\d\d-\d\d\/\d\d-\d\d$/.test(x);
  const w = s && (ok(s.spring) || ok(s.fall) || ok(s.breeding)) ? [s.spring, s.fall, s.breeding, s.nests ? 1 : 0] : s && MIGEB[s.sci] || ['', '', '', 0];
  const br = w[3] && ok(w[2]) ? w[2].split('/') : null;
  const sp = ok(w[0]) ? w[0].split('/') : null, fa = ok(w[1]) ? w[1].split('/') : null;
  return {spring:sp ? sp.map(migWkOf) : [10, 26], fall:fa ? fa.map(migWkOf) : [31, 47], breeding:br ? br.map(migWkOf) : null, txt:{spring:sp && sp.map(migMD).join(' – '), fall:fa && fa.map(migMD).join(' – '), breeding:br && br.map(migMD).join(' – ')}, md:{spring:sp, fall:fa}}; }
/* spring runs from the start of eBird's window to the end of June, so birds settling on the trail after the range-wide window still show */
/* Year: from the first to the last week the species was reported on the trail (weeks with at least MIGYRMIN reports, all years pooled,
   so a single stray winter record doesn't stretch it); eBird's spring-through-fall dates until the records load */
const MIGYRMIN = 3;
function migYear(){ const R = migR('wheel'); if (!R) return null; const n = D.levels.wheel.id.length, t = new Float64Array(53);
  for (let c = 0; c < n; c++) for (let w = 0; w < 53; w++) t[w] += R[c * 53 + w];
  let a = 0, b = 0; for (let w = 0; w < 52; w++) if (t[w] + (w === 51 ? t[52] : 0) >= MIGYRMIN){ if (!a) a = w + 1; b = w + 1; } return a ? [a, b] : null; }
const migRange = () => { const ss = migSeason(), W = migWins(); return ss === 'year' ? (migYear() || [W.spring[0], W.fall[1]]) : ss === 'nest' ? W.breeding : ss === 'spring' ? W.spring : W.fall; };
const migKey = (lv, id) => lv === 'hex' ? id : id.split('-').slice(0, lv === 'cog' ? 4 : 3).join('-');
function migLoad(){ if (MIG.st) return; MIG.st = 'loading';
  const get = f => fetch(MIGF + f + '.json', {cache:'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  Promise.all([get('index'), get('effort')]).then(([i, e]) => { MIG.idx = i; MIG.eff = e.cells || {}; MIG.st = 'done';
      if (!i.species[MIGS.sp]) MIGS.sp = Object.keys(i.species)[0]; MIGS.wk = migRange()[0]; MIGS.auto = true; migSpLoad(); })
    .catch(() => { MIG.st = 'error'; if (S.q.id === 'mig') redraw(); }); }
function migSpLoad(){ const k = MIGS.sp; if (MIG.sp[k]){ if (MIG.sp[k].st === 'done' && MIGS.auto) migAuto(); if (S.q.id === 'mig'){ BRK.clear(); redraw(); } return; } MIG.sp[k] = {st:'loading'};
  fetch(MIGF + k + '.json', {cache:'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { MIG.sp[k] = {st:'done', pts:j.pts || []}; }).catch(() => { MIG.sp[k] = {st:'error'}; })
    .then(() => { if (MIGS.sp !== k) return; if (MIGS.auto && MIG.sp[k].st === 'done') migAuto(); if (S.q.id === 'mig'){ BRK.clear(); redraw(); } }); }
/* the week the map opens on for a species and season: in spring, the first week the whole trail reaches half its spring peak
   (arrival under way in the south); in fall, the fall peak. So nobody lands on an empty map. */
function migAuto(){ MIGS.auto = false; const [a, b] = migRange(), E = migE('wheel'), R = migR('wheel'); MIGS.wk = a; if (!E || !R) return;
  const n = D.levels.wheel.id.length, sh = []; for (let w = 0; w < 52; w++){ let e = 0, r = 0; for (let c = 0; c < n; c++){ e += E[c * 53 + w]; r += R[c * 53 + w]; } sh.push(e >= MIGBAND ? 100 * r / e : null); }
  const mk = migMarks(sh)[0]; if (mk && mk.w >= a && mk.w <= b) MIGS.wk = mk.w; }
function migIx(lv){ const L_ = D.levels[lv]; let m = MIGIX.get(L_); if (!m){ m = new Map(L_.id.map((x, c) => [x, c])); MIGIX.set(L_, m); } return m; }
/* checklists per cell and week (53 weeks), all years pooled, kept per grid */
function migE(lv){ const L_ = D.levels[lv]; if (!L_ || !MIG.eff) return null; let E = MIGE.get(L_); if (E) return E;
  const ix = migIx(lv); E = new Float32Array(L_.id.length * 53);
  for (const id in MIG.eff){ const c = ix.get(migKey(lv, id)); if (c == null) continue; const v = MIG.eff[id]; for (let i = 0; i + 2 < v.length; i += 3) if (v[i + 1] >= 1 && v[i + 1] <= 53) E[c * 53 + v[i + 1] - 1] += v[i + 2]; }
  MIGE.set(L_, E); return E; }
/* the species' checklists per cell and week */
function migR(lv){ const L_ = D.levels[lv], sp = MIG.sp[MIGS.sp]; if (!L_ || !sp || sp.st !== 'done') return null; const o = MIGR.get(L_); if (o && o.k === MIGS.sp) return o.R;
  const R = new Float32Array(L_.id.length * 53), hx = D.levels.hex, ix = migIx(lv);
  for (const p of sp.pts){ const h = phCell('hex', p[2], p[3]); if (h < 0) continue; const c = lv === 'hex' ? h : ix.get(migKey(lv, hx.id[h])); if (c == null) continue;
    R[c * 53 + Math.min(52, Math.floor((p[0] - 1) / 7))] += 1; }
  MIGR.set(L_, {k:MIGS.sp, R}); return R; }
/* share (%) of a cell's checklists in the three weeks around wk that reported the species; null with fewer than MIGMIN checklists */
function migShare(lv, c, wk){ const E = migE(lv), R = migR(lv); if (!E || !R) return null; let e = 0, r = 0;
  for (let w = wk - 1; w <= wk + 1; w++){ if (w < 1 || w > 53) continue; e += E[c * 53 + w - 1]; r += R[c * 53 + w - 1]; }
  return e >= MIGMIN ? 100 * r / e : null; }
/* the week in the season with the highest share; 0 = not reported that season */
/* map and calendar colors follow the species' eBird seasons: green for spring migration, yellow for nesting, orange for fall migration */
/* which eBird season a week falls in for this species: 's' spring migration, 'n' nesting (birds that nest on the trail), 'f' fall migration.
   Weeks outside eBird's windows take the nearer season; before spring is spring, after fall is fall. */
function migPhase(w){ const W = migWins(), inn = r => r && w >= r[0] && w <= r[1];
  if (inn(W.breeding)) return 'n'; if (inn(W.fall)) return 'f'; if (inn(W.spring)) return 's';
  if (w < W.spring[0]) return 's'; if (w > W.fall[1]) return 'f'; return (w - W.spring[1]) <= (W.fall[0] - w) ? 's' : 'f'; }
const migRamp = ph => { ph = ph || migPhase(MIGS.wk); return ph === 'n' ? RAMP.mign : ph === 'f' ? RAMP.migf : RAMP.mig; };
const migCol = (v, ph) => { if (v == null) return null; if (v === 0) return ZERO; const i = MIGBR.findIndex(b => v < b); return migRamp(ph === 's' || ph === 'n' || ph === 'f' ? ph : null)[i < 0 ? 4 : i]; };
const migNote = () => { const s = migSp(); return s && MIGNOTE[s.story] ? `<p class="sub">${esc(MIGNOTE[s.story])}</p>` : ''; };
const migRow = (c, t) => c ? `<div class="row"><i style="background:${c}"></i><span>${t}</span></div>` : `<div class="row"><i class="hollow"></i><span>${t}</span></div>`;
function migLegShare(){ const R_ = migRamp(); return migRow(null, 'None reported') + migRow(R_[0], 'under 2%') + migRow(R_[1], '2 to 5%') + migRow(R_[2], '5 to 10%') + migRow(R_[3], '10 to 20%') + migRow(R_[4], '20% or more') +
  `<p class="sub">Share of eBird checklists in these weeks that reported it, ${esc(wkLabel(MIGS.wk))} and the week either side, all years since ${MIG.idx ? MIG.idx.from : 2010}.</p>` + migNote(); }
const migWkText = () => `${wkLabel(MIGS.wk)} · all years since ${MIG.idx ? MIG.idx.from : 2010}`;
function migBlock(){ migLoad();
  if (MIG.st === 'error') return '<div class="phctl"><p class="phstat">The bird migration records could not be loaded. They are written by the January eBird run.</p></div>';
  if (!MIG.idx) return '<div class="phctl"><p class="phstat">Loading the bird migration records…</p></div>';
  const L = Object.entries(MIG.idx.species), grp = [...new Set(L.map(e => e[1].story))], ss = migSeason(), [a, b] = migRange();
  if (MIGS.wk < a || MIGS.wk > b) MIGS.wk = a;
  let h = '<div class="phctl"><select id="migsp" aria-label="Species">' + grp.map(g => `<optgroup label="${esc(g)}">` + L.filter(e => e[1].story === g).map(([k, s]) => `<option value="${k}"${k === MIGS.sp ? ' selected' : ''}>${esc(s.common)} (${esc(s.sci)}) · ${fmt(s.n, 0)} records</option>`).join('') + '</optgroup>').join('') + '</select>';
  h += '<div class="chips" role="group" aria-label="Season">' + ['spring', 'nest', 'fall', 'year'].filter(x => x !== 'nest' || migWins().breeding).map(x => `<button type="button" data-migse="${x}" aria-pressed="${x === ss}">${{spring:'Spring', nest:'Nesting', fall:'Fall', year:'Year'}[x]}</button>`).join('') + '</div>';
  { const Wn = migWins(), yr = migYear(); if (ss === 'year') h += `<p class="phstat">${yr ? `Reported on the trail ${esc(wkDate(yr[0]))} – ${esc(String(wkLabel(Math.min(52, yr[1]))).split(' – ').pop())}${yr[0] === 1 && yr[1] >= 52 ? ' (all year)' : ''}: from the first to the last week with at least ${MIGYRMIN} reports, all years since ${MIG.idx ? MIG.idx.from : 2010}.` : 'Loading the records…'}</p>`; else { const k = ss === 'nest' ? 'breeding' : ss; h += `<p class="phstat">${Wn.txt[k] ? `eBird ${MIGSEN[ss]} for this species: ${esc(Wn.txt[k])} (whole range).` : `eBird has not published ${MIGSEN[ss]} dates for this species; showing ${ss === 'fall' ? 'August to November' : 'March to June'}.`}</p>`; } }
  if (S.m.id === 'migwk') h += `<div class="wk"><button type="button" id="migplay">${migTimer ? 'Pause' : 'Play'}</button><input type="range" id="migwk" min="${a}" max="${b}" step="1" value="${MIGS.wk}" aria-label="Week of the year"${ss === 'year' ? '' : ` style="accent-color:${{spring:MIGSC, nest:MIGNC, fall:MIGFC}[ss]}"`}></div><div class="wkl" id="migwkl">${esc(migWkText())}</div>`;
  const st = MIG.sp[MIGS.sp]; if (!st || st.st === 'loading') h += '<p class="phstat">Loading this species’ records…</p>'; else if (st.st === 'error') h += '<p class="phstat">This species’ records could not be loaded.</p>';
  return h + '</div>'; }
function migCtl(){ const r = $('#migwk'), l = $('#migwkl'), b = $('#migplay'); if (r) r.value = MIGS.wk; if (l) l.textContent = migWkText(); if (b) b.textContent = migTimer ? 'Pause' : 'Play'; }
function migFrame(){ BRK.clear(); restyle(); strip(); legend(); migCtl(); qVizRefresh(); }
function migPlay(on){ if (migTimer){ clearInterval(migTimer); migTimer = null; }
  if (on){ const [a, b] = migRange(); if (MIGS.wk >= b) MIGS.wk = a; migFrame();
    migTimer = setInterval(() => { if (S.q.id !== 'mig' || S.m.id !== 'migwk'){ migPlay(false); return; } const [a, b] = migRange(); MIGS.wk = MIGS.wk >= b ? a : MIGS.wk + 1; migFrame(); }, 650); }
  migCtl(); }
function migWire(){ migCard(); const s = $('#migsp'); if (!s) return;
  s.onchange = () => keepPlace(s, ['#migsp'], () => { migPlay(false); MIGS.sp = s.value; MIGS.season = ''; MIGS.wk = migRange()[0]; MIGS.auto = true; migSpLoad(); BRK.clear(); redraw(); });
  document.querySelectorAll('[data-migse]').forEach(x => x.onclick = () => { migPlay(false); MIGS.season = x.dataset.migse; MIGS.wk = migRange()[0]; MIGS.auto = true; migSpLoad(); });
  const r = $('#migwk'); if (r){ r.oninput = () => { MIGS.wk = +r.value; migFrame(); }; r.onchange = () => redraw(); }
  const b = $('#migplay'); if (b) b.onclick = () => { migPlay(!migTimer); if (!migTimer) redraw(); }; }
/* the red mark on a region's row: spring, the first week at half its spring peak; fall, its fall peak */
const migPk = (sh, a, b) => { let pk = 0, pw = 0; for (let w = a; w <= b; w++){ const v = sh[w - 1]; if (v != null && v > pk){ pk = v; pw = w; } } return [pk, pw]; };
/* arrival: from the start of eBird's spring window to the end of June, the first week reports reach half their spring peak */
function migArr(sh, a){ const [pk, pw] = migPk(sh, a, 26); if (pk < 1) return null; for (let w = a; w <= pw; w++){ const v = sh[w - 1]; if (v != null && v >= pk / 2) return {w, pk, fall:false}; } return {w:pw, pk, fall:false}; }
/* fall peak: only where reports rise again inside eBird's fall window (hawks, passing-through warblers); birds that nest here just go
   quiet after nesting, which is not departure, so they get no fall mark */
function migFallPk(sh, a, b){ const [pk, pw] = migPk(sh, a, b); if (pk < 1 || pw < a + 2) return null;
  const st = [sh[a - 1], sh[a]].filter(v => v != null), s0 = st.length ? st.reduce((x, y) => x + y, 0) / st.length : 0;
  return pk >= 1.25 * s0 ? {w:pw, pk, fall:true} : null; }
/* the red marks: spring arrival and, where there is one, a fall peak; Year shows both */
function migMarks(sh){ const ss = migSeason(), W = migWins(), out = [];
  if (ss === 'nest') return out; if (ss !== 'fall') out.push(migArr(sh, W.spring[0])); if (ss !== 'spring') out.push(migFallPk(sh, W.fall[0], W.fall[1]));
  return out.filter(Boolean); }
function migCal(lv, cells){ const E = migE(lv), R = migR(lv); if (!E || !R || !cells.length) return '';
  const L_ = D.levels[lv], rows = MIGREG.map((r, i) => ({n:r[0], i, e:new Float64Array(53), r:new Float64Array(53)}));
  cells.forEach(c => { const la = L_.c[c][0], o = rows[MIGREG.findIndex(r => la >= r[1] && la < r[2])]; if (!o) return; for (let w = 0; w < 53; w++){ o.e[w] += E[c * 53 + w]; o.r[w] += R[c * 53 + w]; } });
  const rs = rows.filter(o => o.e.some(x => x >= MIGBAND)); if (!rs.length) return '';
  const [a, b] = migRange(), W = 340, lw = 76, cw = (W - lw - 2) / 52, rh = 19, top = 26, H = top + rs.length * rh, Wn = migWins();
  rs.forEach(o => { o.sh = Array.from({length:52}, (_, w) => o.e[w] >= MIGBAND ? 100 * o.r[w] / o.e[w] : null); });
  let g = `<svg class="migcal" viewBox="0 0 ${W} ${H + 2}" role="img" aria-label="Migration calendar by region">`;
  'JFMAMJJASOND'.split('').forEach((t, i) => { g += `<text x="${lw + Math.round((new Date(2021, i, 1) - new Date(2021, 0, 1)) / 6048e5) * cw}" y="10" class="mct">${t}</text>`; });
  /* eBird's recognized migration windows for the species, above the regions */
  g += `<text x="${lw - 5}" y="21" text-anchor="end" class="mct">eBird</text>`;
  [['spring', MIGSC, 'spring migration'], ['breeding', MIGNC, 'nesting season'], ['fall', MIGFC, 'fall migration']].forEach(([k, c, t]) => { if (!Wn.txt[k]) return; const [w0, w1] = Wn[k];
    g += `<rect x="${(lw + (w0 - 1) * cw).toFixed(1)}" y="15" width="${((w1 - w0 + 1) * cw).toFixed(1)}" height="6" rx="2" fill="${c}"><title>eBird ${t}: ${esc(Wn.txt[k])}</title></rect>`; });
  rs.forEach((o, j) => { const y = top + j * rh;
    g += `<g class="migrow${MIGS.band === o.i ? ' on' : ''}" data-migband="${o.i}" tabindex="0" role="button" aria-label="${esc(o.n)}: show its weekly line"><text x="${lw - 5}" y="${y + rh / 2 + 4}" text-anchor="end" class="mrl">${esc(o.n)}</text><rect x="${lw}" y="${y + 1}" width="${(52 * cw).toFixed(1)}" height="${rh - 2}" fill="none" stroke="#2E405A" stroke-width="1"/>`;
    o.sh.forEach((v, w) => { if (v === 0) return; if (v == null){ g += `<rect x="${(lw + w * cw).toFixed(1)}" y="${y + 1}" width="${(cw + .3).toFixed(1)}" height="${rh - 2}" fill="#3A4C66"><title>${esc(o.n)}, week of ${esc(wkDate(w + 1))}: fewer than ${MIGBAND} checklists</title></rect>`; return; } g += `<rect x="${(lw + w * cw).toFixed(1)}" y="${y + 1}" width="${(cw + .3).toFixed(1)}" height="${rh - 2}" fill="${migCol(v, migPhase(w + 1))}"><title>${esc(o.n)}, week of ${esc(wkDate(w + 1))}: ${fmt(v, v < 10 ? 1 : 0)}% of ${fmt(o.e[w], 0)} checklists</title></rect>`; });
    g += '</g>'; });
  g += `<rect x="${(lw + (MIGS.wk - 1) * cw).toFixed(1)}" y="${top - 1}" width="${cw.toFixed(1)}" height="${rs.length * rh + 2}" fill="none" stroke="#FFFFFF" stroke-width="1.2"/></svg>`;
  const sel = rs.find(o => o.i === MIGS.band);
  if (sel){ const lh = 96, mx = Math.max(5, ...sel.sh.filter(v => v != null)), X = w => lw + (w - .5) * cw, Y = v => 8 + (lh - 22) * (1 - v / mx);
    /* line pieces, broken where a week has too few checklists and where the eBird season changes (green, yellow, orange) */
    const path = []; let cur = null; sel.sh.forEach((v, w) => { const f = migPhase(w + 1); if (v == null || (cur && cur.f !== f)){ if (cur && cur.p.length) path.push(cur); cur = null; } if (v == null) return; if (!cur) cur = {f, p:[]}; cur.p.push(X(w + 1).toFixed(1) + ' ' + Y(v).toFixed(1)); }); if (cur && cur.p.length) path.push(cur);
    g += `<h4 class="phh">${esc(sel.n)}: share of checklists by week</h4><svg class="migcal" viewBox="0 0 ${W} ${lh}" role="img" aria-label="${esc(sel.n)} weekly share"><line x1="${lw}" x2="${lw + 52 * cw}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3A4C66" stroke-width="1"/>` +
      `<rect x="${X(a) - cw / 2}" y="4" width="${(b - a + 1) * cw}" height="${lh - 14}" fill="#1F3049"/>` +
      `<text x="${lw - 5}" y="${Y(mx) + 4}" text-anchor="end" class="mct">${fmt(mx, 0)}%</text><text x="${lw - 5}" y="${Y(0) + 4}" text-anchor="end" class="mct">0</text>` +
      path.map(s => `<path d="M${s.p.join(' L')}" fill="none" stroke="${s.f === 'n' ? MIGNC : s.f === 'f' ? MIGFC : MIGSC}" stroke-width="2" stroke-linejoin="round"/>`).join('') +
      `<line x1="${X(MIGS.wk)}" x2="${X(MIGS.wk)}" y1="4" y2="${lh - 10}" stroke="#DDE6F0" stroke-width="1" stroke-dasharray="2 2"/>` +
      'JFMAMJJASOND'.split('').map((t, i) => `<text x="${lw + Math.round((new Date(2021, i, 1) - new Date(2021, 0, 1)) / 6048e5) * cw}" y="${lh}" class="mct">${t}</text>`).join('') + '</svg>'; }
  return g; }
document.addEventListener('click', e => { const r = e.target.closest('[data-migband]'); if (!r) return; const i = +r.dataset.migband; MIGS.band = MIGS.band === i ? -1 : i; qVizRefresh(); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const r = e.target.closest && e.target.closest('[data-migband]'); if (!r) return; e.preventDefault(); r.click(); });
/* bird profiles: photo credit and license, winter range, miles (mid-trail to the middle of the winter range; Golden Eagle from its
   nesting grounds), conservation tags (BCC: USFWS Birds of Conservation Concern 2021; PIF: Partners in Flight priority in a trail
   Bird Conservation Region), a line about the bird on the trail, and its All About Birds page. ph:0 = no photo yet. */
const MIGPRO = {
  'catharus-bicknelli':{ph:0, win:'Mid- and high-elevation forest in the Greater Antilles, mostly Hispaniola', mi:1500, tags:['BCC', 'PIF'], aab:'Bicknells_Thrush',
    note:'About 37% of U.S. Bicknell’s thrushes nest within a mile of the A.T., in stunted spruce-fir mostly above 2,600 feet.'},
  'setophaga-striata':{cr:'Donna Dewhurst / USFWS', win:'Northern South America, mostly the Amazon basin', mi:3100, tags:[], aab:'Blackpoll_Warbler',
    note:'Nests in spruce-fir on the northern high peaks; in fall many fly nonstop over the Atlantic to South America.'},
  'catharus-ustulatus':{cr:'USGS Bird Banding Laboratory', win:'Andes foothills of northern South America', mi:2900, tags:[], aab:'Swainsons_Thrush',
    note:'Its rising, spiraling song comes from the northern spruce-fir; elsewhere it passes through in May and September, calling overhead at night.'},
  'contopus-cooperi':{ph:0, win:'Andes of northern South America', mi:2900, tags:['BCC', 'PIF'], aab:'Olive-sided_Flycatcher',
    note:'Calls “quick, three beers” from dead snags at the edges of high-elevation conifer forest and burns.'},
  'leiothlypis-peregrina':{cr:'USFWS', win:'Southern Mexico to northern South America', mi:2100, tags:[], aab:'Tennessee_Warbler',
    note:'Nests in Canada’s boreal forest; on the trail it is a spring and fall visitor, usually high in the canopy.'},
  'setophaga-tigrina':{cr:'USGS Bird Banding Laboratory', win:'The Caribbean islands', mi:1400, tags:['BCCn', 'PIF'], aab:'Cape_May_Warbler',
    note:'Follows spruce budworm outbreaks in the boreal north; on the trail it is seen in migration, most in mid-September.'},
  'setophaga-castanea':{cr:'NPS / G. Etter', win:'Panama to northern Colombia and Venezuela', mi:2200, tags:['BCCn', 'PIF'], aab:'Bay-breasted_Warbler',
    note:'Another spruce budworm specialist; it passes the trail in late May and again in September.'},
  'buteo-platypterus':{cr:'USFWS', win:'Central America to Bolivia and Brazil', mi:3200, tags:['PIF'], aab:'Broad-winged_Hawk',
    note:'Rides thermals along the ridges; mid-September kettles at trail-side hawk watches can number in the thousands.'},
  'pandion-haliaetus':{pos:'50% 20%', cr:'Becky Harrison / USFWS', win:'The Caribbean and northern South America', mi:2500, tags:[], aab:'Osprey',
    note:'Follows rivers and ridgelines south; the hawk watches count steady flights through September.'},
  'chordeiles-minor':{cr:'Dave Menke / USFWS', win:'South America east of the Andes', mi:4100, tags:['BCCa', 'PIF'], aab:'Common_Nighthawk',
    note:'Loose flocks stream over the ridges at dusk in late August and early September.'},
  'accipiter-striatus':{cr:'USDA Forest Service (CC BY)', win:'Southern United States to Central America', mi:1100, tags:[], aab:'Sharp-shinned_Hawk',
    note:'One of the most-counted hawks at the ridge hawk watches, peaking in mid-September and continuing into October.'},
  'falco-sparverius':{cr:'James “Newt” Perdue / USFWS', win:'Southern United States and Mexico; some stay year-round', mi:800, tags:['PIF'], aab:'American_Kestrel',
    note:'Hunts open fields and grassy balds; fall flights pass the hawk watches in September.'},
  'falco-columbarius':{cr:'Lee Karney / USFWS', win:'Southern United States, the Caribbean and northern South America', mi:1400, tags:[], aab:'Merlin',
    note:'A fast, dark falcon that passes the ridges from mid-September into October.'},
  'falco-peregrinus':{pos:'50% 12%', cr:'Jo Keller / USFWS', win:'Coastal United States to South America', mi:3200, tags:['PIF'], aab:'Peregrine_Falcon',
    note:'Arctic-nesting peregrines pass the ridges from mid-September into October; a few pairs again nest on cliffs near the trail.'},
  'circus-hudsonius':{cr:'Lucas Sarwas / USFWS', win:'Southern United States to Central America', mi:1000, tags:['PIF'], aab:'Northern_Harrier',
    note:'Glides low over fields and balds with its wings in a shallow V; migrates along the ridges from September into November.'},
  'aquila-chrysaetos':{cr:'Dave Menke / USFWS', win:'The central and southern Appalachians', mi:1100, from:'nesting grounds in Quebec and Labrador', tags:[], aab:'Golden_Eagle',
    note:'The small eastern population rides ridge updrafts south in late October and November and winters along the Appalachians.'},
  'dolichonyx-oryzivorus':{cr:'Grayson Smith / USFWS', win:'Grasslands of southern South America', mi:4400, tags:['BCC', 'PIF'], aab:'Bobolink',
    note:'Nests in hayfields along the trail, where late mowing lets its young fledge; fall flocks gather before the long flight south.'},
  'tyrannus-tyrannus':{cr:'Steve Arena / USFWS (CC BY)', win:'The western Amazon basin', mi:3300, tags:['PIF'], aab:'Eastern_Kingbird',
    note:'Perches on fence lines and snags over A.T. fields and wetlands, chasing off birds many times its size.'},
  'setophaga-discolor':{cr:'Steve Maslowski / USFWS', win:'Florida and the Caribbean', mi:1300, tags:['BCC', 'PIF'], aab:'Prairie_Warbler',
    note:'Despite its name, a bird of young shrubby growth: old fields, clearcuts and utility rights-of-way along the trail.'},
  'hylocichla-mustelina':{cr:'Michael Schramm / USFWS', win:'Lowland tropical forest, southern Mexico to Panama', mi:1900, tags:['BCC', 'PIF'], aab:'Wood_Thrush',
    note:'Its flute-like evening song carries through mature hardwood forest along the trail; it nests low in the shaded understory.'},
  'setophaga-cerulea':{cr:'Mikey Lutmerding / USGS', win:'Andes slopes, Venezuela to Peru', mi:3000, tags:['BCC', 'PIF'], aab:'Cerulean_Warbler',
    note:'Nests high in the canopy of mature hardwoods on ridges and slopes; the central Appalachians hold much of its population.'},
  'cardellina-canadensis':{cr:'Ryan Hagerty / USFWS', win:'Andes of northern South America', mi:2600, tags:['BCC', 'PIF'], aab:'Canada_Warbler',
    note:'Nests on or near the ground in moist, shrubby mountain forest, including rhododendron thickets.'},
  'antrostomus-vociferus':{ph:0, win:'Gulf Coast to Central America', mi:1500, tags:['BCC', 'PIF'], aab:'Eastern_Whip-poor-will',
    note:'Heard far more than seen: it calls its name on moonlit nights from open woods near fields and clearings.'},
  'coccyzus-erythropthalmus':{cr:'USGS Bird Banding Laboratory', win:'Northwestern South America', mi:2800, tags:['BCC', 'PIF'], aab:'Black-billed_Cuckoo',
    note:'Eats hairy caterpillars that other birds avoid, including spongy moth and tent caterpillars; more turn up in outbreak years.'}};
const MIGTAG = {BCC:'Bird of Conservation Concern', BCCn:'Bird of Conservation Concern, northern New England', BCCa:'Bird of Conservation Concern, Appalachian Mountains', PIF:'Partners in Flight priority'};
const MIGSIL = '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M6 26c8-1 13-5 18-11 3-4 7-6 11-5l4-3 1 4c5 2 8 6 9 10l9 3-9 1c-3 4-9 7-17 7-8 0-15-2-26-6z" fill="#3A4C66"/></svg>';
let MIGCR = null;
fetch('images/birds/credits.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j){ MIGCR = j; const c = document.getElementById('migcard'); if (c){ c.dataset.k = ''; migCard(); } } }).catch(() => {});
let migCardOn = (() => { try { return store.get('migcard', true); } catch (e) { return true; } })();
/* share of trail checklists reporting the species at its busiest week, trail-wide, all years */
function migPeakAll(){ const E = migE('wheel'), R = migR('wheel'); if (!E || !R) return null; const n = D.levels.wheel.id.length; let best = 0, bw = 0;
  for (let w = 0; w < 52; w++){ let e = 0, r = 0; for (let c = 0; c < n; c++){ e += E[c * 53 + w]; r += R[c * 53 + w]; } if (e >= MIGBAND && r / e > best){ best = r / e; bw = w + 1; } }
  return best ? [100 * best, bw] : null; }
function migCardHTML(){ const k = MIGS.sp, s = migSp(), p = MIGPRO[k]; if (!s || !p) return '';
  const W = migWins(), pk = migPeakAll(), seg = (w, c, t) => w ? `<i style="left:${((w[0] - 1) / 52 * 100).toFixed(2)}%;width:${((w[1] - w[0] + 1) / 52 * 100).toFixed(2)}%;background:${c}" title="${t}"></i>` : '';
  /* images/birds/credits.json (written by the bird photos workflow) says which photos exist and whose they are */
  const c = MIGCR ? MIGCR[k] : (p.ph === 0 ? null : {cr:p.cr, lic:'', page:''}), lic = c && c.lic && c.lic !== 'Public domain' ? ` (${c.lic})` : '';
  const ph = !c ? `<div class="mcph none">${MIGSIL}<span>Photo wanted</span></div>`
    : `<div class="mcph"><img class="mcbg" src="images/birds/${k}.webp" alt="" aria-hidden="true"><img class="mcim" src="images/birds/${k}.webp" alt="" loading="lazy" onerror="this.parentNode.classList.add('none');this.outerHTML='${MIGSIL.replace(/"/g, '&quot;')}'">${c.page && /^https:/.test(c.page) ? `<a class="mccr" href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.cr + lic)}</a>` : `<span class="mccr">${esc(c.cr + lic)}</span>`}</div>`;
  return ph + `<button type="button" class="mcx" aria-label="Hide bird profile">×</button><div class="mcbd"><p class="mcnm">${esc(s.common)}</p><div class="mcsci">${esc(s.sci)}</div><span class="mcgrp">${esc(s.story)}</span>
    <div class="mcbar" role="img" aria-label="eBird seasons">${seg(W.txt.spring && W.spring, MIGSC, 'Spring migration')}${seg(W.txt.breeding && W.breeding, MIGNC, 'Nesting season')}${seg(W.txt.fall && W.fall, MIGFC, 'Fall migration')}</div>
    <dl><dt>Seasons</dt><dd>${[W.txt.spring && `<b class="sp">Spring</b> ${esc(W.txt.spring)}`, W.txt.breeding && `<b class="ns">nesting</b> ${esc(W.txt.breeding)}`, W.txt.fall && `<b class="fa">fall</b> ${esc(W.txt.fall)}`].filter(Boolean).join(' · ')} <span class="mcsrc">(eBird)</span></dd>
    <dt>Winters</dt><dd>${esc(p.win)}</dd><dt>Travels</dt><dd>About ${fmt(p.mi, 0)} miles ${p.from ? 'from ' + esc(p.from) : 'from mid-trail to its winter range'}</dd>
    ${pk ? `<dt>On the A.T.</dt><dd>On ${fmt(pk[0], 0)}% of trail checklists at its peak, the week of ${esc(wkDate(pk[1]))}</dd>` : ''}</dl>
    ${p.tags.length ? '<div class="mctags">' + p.tags.map(t => `<span${t.startsWith('BCC') ? ' class="w"' : ''}>${MIGTAG[t]}</span>`).join('') + '</div>' : ''}
    <p class="mcnote">${esc(p.note)}</p><a class="mcmore" href="https://www.allaboutbirds.org/guide/${p.aab}/" target="_blank" rel="noopener">More about this bird ›</a></div>`; }
function migCard(){ let c = $('#migcard'), b = $('#migcardbtn'); const on = S.q && S.q.id === 'mig' && migSp() && MIG.sp[MIGS.sp] && MIG.sp[MIGS.sp].st === 'done';
  if (!on){ if (c) c.remove(); if (b) b.remove(); return; }
  const host = isPhone() ? $('#side .qsec[data-sec=charts]') : $('#mapwrap'); if (!host) return;
  if (!c){ c = document.createElement('aside'); c.id = 'migcard'; c.className = 'migcard'; c.setAttribute('aria-label', 'Bird profile'); }
  if (!b){ b = document.createElement('button'); b.id = 'migcardbtn'; b.type = 'button'; b.className = 'migcardbtn'; b.textContent = 'Bird profile'; b.onclick = () => { migCardOn = true; try { store.set('migcard', true); } catch (e) {} migCard(); }; }
  if (c.parentNode !== host) host.insertBefore(c, null); if (b.parentNode !== host) host.insertBefore(b, null);
  c.classList.toggle('mob', isPhone()); b.classList.toggle('mob', isPhone());
  if (c.dataset.k !== MIGS.sp + '|' + migSeason()){ c.innerHTML = migCardHTML(); c.dataset.k = MIGS.sp + '|' + migSeason(); const x = c.querySelector('.mcx'); if (x) x.onclick = () => { migCardOn = false; try { store.set('migcard', false); } catch (e) {} migCard(); }; }
  c.hidden = !migCardOn; b.hidden = migCardOn; }
QVIZ.mig = {title:'Migration calendar', note:'How often birders reported this species each week, by region, all years since 2010. Colors follow eBird’s dates for this species: spring migration (green), nesting season (yellow, for birds that nest along the trail) and fall migration (orange); the bars on top show those dates. Gray: too few checklists. Click a region for its weekly line.',
  html:(sl, cells) => migCal(sl, cells)};
Q.push({id:'mig', th:'ebird', hue:HUE.mig, ramp:'mig', title:'When are birds migrating here?',
  use:'When 24 migratory birds arrive, pass through and leave along the trail, from eBird checklists since 2010, updated each January. Migration, week by week: each cell shows the share of checklists in the three weeks around the date that reported the species, so Play shows birds moving up the trail in spring and down it in fall. Visualizations add a migration calendar by region, Georgia to Maine. Share of checklists, not counts, so busy trailheads don’t outweigh quiet ridges; a missing cell means too few checklists that week, not absence.',
  m:[{id:'migwk', label:'Migration, week by week', unit:'%', d:1, fn:(lv, c) => migShare(lv, c, MIGS.wk), colorFn:migCol, legendFn:migLegShare, stripTop:() => 30, zeroClear:1, nullHide:1,
      showFn:v => v === 0 ? 'none reported these weeks' : `${fmt(v, v < 10 ? 1 : 0)}% of checklists`, none:`Not drawn: fewer than ${MIGMIN} checklists in these weeks`}]});
/* invasive plants open on the year-by-year animation (Japanese barberry until another species is picked) */
{ const q = Q.find(x => x.id === 'inv'), i = q ? q.m.findIndex(m => m.pinv) : -1; if (i > 0) q.m.unshift(q.m.splice(i, 1)[0]); }
/* "Where is the trail most at risk?" opens on the sustainability rating (TSA) */
{ const q = Q.find(x => x.id === 'tvul'), i = q ? q.m.findIndex(m => m.id === 'tsr') : -1; if (i > 0) q.m.unshift(q.m.splice(i, 1)[0]); }
/* ---------- NASA Earthdata layers: canopy loss (OPERA), forest height and biomass (GEDI), green-up and leaf-off (MODIS), climate change since 1980 (Daymet) ----------
   Built on GitHub (build_canopy_loss.py, build_forest_structure.py, build_green_up.py, build_climate_change.py): cells matched by grid ID */
HUE.fcond = '#2C6E6A';
RAMP.fcond = ['#F7E9D4','#EDC28F','#DB8F55','#B85A2C','#7A2E14'];
RAMP.tall = ['#E4EFD9','#B7D79A','#7FB765','#46903F','#1E5E2A'];
RAMP.doy = ['#1E6B3A','#5E9E4F','#B4CF7A','#E6D58E','#C9974E'];
const DIVRAMP = ['#2F64A0','#9DBCE0','#ECE7D8','#F3B37E','#B13B2C'];
const NASAF = [['dist','canopy_loss','Canopy loss'],['gedi','forest_structure','Forest height and biomass'],['lsp','green_up','Green-up and leaf-off'],['dym','climate_change','Climate change since 1980']];
const NASA = {}, NASAMETA = {};
NASAF.forEach(([th, f]) => fetch('data/' + f + '.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ NASA[th] = j; NASAMETA[th] = j.meta || {}; if (S.ext === 'corr'){ nasaApply(); BRK.clear(); redraw(); if (typeof side === 'function') side(); } } }).catch(() => {}));
function nasaApply(){ let any = false; for (const th in NASA){ const j = NASA[th]; if (j.done || S.ext !== 'corr') continue; j.done = true; D.themes[th] = thConv(j, th, D.levels); any = true; } if (any) extIndex(); }
const nasaHas = th => !!(D.themes[th] && Object.keys(D.themes[th]).length);
const nasaNot = th => { const e = NASAF.find(x => x[0] === th); return `Not built yet: added after the "${e ? e[2] : ''}" workflow runs`; };
/* a value as stored, where -1 is a real number (changes can be -1), not "no data" */
function rawv(th, f, lv, c){ const t = D.themes[th] && D.themes[th][lv]; if (!t) return null; const R = ROW[th] && ROW[th][lv], r = R ? R[c] : -1; if (!(r >= 0)) return null; const a = t.f[f]; if (!a) return null; const x = a[r]; return x == null ? null : x; }
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dlMonName = m => m == null ? '' : `${MON3[m % 12]} ${2021 + Math.floor(m / 12)}`;
const doyName = d => { if (d == null) return '–'; const t = new Date(Date.UTC(2023, 0, 1) + (Math.round(d) - 1) * 864e5); return `${MON3[t.getUTCMonth()]} ${t.getUTCDate()}`; };
const ftOf = m => m * 3.28084, tpaOf = mgha => mgha * 0.44609;
/* the years a GEDI file covers, from its name: GEDI03_..._2019108_2025190_... (year and day) or GEDI04_B_MW019MW223_... (mission weeks from 18 April 2019) */
function gediYrs(k){ const f = ((NASAMETA.gedi || {}).files || {})[k] || ''; let m = f.match(/_(\d{4})\d{3}_(\d{4})\d{3}_/); if (m) return m[1] === m[2] ? m[1] : `${m[1]} to ${m[2]}`;
  m = f.match(/MW(\d{3})MW(\d{3})/); if (m){ const y = w => new Date(Date.UTC(2019, 3, 18) + (+w - 19) * 7 * 864e5).getUTCFullYear(); return `${y(m[1])} to ${y(m[2])}`; } return 'since 2019'; }
const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);

/* canopy loss: the whole record, or through the month shown while Play runs (S.dlMon) */
const dlM = (lv, c) => val('dist','DL_M',lv,c);
function dlCum(lv, c, upto){ const a = dlM(lv, c); if (!a) return 0; let s = 0; for (let i = 0; i < a.length; i += 2) if (a[i] <= upto) s += a[i + 1] / 10; return s; }
function dlRange(){ const m = NASAMETA.dist || {}; return m.m0 != null && m.m1 != null ? [m.m0, m.m1] : null; }
const dlSince = () => { const r = dlRange(); return r ? dlMonName(r[0]) : ''; };
/* classes from the whole record, kept while Play runs, so the map fills in */
function dlBrk(f, lv){ const key = 'dl' + f + lv + S.ext; if (BRK.has(key)) return BRK.get(key); const n = D.levels[lv].id.length, a = [];
  for (let c = 0; c < n; c++){ const v = val('dist', f, lv, c); if (v != null && v > 0) a.push(v); } a.sort((x, y) => x - y);
  const q = p => a[Math.min(a.length - 1, Math.floor(p * a.length))], d = f === 'DL_PCT' ? 2 : 0;
  let b = a.length ? [.5, .75, .9, .97].map(p => +niceNum(q(p)).toFixed(d)) : []; b = b.filter((v, i) => v > 0 && (i === 0 || v > b[i - 1]));
  const out = {b, cols:b.length ? Array.from({length:b.length + 1}, (_, i) => RAMP.fcond[Math.round(i * 4 / b.length)]) : [RAMP.fcond[3]]}; BRK.set(key, out); return out; }
function dlCol(f, v, lv){ if (v == null) return null; if (v === 0) return ZERO; const B = dlBrk(f, lv); let i = 0; while (i < B.b.length && v > B.b[i]) i++; return B.cols[i]; }
function dlLegend(f, lv, sh){ if (!nasaHas('dist')) return ''; const B = dlBrk(f, lv);
  let h = `<div class="row"><i style="background:${ZERO}"></i><span>None detected</span></div>`;
  B.cols.forEach((col, i) => { const t = !B.b.length ? 'Some loss' : i === 0 ? `up to ${sh(B.b[0])}` : i === B.cols.length - 1 ? `over ${sh(B.b[i - 1])}` : `${sh(B.b[i - 1])} to ${sh(B.b[i])}`; h += `<div class="row"><i style="background:${col}"></i><span>${t}</span></div>`; });
  return h + `<p class="sub">${S.dlMon != null ? `Loss first detected from ${dlSince()} through ${dlMonName(S.dlMon)}.` : dlRange() ? `Loss first detected ${dlSince()} to ${dlMonName(dlRange()[1])}.` : ''}</p>`; }
const dlPctShow = v => v > 0 && v < .01 ? 'under 0.01%' : fmt(v, v < 1 ? 2 : 1) + '%', dlAcShow = v => v > 0 && v < 1 ? 'under 1 acre' : fmt(v, v < 10 ? 1 : 0) + ' acres';

/* changes: two hues around "about the same", with classes in even steps from the data */
function divBrk(m, lv){ const key = 'dv' + m.q.id + m.id + lv + S.ext; if (BRK.has(key)) return BRK.get(key); const n = D.levels[lv].id.length, a = [];
  for (let c = 0; c < n; c++){ const v = m.get(lv, c); if (v != null) a.push(Math.abs(v)); } a.sort((x, y) => x - y);
  const q90 = a.length ? a[Math.floor(.9 * (a.length - 1))] : 0, st = niceNum(q90 / 2) || m.divMin || 1; const out = {st}; BRK.set(key, out); return out; }
function divCol(m, v, lv){ if (v == null) return null; const t = divBrk(m, lv).st, k = v < -1.5 * t ? 0 : v < -.5 * t ? 1 : v <= .5 * t ? 2 : v <= 1.5 * t ? 3 : 4; return DIVRAMP[k]; }
function divLegend(m, lv){ if (!nasaHas(m.th)) return ''; const t = divBrk(m, lv).st, sh = v => m.divShow(v), w = m.divWords;
  const W = x => x[0].toUpperCase() + x.slice(1);
  return [[0, `${W(w[0])}: ${sh(1.5 * t)} or more`], [1, `${W(w[0])}: ${sh(.5 * t)} to ${sh(1.5 * t)}`], [2, `About the same (within ${sh(.5 * t)})`], [3, `${W(w[1])}: ${sh(.5 * t)} to ${sh(1.5 * t)}`], [4, `${W(w[1])}: ${sh(1.5 * t)} or more`]]
    .map(([k, s]) => `<div class="row"><i style="background:${DIVRAMP[k]}"></i><span>${s}</span></div>`).join(''); }
function divM(o){ o.colorFn = function(v, lv){ return divCol(this, v, lv); }; o.legendFn = function(lv){ return divLegend(this, lv); };
  o.stripH = v => Math.max(.001, Math.abs(v)); o.stripTop = function(lv){ return 2.5 * divBrk(this, lv).st; }; return o; }
/* measures on a scale that does not start at zero (dates, heights): the strip's bars start at lo */
function floorM(o, lo){ o.stripH = v => Math.max(.001, v - lo); return o; }

/* the question */
const FCCITE = {dist:['OPERA Land Surface Disturbance Alert, Version 1 (NASA JPL OPERA, LP DAAC); tree cover from ESA WorldCover 2021', ''],
  gedi:['GEDI L3 Gridded Land Surface Metrics V2 and L4B Gridded Aboveground Biomass V2.1 (Dubayah et al., ORNL DAAC)', 'https://doi.org/10.3334/ORNLDAAC/1952'],
  lsp:['MODIS Land Cover Dynamics, MCD12Q2 Version 6.1 (Friedl, Gray and Sulla-Menashe, LP DAAC)', 'https://doi.org/10.5067/MODIS/MCD12Q2.061'],
  dym:['Daymet Version 4 R1, daily 1 km (Thornton et al., ORNL DAAC)', 'https://doi.org/10.3334/ORNLDAAC/2129']};
/* a measure from one of these files: its source under the legend, "not built yet" until the file is there, and the legend in its own units
   (getters such as label and note stay live, so the object is filled in place) */
function nasaM(th, o){ o.th = th; o.cite = FCCITE[th][0]; if (FCCITE[th][1]) o.citeUrl = FCCITE[th][1];
  if (!Object.getOwnPropertyDescriptor(o, 'none')) Object.defineProperty(o, 'none', {get(){ return nasaHas(th) ? (o.noneText || 'No data for this cell') : nasaNot(th); }, configurable:true, enumerable:true});
  if (!o.legendFn) o.legendFn = function(lv){ return showLegend(this, lv); };
  return o; }
function showLegend(m, lv){ if (!nasaHas(m.th)) return ''; const B = breaks(m, lv), sh = m.showFn || (v => fmt(v, m.d)); if (!B.n) return '';
  let h = m.zero ? `<div class="row"><i style="background:${ZERO}"></i><span>${esc(m.zeroText || 'None')}</span></div>` : '';
  B.cols.forEach((col, i) => { const hi = i < B.b.length ? B.b[i] : B.max, t = !B.b.length ? (B.min === B.max ? sh(B.min) : `${sh(B.min)} to ${sh(B.max)}`) : i === 0 ? `up to ${sh(hi)}` : i === B.cols.length - 1 ? `over ${sh(B.b[i - 1])}` : `${sh(B.b[i - 1])} to ${sh(hi)}`;
    h += `<div class="row"><i style="background:${col}"></i><span>${esc(t)}</span></div>`; });
  return h; }
Q.push({id:'fcond', th:'dist', hue:HUE.fcond, ramp:'fcond', title:'What shape is the forest in?',
  use:'Forest condition from NASA satellites and the U.S. Forest Service. Canopy loss: confirmed loss of vegetation on tree-covered 30 m pixels, from the OPERA Land Surface Disturbance Alert (Landsat and Sentinel-2, every 2 to 4 days), by the month it was first seen; it catches blowdowns, defoliation, die-off, fire and clearing, and Play steps through the months. Risk of tree loss: the share of treed area where insects and diseases are expected to kill a quarter or more of the trees by 2038 without treatment, from the 2024 National Insect and Disease Risk Map. Forest height and biomass: GEDI lidar from the International Space Station, since 2019, in 1 km squares; GEDI samples strips of ground, so some cells hold too few samples to show. Green-up and leaf-off: the yearly dates leaves come out and drop, from MODIS since 2001, and how they have shifted. Use it to spot fresh damage worth a field check, compare forest structure along the trail, and follow the growing season. Satellite measures, not stand surveys.',
  m:[nasaM('dist', {id:'loss', dlAnim:1, d:2, fn:(lv,c) => { const fa = val('dist','DL_FAC',lv,c); if (!fa) return null; if (S.dlMon == null) return val('dist','DL_PCT',lv,c); return Math.min(100, 100 * dlCum(lv, c, S.dlMon) / fa); },
       get label(){ return S.dlMon != null ? `Canopy loss through ${dlMonName(S.dlMon)}` : 'Canopy loss, share of forest'; }, showFn:dlPctShow, zeroText:'None detected', noneText:'No forest assessed',
       colorFn:(v, lv) => dlCol('DL_PCT', v, lv), legendFn:lv => dlLegend('DL_PCT', lv, dlPctShow), stripTop:lv => { const B = dlBrk('DL_PCT', lv); return B.b.length ? B.b[B.b.length - 1] : 1; },
       note:'Share of the cell’s tree cover with confirmed loss of vegetation, by the month loss was first seen. Partial loss (thinning, defoliation) counts as well as full loss; a pixel that loses canopy twice counts twice. Press Play to step through the months.'}),
     nasaM('dist', {id:'lossac', dlAnim:1, d:0, fn:(lv,c) => { const fa = val('dist','DL_FAC',lv,c); if (!fa) return null; return S.dlMon == null ? val('dist','DL_AC',lv,c) : dlCum(lv, c, S.dlMon); },
       get label(){ return S.dlMon != null ? `Canopy loss through ${dlMonName(S.dlMon)}, acres` : 'Canopy loss, acres'; }, showFn:dlAcShow, zeroText:'None detected', noneText:'No forest assessed',
       colorFn:(v, lv) => dlCol('DL_AC', v, lv), legendFn:lv => dlLegend('DL_AC', lv, dlAcShow), stripTop:lv => { const B = dlBrk('DL_AC', lv); return B.b.length ? B.b[B.b.length - 1] : 1; },
       note:'Acres of tree cover with confirmed loss of vegetation. Large cells hold more forest, so compare cells of one size.'}),
     nasaM('dist', {id:'lossrecent', label:'Recent canopy loss', d:2, fn:(lv,c) => { const fa = val('dist','DL_FAC',lv,c); if (!fa) return null; const r = dlRange(); if (!r) return null;
         const a = dlM(lv, c); let s = 0; if (a) for (let i = 0; i < a.length; i += 2) if (a[i] > r[1] - 3) s += a[i + 1] / 10; return Math.min(100, 100 * s / fa); },
       ramp:RAMP.fcond, showFn:dlPctShow, zero:1, get zeroText(){ return 'None in the last 3 months'; }, noneText:'No forest assessed',
       get note(){ const r = dlRange(); return `Share of the cell’s tree cover with canopy loss first seen in the last 3 months${r ? ` (${dlMonName(r[1] - 2)} to ${dlMonName(r[1])})` : ''}. Fresh damage, sized against the cell’s forest: the darkest cells are worth a field check. Loss in the latest weeks can take a while to be confirmed.`; }}),
     FHRM, TFALLM,
     floorM(nasaM('gedi', {id:'height', grp:'Forest height and biomass (GEDI lidar)', label:'Canopy height', fn:(lv,c) => { const v = val('gedi','FS_H',lv,c); return v == null ? null : ftOf(v); }, ramp:RAMP.tall, d:0,
       showFn:v => fmt(Math.round(v), 0) + ' ft', noneText:'Too few GEDI samples', get note(){ return `Average height of the top of the canopy, from GEDI lidar footprints, ${gediYrs('h')}, over all land in the cell (fields, water and towns lower it). Cells with fewer than 50 footprints are left blank.`; }}), 0),
     nasaM('gedi', {id:'agb', grp:'Forest height and biomass (GEDI lidar)', label:'Aboveground biomass', fn:(lv,c) => { const v = val('gedi','FS_AGB',lv,c); return v == null ? null : tpaOf(v); }, ramp:RAMP.tall, d:0,
       showFn:v => fmt(Math.round(v), 0) + ' tons/acre', noneText:'Too few GEDI samples', get note(){ return `Dry weight of live trees and shrubs above ground, in short tons per acre, from GEDI lidar, ${gediYrs('b')} (1 Mg/ha is 0.45 tons/acre). A guide to stored carbon (about half the weight). Cells with fewer than 50 footprints are left blank.`; }}),
     nasaM('gedi', {id:'shots', grp:'Forest height and biomass (GEDI lidar)', label:'GEDI samples', f:'FS_HN', int:1, zero:1, zeroText:'None', noun:['footprint','footprints'],
       get note(){ return `GEDI lidar footprints (25 m across) in the cell, ${gediYrs('h')}. GEDI samples strips of ground along its orbit, so some cells get few. Fewer than 50: height and biomass are not shown.`; }}),
     floorM(nasaM('lsp', {id:'gu', grp:'Green-up and leaf-off (MODIS)', label:'Green-up date', f:'LSP_GU', ramp:RAMP.doy, d:0, showFn:doyName,
       get note(){ const m = NASAMETA.lsp || {}; return `The day leaves come out: the average date the vegetation index starts its spring rise, ${m.last ? m.last[0] + '–' + m.last[1] : 'the latest five years'} (MODIS, 500 m). Earlier is darker green.`; }}), 60),
     floorM(nasaM('lsp', {id:'do', grp:'Green-up and leaf-off (MODIS)', label:'Leaf-off date', f:'LSP_DO', ramp:RAMP.doy, d:0, showFn:doyName,
       get note(){ const m = NASAMETA.lsp || {}; return `The day the canopy is bare: the average date the vegetation index falls back to its winter level, ${m.last ? m.last[0] + '–' + m.last[1] : 'the latest five years'} (MODIS, 500 m).`; }}), 240),
     floorM(nasaM('lsp', {id:'gs', grp:'Green-up and leaf-off (MODIS)', label:'Growing season', f:'LSP_GS', ramp:RAMP.tall, d:0, showFn:v => fmt(Math.round(v), 0) + ' days',
       note:'Days from green-up to leaf-off, averaged over the latest five years (MODIS).'}), 100),
     divM(nasaM('lsp', {id:'gud', grp:'Green-up and leaf-off (MODIS)', label:'Green-up shift since 2001', fn:(lv,c) => rawv('lsp','LSP_GUD',lv,c), d:1, divShow:v => fmt(Math.abs(v), 1) + ' days', divWords:['earlier','later'],
       showFn:v => Math.abs(v) < .05 ? 'no change' : `${fmt(Math.abs(v), 1)} days ${v < 0 ? 'earlier' : 'later'}`,
       get note(){ const m = NASAMETA.lsp || {}; return `Average green-up date in ${m.last ? m.last[0] + '–' + m.last[1] : 'the latest five years'} compared with 2001–2005 (MODIS). Blue: earlier spring; red: later. Five-year averages smooth single odd years but not every swing.`; }}))]});
QVIZ.fcond = {title:'Canopy loss by month', get note(){ return 'Acres of tree cover with confirmed loss, by the month it was first seen (OPERA Land Surface Disturbance Alert). Tap a month to show the loss through then on the map.'; },
  html:(lv, cells) => dlChart(lv, cells), fn:() => []};
QVIZ.fcond.pick = id => {
  if (id === 'fhr') return {th:'fhr', title:QVIZ.pest.title, note:QVIZ.pest.note, html:null, fn:QVIZ.pest.fn};
  if (id === 'tfall') return Object.assign({th:'veg'}, QVIZ.tvul.pick('tfall'));
  if (['height','agb','shots'].includes(id)) return {th:'gedi', title:id === 'agb' ? 'Biomass by state' : 'Canopy height by state', note:'Averages of the cells with 50 or more GEDI footprints, by state.' + VSTNOTE, html:null, fn(lv, cells){
    const f = id === 'agb' ? 'FS_AGB' : 'FS_H', cv = id === 'agb' ? tpaOf : ftOf, s = VST.map(() => 0), n = VST.map(() => 0);
    cells.forEach(c => { const st = vStOf(lv, c), v = val('gedi', f, lv, c); if (st < 0 || v == null) return; s[st] += cv(v); n[st]++; });
    return VST.map((v, i) => [v[1], HUE.fcond, n[i] ? s[i] / n[i] : 0, n[i] ? (id === 'agb' ? `${fmt(s[i] / n[i], 0)} tons/acre` : `${fmt(s[i] / n[i], 0)} ft`) : '', `${v[1]}: ${n[i] ? fmt(s[i] / n[i], 0) : '–'} over ${nCells(n[i])}`]).filter((x, i) => n[i] > 0); }};
  if (['gu','do','gs','gud'].includes(id)) return {th:'lsp', title:'Green-up by year', note:'Average green-up date of the cells, each year since 2001 (MODIS). The A.T. corridor cells only.', html:(lv, cells) => guChart(lv, cells), fn:() => []};
  return null; };
function dlChart(lv, cells){ const r = dlRange(); if (!r || !nasaHas('dist')) return '';
  const s = new Map(); for (let m = r[0]; m <= r[1]; m++) s.set(m, 0); let n = 0;
  cells.forEach(c => { const a = dlM(lv, c); if (val('dist','DL_FAC',lv,c)) n++; if (!a) return; for (let i = 0; i < a.length; i += 2) if (s.has(a[i])) s.set(a[i], s.get(a[i]) + a[i + 1] / 10); });
  if (!n) return ''; const Y = [...s], mx = Math.max(...Y.map(e => e[1]), .1), W = 272, H = 130, pl = 44, pr = 6, top = 8, base = 108, pw = W - pl - pr, bw = pw / Y.length, f = v => v.toFixed(1);
  const st = niceNum(mx / 3) || .1; let h = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Canopy loss by month">`;
  for (let v = 0; v <= mx + 1e-9; v += st){ const y = base - (base - top) * v / mx; h += `<line x1="${pl}" x2="${W - pr}" y1="${f(y)}" y2="${f(y)}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 4}" y="${f(y + 3)}" text-anchor="end" font-size="9" fill="#9FB2C8">${fmt(v, st >= 1 ? 0 : 1)}${v && v + st > mx ? ' ac' : ''}</text>`; }
  Y.forEach(([m, v], i) => { const on = S.dlMon === m, hh = (base - top) * v / mx; h += `<g data-dlm="${m}" style="cursor:pointer"><rect x="${f(pl + i * bw)}" y="${top}" width="${f(bw)}" height="${base - top}" fill="transparent"/><rect x="${f(pl + i * bw + .4)}" y="${f(base - hh)}" width="${f(Math.max(.8, bw - .8))}" height="${f(hh)}" fill="${on ? '#FFFFFF' : RAMP.fcond[3]}"/><title>${dlMonName(m)}: ${fmt(v, v < 10 ? 1 : 0)} acres. Tap to show the loss through this month</title></g>`;
    if (m % 12 === 0) h += `<text x="${f(pl + (i + .5) * bw)}" y="${base + 12}" text-anchor="${i >= Y.length - 3 ? 'end' : 'middle'}" font-size="9" fill="#C9D4E2">${2021 + m / 12}</text>`; });
  const tot = Y.reduce((a, e) => a + e[1], 0), big = Y.slice().sort((a, b) => b[1] - a[1])[0];
  return h + `</svg><p class="phstat">${fmt(tot, tot < 10 ? 1 : 0)} acres in ${nCells(n)} from ${dlMonName(r[0])} to ${dlMonName(r[1])}; the most in ${dlMonName(big[0])} (${fmt(big[1], big[1] < 10 ? 1 : 0)} acres).</p>`; }
function guChart(lv, cells){ const m = NASAMETA.lsp || {}, ys = m.years; if (!ys || !nasaHas('lsp')) return '';
  const s = ys.map(() => 0), k = ys.map(() => 0); cells.forEach(c => { const a = val('lsp','LSP_GU_Y',lv,c); if (!a) return; a.forEach((v, i) => { if (v != null){ s[i] += v; k[i]++; } }); });
  const Y = ys.map((y, i) => [y, k[i] ? s[i] / k[i] : null]).filter(e => e[1] != null); if (Y.length < 3) return '';
  const lo = Math.floor(Math.min(...Y.map(e => e[1])) / 5) * 5 - 5, hi = Math.ceil(Math.max(...Y.map(e => e[1])) / 5) * 5 + 5, W = 272, H = 130, pl = 40, pr = 6, top = 8, base = 108, pw = W - pl - pr, f = v => v.toFixed(1);
  const X = y => pl + pw * (y - ys[0]) / Math.max(1, ys[ys.length - 1] - ys[0]), Yp = v => base - (base - top) * (v - lo) / (hi - lo);
  let h = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Green-up date by year">`;
  for (let v = lo; v <= hi; v += 10) h += `<line x1="${pl}" x2="${W - pr}" y1="${f(Yp(v))}" y2="${f(Yp(v))}" stroke="#2E4460" stroke-width=".6"/><text x="${pl - 4}" y="${f(Yp(v) + 3)}" text-anchor="end" font-size="9" fill="#9FB2C8">${doyName(v)}</text>`;
  h += `<polyline fill="none" stroke="${RAMP.doy[1]}" stroke-width="1.8" points="${Y.map(([y, v]) => f(X(y)) + ',' + f(Yp(v))).join(' ')}"/>`;
  Y.forEach(([y, v]) => { h += `<circle cx="${f(X(y))}" cy="${f(Yp(v))}" r="2.2" fill="${RAMP.doy[2]}"><title>${y}: ${doyName(v)}</title></circle>`; if (y % 5 === 0) h += `<text x="${f(X(y))}" y="${base + 12}" text-anchor="middle" font-size="9" fill="#C9D4E2">${y}</text>`; });
  const a5 = Y.slice(0, 5), b5 = Y.slice(-5), av = a => a.reduce((s, e) => s + e[1], 0) / a.length, d = av(b5) - av(a5);
  return h + `</svg><p class="phstat">Green-up averaged ${doyName(av(b5))} in ${b5[0][0]}–${b5[b5.length - 1][0]}, ${Math.abs(d) < .5 ? 'about the same as' : fmt(Math.abs(d), 1) + ' days ' + (d < 0 ? 'earlier than' : 'later than')} ${a5[0][0]}–${a5[a5.length - 1][0]}.</p>`; }

/* Play for canopy loss: steps through the months, then shows the whole record */
let dlTimer = null;
const dlAnimOn = () => S.q.id === 'fcond' && !!S.m.dlAnim && !S.m.find && !!dlRange();
function dlBlock(){ const r = dlRange(); if (!r) return `<p class="phstat">${nasaHas('dist') ? '' : nasaNot('dist') + '.'}</p>`; const m = S.dlMon == null ? r[1] : S.dlMon;
  return `<div class="acqctl"><button type="button" class="phplay" data-dlplay="1" aria-pressed="${!!dlTimer}">${dlTimer ? 'Pause' : 'Play'}</button>` +
    `<label class="acqyr"><span id="dlml">${S.dlMon == null ? 'All months' : 'Through ' + dlMonName(m)}</span><input type="range" id="dlmo" min="${r[0]}" max="${r[1]}" step="1" value="${m}" aria-label="Month"></label></div>` +
    `<p class="phstat" role="status">Confirmed canopy loss, ${dlMonName(r[0])} to ${dlMonName(r[1])}, by the month it was first seen.</p>`; }
function dlFrame(full){ const l = $('#dlml'), r = $('#dlmo'), v = $('#qviz'), R = dlRange(); if (l) l.textContent = S.dlMon == null ? 'All months' : 'Through ' + dlMonName(S.dlMon); if (r && R) r.value = S.dlMon == null ? R[1] : S.dlMon;
  if (v && S.q.id === 'fcond' && !['height','agb','shots','gu','do','gs','gud'].includes(S.m.id)) v.innerHTML = qVizHTML();
  restyle(); strip(); legend(); if (full) side(); }
function dlPlay(on){ if (dlTimer){ clearInterval(dlTimer); dlTimer = null; } const R = dlRange();
  if (on && R){ if (S.dlMon == null || S.dlMon >= R[1]) S.dlMon = R[0] - 1;
    dlTimer = setInterval(() => { if (!dlAnimOn()){ clearInterval(dlTimer); dlTimer = null; return; }
      if (S.dlMon >= R[1]){ dlPlay(false); S.dlMon = null; dlFrame(); return; } S.dlMon++; dlFrame(); }, 650); }
  const b = document.querySelector('[data-dlplay]'); if (b){ b.textContent = dlTimer ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', String(!!dlTimer)); }
  if (!on) dlFrame(true); }
document.addEventListener('click', e => { if (e.target.closest('[data-dlplay]')) dlPlay(!dlTimer);
  else { const t = e.target.closest('[data-dlm]'); if (t && S.q.id === 'fcond'){ if (dlTimer) dlPlay(false); const m = +t.dataset.dlm; S.dlMon = S.dlMon === m ? null : m; dlFrame(true); } } });
document.addEventListener('input', e => { if (e.target.id === 'dlmo'){ if (dlTimer){ clearInterval(dlTimer); dlTimer = null; } const R = dlRange(); S.dlMon = R && +e.target.value >= R[1] ? null : +e.target.value; dlFrame(); } });
document.addEventListener('change', e => { if (e.target.id === 'dlmo') side(); });

/* climate change since 1980, under "What climate shapes the trail here?" */
{ const wq = Q.find(q => q.id === 'wx'); if (wq){ const per = () => { const m = NASAMETA.dym || {}; return m.late ? `${m.early[0]}–${m.early[1]} to ${m.late[0]}–${m.late[1]}` : '1981–2000 to the latest 20 years'; }, G = 'Change since 1980 (Daymet)';
  const dF = v => fmt(Math.abs(v), 1) + '°F', dD = v => fmt(Math.abs(v), 1) + ' days', dI = v => fmt(Math.abs(v), 2) + ' in';
  wq.m = wq.m.concat([
    divM(nasaM('dym', {id:'dtmin1', grp:G, label:'Change in January low', fn:(lv,c) => rawv('dym','DM_TMIN1_D',lv,c), d:1, divShow:dF, divWords:['cooler','warmer'], showFn:v => `${sgn(v, 1)}°F`,
      get note(){ return `Average January low, ${per()} (Daymet, 1 km). Red: warmer winter nights.`; }})),
    divM(nasaM('dym', {id:'dtmax7', grp:G, label:'Change in July high', fn:(lv,c) => rawv('dym','DM_TMAX7_D',lv,c), d:1, divShow:dF, divWords:['cooler','warmer'], showFn:v => `${sgn(v, 1)}°F`,
      get note(){ return `Average July high, ${per()} (Daymet).`; }})),
    divM(nasaM('dym', {id:'dheavy', grp:G, label:'Change in heavy-rain days', fn:(lv,c) => rawv('dym','DM_HEAVY_D',lv,c), d:1, divShow:dD, divWords:['fewer','more'], showFn:v => `${sgn(v, 1)} days a year`,
      get note(){ return `Days a year with 1 inch or more of precipitation, ${per()} (Daymet). Heavy rain drives trail erosion and washouts.`; }})),
    divM(nasaM('dym', {id:'dfrost', grp:G, label:'Change in frost-free season', fn:(lv,c) => rawv('dym','DM_FROST_D',lv,c), d:0, divShow:dD, divWords:['shorter','longer'], showFn:v => `${sgn(v, 0)} days`,
      get note(){ return `Days between the last spring and first fall low of 32°F or colder, ${per()} (Daymet).`; }})),
    divM(nasaM('dym', {id:'dswe', grp:G, label:'Change in April snowpack', fn:(lv,c) => rawv('dym','DM_SWE_D',lv,c), d:2, divShow:dI, divWords:['less','more'], showFn:v => `${sgn(v, 2)} in of water`,
      get note(){ return `Snow water on the ground on 1 April, ${per()} (Daymet, modeled). Blue: less snow.`; }}))]); } }
{ const pk = QVIZ.wx.pick; QVIZ.wx.pick = id => { if (!/^d(tmin1|tmax7|heavy|frost|swe)$/.test(id)) return pk(id); const m = S.q.m.find(x => x.id === id);
  return {th:'dym', title:m.label + ' by state', note:'Average change of the cells in each state.' + VSTNOTE, html:null, fn(lv, cells){ const s = VST.map(() => 0), n = VST.map(() => 0);
    cells.forEach(c => { const st = vStOf(lv, c), v = m.get(lv, c); if (st < 0 || v == null) return; s[st] += v; n[st]++; });
    return VST.map((v, i) => [v[1], divCol(m, n[i] ? s[i] / n[i] : 0, lv), n[i] ? Math.abs(s[i] / n[i]) : 0, n[i] ? m.showFn(s[i] / n[i]) : '', `${v[1]}: ${n[i] ? m.showFn(s[i] / n[i]) : '–'} over ${nCells(n[i])}`]).filter((x, i) => n[i] > 0); }}; }; }

/* the cell details */
function fcBox(lv, cells){ const ci = cells.filter(c => has('dist', lv, c) || has('gedi', lv, c) || has('lsp', lv, c)); if (!ci.length) return '';
  const sum = (th, f) => ci.reduce((s, c) => s + (val(th, f, lv, c) || 0), 0), mean = (th, f, raw) => { const a = ci.map(c => raw ? rawv(th, f, lv, c) : val(th, f, lv, c)).filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const fa = sum('dist','DL_FAC'), ac = sum('dist','DL_AC'), last = Math.max(-1, ...ci.map(c => { const v = val('dist','DL_LAST',lv,c); return v == null ? -1 : v; })), h = mean('gedi','FS_H'), b = mean('gedi','FS_AGB'), gu = mean('lsp','LSP_GU'), lo = mean('lsp','LSP_DO'), sh = mean('lsp','LSP_GUD', true);
  const R = dlRange(); let o = `<div class="sec" style="--hue:${HUE.fcond}"><h3>Forest condition</h3><div class="facts">`;
  if (fa >= 1) o += `<div><b>${dlPctShow(Math.min(100, 100 * ac / fa))}</b>of the forest with canopy loss${R ? ' since ' + dlMonName(R[0]) : ''}</div><div><b>${fmt(ac, ac < 10 ? 1 : 0)}</b>acres of loss${last >= 0 ? ', latest ' + dlMonName(last) : ''}</div>`;
  if (h != null) o += `<div><b>${fmt(Math.round(ftOf(h)), 0)} ft</b>average canopy height</div>`;
  if (b != null) o += `<div><b>${fmt(Math.round(tpaOf(b)), 0)}</b>tons/acre of biomass</div>`;
  if (gu != null) o += `<div><b>${doyName(gu)}</b>green-up${sh != null && Math.abs(sh) >= .5 ? `, ${fmt(Math.abs(sh), 1)} days ${sh < 0 ? 'earlier' : 'later'} than 2001–05` : ''}</div>`;
  if (lo != null) o += `<div><b>${doyName(lo)}</b>leaf-off</div>`;
  return o + `</div><p class="none" style="font-size:13.5px;margin-top:8px">NASA satellite measures: OPERA disturbance alerts (canopy loss, 30 m), GEDI lidar (height and biomass, 1 km) and MODIS (green-up, 500 m). Screens for a field visit, not stand surveys.</p></div>`; }
const fcSection = (lv, c) => fcBox(lv, [c]);
function dymBox(lv, cells){ const ci = cells.filter(c => has('dym', lv, c)); if (!ci.length) return ''; const m = NASAMETA.dym || {};
  const mean = f => { const a = ci.map(c => rawv('dym', f, lv, c)).filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const row = (lab, f, fn) => { const e = mean(f + '_E'), l = mean(f + '_L'); return e == null || l == null ? '' : `<div><b>${fn(e)} → ${fn(l)}</b>${lab}</div>`; };
  return `<div class="sec" style="--hue:${HUE.wx}"><h3>Climate change since 1980</h3><div class="facts">` +
    row('January low', 'DM_TMIN1', v => fmt(Math.round(v), 0) + '°F') + row('July high', 'DM_TMAX7', v => fmt(Math.round(v), 0) + '°F') + row('heavy-rain days a year', 'DM_HEAVY', v => fmt(v, 1)) +
    row('frost-free days', 'DM_FROST', v => fmt(Math.round(v), 0)) + row('inches of snow water on 1 April', 'DM_SWE', v => fmt(v, 1)) +
    `</div><p class="none" style="font-size:13.5px;margin-top:8px">${m.late ? `${m.early[0]}–${m.early[1]} averages, then ${m.late[0]}–${m.late[1]}` : 'Early and recent 20-year averages'}, from Daymet (1 km daily, ORNL DAAC).</p></div>`; }
const dymSection = (lv, c) => dymBox(lv, [c]);

const QGRP = {rest:'Priorities', tvul:'Priorities', pri:'Priorities', inv:'Threats', pest:'Threats', fcond:'Threats', pinv:'Threats', veg:'Plants and wildlife', bird:'Plants and wildlife', mig:'Plants and wildlife',
  phen:'Plants and wildlife', rec:'Plants and wildlife', geo:'Land, water and climate', soil:'Land, water and climate', wet:'Land, water and climate', wx:'Land, water and climate',
  hist:'Cultural resources', cult:'Cultural resources', feat:'Stewardship', eff:'Plants and wildlife', land:'Stewardship'};
const QGOFF = new Set();   // folded question groups (filled from this browser's settings below)
const qVis = x => x.id !== 'pri' || JERRY;
{ const ord = ['rest','tvul','pri','feat','land','inv','fcond','pest','pinv','veg','bird','mig','phen','rec','eff','geo','soil','wet','wx','hist','cult']; Q.sort((a,b) => ord.indexOf(a.id) - ord.indexOf(b.id)); }
Q.forEach(q => q.m.forEach(m => { m.q = q; m.th = m.th || q.th; m.kind = m.kind || 'seq';
  m.get = m.fn || ((lv,c) => val(m.th, m.f, lv, c));
  /* counts where a cell with none should stay unfilled, so every cell that has one stands out */
  if (m.hollow0){ const g = m.get; m.get = (lv, c) => { const v = g(lv, c); return v === 0 ? null : v; }; } }));

/* ---------- state ---------- */
/* The basemap the page opens on: USGS topo. */
const DEFBASE = 'hires';
/* When does it flower here? opens on Flowering, week by week, so Play shows the season moving north (Pest and invasives keep their own list) */
{ const p = Q.find(q => q.id === 'phen'); if (p){ const w = p.m.find(m => m.id === 'wave'); if (w) p.m = [w, ...p.m.filter(m => m !== w)]; } }
const S = {ph:{sp:PHSP[0].key, wk:20, yr:0}, q:Q[0], m:Q[0].m[0], level:'auto', sec:'all', cell:null, cellLv:null, fade:true, base:DEFBASE, legend: VW() > 860, secOpen: {}, cells: true, box: null, drawing: false, boxAt: 0, sheetFull: false, ext: 'corr', extMsg: '', side: {qs:true, viz:true, sel:true, instr:false, sum:false, vsumr:false, vsums:false, about:false, measures:true, results:false, tvw:true, rw:true, mgmt:false, hadm:false}};
/* settings kept in this browser between visits (try/catch: private windows can refuse) */
const store = {get(k, d){ try { const v = localStorage.getItem('atgrid_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem('atgrid_' + k, JSON.stringify(v)); } catch (e) {} }};
Object.assign(S.side, store.get('side2', {})); S.side.qs = false; S.side.results = true; S.side.viz = true;   /* the question list starts closed; Results and Visualizations start open */
if (VW() <= 860) S.side.about = true;   /* phones: inside its button, About this data starts open */ store.get('qgroups', []).forEach(g => QGOFF.add(g)); { const lg = store.get('legend', null); if (lg != null) S.legend = lg; } S.secOpen = store.get('secs', {});
function readHash(){ const h = new URLSearchParams(location.hash.slice(1));
  const q = Q.find(x => x.id === h.get('q') && qVis(x)); if (q){ S.q = q; S.m = q.m.find(x => x.id === h.get('m')) || q.m[0]; }
  if (['auto','hex','cog','wheel'].includes(h.get('size'))) S.level = h.get('size');
  if (h.get('base')) S.base = h.get('base');
  if (h.get('sec')) S.sec = h.get('sec');
  if (h.get('find')) S.pendingFind = h.get('find');
  if (h.get('tour')) S.pendingTour = h.get('tour');
  if (h.get('layers')) S.pendingLayers = h.get('layers').split(',');
  if (h.get('ext') === 'huc') S.pendingExt = 'huc';
  if (h.get('herb') === '1') S.herb = true;
  if (h.get('lands') === 'appa') S.appa = true;
  if (['adm', 'huc'].includes(h.get('hadm'))) S.hadm = h.get('hadm');
  if (h.get('sp') && PHSP.some(s => s.key === h.get('sp'))){ S.ph.sp = h.get('sp'); S.ph.pick = true; }
  if (+h.get('wk') >= 1 && +h.get('wk') <= 52) S.ph.wk = +h.get('wk');
  if (h.get('yr')){ const ys = h.get('yr').split(',').map(Number).filter(v => v >= 2010 && v <= 2100); S.ph.sel = ys; if (ys.length === 1) S.ph.yr = ys[0]; }
  if (h.get('cell')){ for (const lv of ['hex','cog','wheel']) if (IDX[lv].has(h.get('cell'))){ S.cell = IDX[lv].get(h.get('cell')); S.cellLv = lv; }
    if (S.cell == null) S.pendingCell = h.get('cell'); } }   /* a watershed cell: found once the watershed cells load */
function writeHash(){ const p = new URLSearchParams({q:S.q.id, m:S.m.id, size:S.level});
  if (S.m.find) p.set('find', S.m.find.key);
  { const on = LIVE.filter(l => l.on).map(l => l.id); if (on.length) p.set('layers', on.join(',')); }
  if (S.ext === 'huc') p.set('ext', 'huc');
  if (S.herb && S.q.id === 'rest') p.set('herb', '1');
  if (S.appa && S.q.id === 'rest') p.set('lands', 'appa');
  if (S.hadm && S.hadm !== 'all' && S.q.id === 'hist') p.set('hadm', S.hadm);
  if (PHQ()){ p.set('sp', S.ph.sp); if (S.m.yr === 'wk') p.set('wk', S.ph.wk); if (S.m.yr === 'wk' && phSel().length) p.set('yr', phSel().join(',')); else if (S.m.yr && phYear()) p.set('yr', phYear()); }
  if (S.sec !== 'all') p.set('sec', S.sec); if (S.base !== DEFBASE) p.set('base', S.base); if (S.cell != null) p.set('cell', D.levels[S.cellLv].id[S.cell]);
  history.replaceState(null, '', '#' + p.toString()); }
readHash();

/* ---------- section filter ---------- */
const secSel = $('#section');
(function(){ let h = '<option value="all">Whole trail</option><optgroup label="Regions">';
  D.regions.forEach((r,i) => h += `<option value="r${i}">${esc(r[0])}</option>`);
  h += '</optgroup><optgroup label="Trail clubs, south to north">';
  D.clubs.forEach(c => h += `<option value="c${D.cats.club.indexOf(c[0])}">${esc(c[0])}</option>`);
  secSel.innerHTML = h + '</optgroup>'; secSel.value = S.sec; if (secSel.value !== S.sec){ S.sec = 'all'; secSel.value = 'all'; } })();
function inSec(lv, c){ if (S.sec === 'all') return true; const L = D.levels[lv];
  if (S.sec[0] === 'r'){ const r = D.regions[+S.sec.slice(1)]; return L.mi[c] >= r[1] && L.mi[c] <= r[2]; }
  return L.club[c] === +S.sec.slice(1); }
function secRange(){ if (S.sec === 'all') return null; if (S.sec[0] === 'r'){ const r = D.regions[+S.sec.slice(1)]; return [r[1], r[2]]; }
  const c = D.clubs.find(x => x[0] === D.cats.club[+S.sec.slice(1)]); return c ? [c[1], c[2]] : null; }
const secName = () => secSel.options[secSel.selectedIndex].text;

/* ---------- classing ---------- */
const BRK = new Map();
{ FHRM.ramp = ['#E9B97A','#D98B45','#C0602A','#94401C','#682812']; }
function fRamp(hex){ const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), mix = t => '#' + c.map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(),
    shade = t => '#' + c.map(v => Math.round(v * (1 - t)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return [mix(.3), mix(.18), mix(.07), hex, shade(.18)]; }
{ const fq = Q.find(q => q.id === 'feat'); [['shel','Shelters'],['camp','Campsites'],['priv','Privies'],['park','Parking areas'],['brid','Bridges'],['vist','Vistas']].forEach(([id, nm]) => { const m = fq && fq.m.find(x => x.id === id); if (m) m.ramp = fRamp(FCOL[nm]); }); }
/* Map classes, picked by the kind of measure (the zero class, where a measure has one, stays separate):
   - restoration scores (0 to 100): fixed breaks at 25, 40, 55 and 70; trail vulnerability: 0.33, 0.5, 0.67, 0.8 (its Low / Moderate / High cut-offs)
   - small counts (whole numbers up to 10): one class per value, the last one open-ended
   - lopsided measures (highest value more than twice the 90th percentile): breaks at the 50th, 75th, 90th and 97th
     percentiles, rounded to clean numbers, so the top classes pick out the real high spots
   - everything else: five equal steps from the lowest to the highest value, rounded to clean numbers */
const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceNum(v){ if (!(v > 0)) return 0; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return NICE.reduce((p, q) => Math.abs(Math.log(q / f)) < Math.abs(Math.log(p / f)) ? q : p) * e; }
function scaleKind(m, a){ if (m.q.id === 'rest') return 'score'; if (m.th === 'soil' && m.id === 'vuln') return 'vuln';
  if (!a.length) return 'even'; const mx = a[a.length-1], p90 = a[Math.min(a.length-1, Math.floor(.9 * a.length))];
  if (m.int && mx <= 10) return 'small'; return mx > 2 * p90 ? 'skew' : 'even'; }
function breaks(m, lv){ const key = m.q.id + m.id + lv; if (BRK.has(key)) return BRK.get(key);
  const n = D.levels[lv].id.length, a = [];
  for (let c = 0; c < n; c++){ const v = m.get(lv, c); if (v != null && !(m.zero && v === 0)) a.push(v); }
  a.sort((x,y) => x - y); let b = []; const kind = scaleKind(m, a);
  if (a.length){ const dec = m.int ? 0 : (m.d == null ? 1 : m.d), r = v => +v.toFixed(dec), mn = a[0], mx = a[a.length-1];
    const q = f => a[Math.min(a.length-1, Math.floor(f * a.length))];
    if (m.brkFix) b = m.brkFix.slice();
    else if (kind === 'score') b = [25, 40, 55, 70];
    else if (kind === 'vuln') b = [.33, .5, .67, .8];
    else if (kind === 'small'){ for (let v = Math.max(1, Math.ceil(mn)); v < mx && b.length < 4; v++) b.push(v); }
    else if (kind === 'skew') b = [.5, .75, .9, .97].map(f => { let v = niceNum(q(f)); if (m.int) v = Math.max(1, Math.round(v)); return r(v); });
    else { const st = niceNum((mx - mn) / 5) || 1, s0 = Math.floor(mn / st) * st; for (let k = 1; k <= 4; k++) b.push(r(s0 + st * k)); }
    b = b.filter((v, i) => v < mx && v >= mn && (i === 0 || v > b[i-1])); }
  const k = b.length + 1, ramp = m.ramp || RAMP[m.q.ramp];
  const cols = k === 1 ? [ramp[3]] : Array.from({length:k}, (_,i) => ramp[Math.round(i*4/(k-1))]);
  const out = {b, cols, kind, min:a[0], max:a[a.length-1], n:a.length, med:a.length ? a[Math.floor(a.length/2)] : null};
  BRK.set(key, out); return out; }
function colorOf(m, lv, v){ if (v == null) return null; if (m.colorFn) return m.colorFn(v, lv);
  if (m.kind === 'cat'){ const e = CATMAP[m.f].get(D.cats[m.f][v]); return e ? e[1] : '#999'; }
  if (m.zero && v === 0) return ZERO;
  const B = breaks(m, lv); let i = 0; while (i < B.b.length && v > B.b[i]) i++; return B.cols[i]; }
function show(m, v){ if (m.find) return v == null ? 'Not recorded' : 'Recorded here'; if (v == null) return m.none || 'no data';
  if (m.kind === 'cat'){ const lab = D.cats[m.f][v], e = CATCOL[m.f].find(x => x[0] === lab); return (e && e[2]) || lab; }
  if (v === 0 && m.zeroText) return m.zeroText;
  if (m.showFn) return m.showFn(v);
  if (m.unit === '%') return fmt(v, m.d) + '%';
  if (m.noun) return fmt(v, 0) + ' ' + m.noun[v === 1 ? 0 : 1];
  return fmt(v, m.d); }
const THIN_AC = 10;
const faded = (m, lv, c) => S.fade && m.fade && (m.fadeFn ? m.fadeFn(lv, c) : m.th === 'veg' ? val('veg', 'VEG_AREA', lv, c) < THIN_AC : thin(m.th, lv, c));

/* ---------- map ---------- */
const map = L.map('map', {preferCanvas:true, zoomSnap:0, zoomDelta:.5, wheelPxPerZoomLevel:110, minZoom:4, maxZoom:18, attributionControl:true});
/* ---------- find my location ---------- */
const LOC = {on:false, first:true, dot:null, ring:null, btn:null, t:0};
function locMsg(s, ms){ let e = document.getElementById('locmsg'); if (!e){ e = document.createElement('div'); e.id = 'locmsg'; e.setAttribute('role', 'status'); map.getContainer().parentNode.appendChild(e); }
  e.textContent = s; e.classList.toggle('on', !!s); clearTimeout(LOC.t); if (s && ms) LOC.t = setTimeout(() => e.classList.remove('on'), ms); }
function locWhere(ll){ try { const H = D && D.levels && D.levels.hex; if (!H) return ''; let best = Infinity, bc = -1;
    for (let c = 0; c < H.id.length; c++){ const p = H.c[c]; if (!p) continue; const d = map.distance(ll, p); if (d < best){ best = d; bc = c; } }
    if (bc < 0) return ''; const mi = best / 1609.34, tm = H.mi ? H.mi[bc] : null;
    return mi < .6 ? `In an A.T. cell${tm != null ? ` near trail mile ${fmt(tm, 0)}` : ''}` : `About ${fmt(mi, mi < 10 ? 1 : 0)} miles from the nearest A.T. cell${tm != null ? ` (near trail mile ${fmt(tm, 0)})` : ''}`; } catch (e){ return ''; } }
function locStop(){ LOC.on = false; map.stopLocate(); [LOC.dot, LOC.ring].forEach(l => l && map.removeLayer(l)); LOC.dot = LOC.ring = null;
  if (LOC.btn){ LOC.btn.setAttribute('aria-pressed', 'false'); LOC.btn.classList.remove('busy'); LOC.btn.title = 'Show my location'; } }
function locStart(){ if (!navigator.geolocation){ locMsg('This browser cannot share its location.', 4000); return; }
  LOC.on = true; LOC.first = true; LOC.btn.setAttribute('aria-pressed', 'true'); LOC.btn.classList.add('busy'); LOC.btn.title = 'Stop showing my location'; locMsg('Finding your location…');
  map.locate({watch:true, setView:false, enableHighAccuracy:true, maximumAge:15000, timeout:20000}); }
map.on('locationfound', e => { if (!LOC.on) return; LOC.btn.classList.remove('busy'); const acc = Math.round(e.accuracy || 0), where = locWhere(e.latlng);
  if (!LOC.ring) LOC.ring = L.circle(e.latlng, {radius:acc, color:'#1E90FF', weight:1, fillColor:'#1E90FF', fillOpacity:.12, interactive:false}).addTo(map); else LOC.ring.setLatLng(e.latlng).setRadius(acc);
  const tip = `You are here${where ? ' · ' + where : ''} · accurate to about ${fmt(acc * 3.28084 > 1500 ? acc / 1609.34 : acc * 3.28084, 0)} ${acc * 3.28084 > 1500 ? 'miles' : 'feet'}`;
  if (!LOC.dot) LOC.dot = L.marker(e.latlng, {icon:L.divIcon({className:'locdot', iconSize:[18, 18]}), keyboard:false, interactive:true, zIndexOffset:1000, alt:'Your location'}).bindTooltip(tip, {direction:'top', offset:[0, -10], className:'loctip'}).addTo(map);
  else LOC.dot.setLatLng(e.latlng).setTooltipContent(tip);
  if (LOC.first){ LOC.first = false; map.flyTo(e.latlng, Math.max(map.getZoom(), Math.min(14, acc > 2000 ? 10 : 13)), {duration:.8}); locMsg(where || 'Showing your location', 5000); } });
map.on('locationerror', e => { if (!LOC.on) return; const denied = e.code === 1; locStop();
  locMsg(denied ? 'Location is blocked for this site. Allow location in the browser’s site settings to use this.' : 'Your location could not be found. Try again outdoors or with a better signal.', 6000); });
{ const Loc = L.Control.extend({options:{position:'topright'}, onAdd(){ const d = L.DomUtil.create('div', 'leaflet-bar leaflet-control locctl'), a = L.DomUtil.create('a', '', d);
    a.href = '#'; a.setAttribute('role', 'button'); a.setAttribute('aria-pressed', 'false'); a.setAttribute('aria-label', 'Show my location'); a.title = 'Show my location';
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
    L.DomEvent.disableClickPropagation(d); L.DomEvent.on(a, 'click', ev => { L.DomEvent.preventDefault(ev); LOC.on ? (locStop(), locMsg('')) : locStart(); }); LOC.btn = a; return d; }});
  new Loc().addTo(map);
  /* top right of the map, clear of the date ticker and the zoom buttons; where the map controls run under it (phones, narrow
     windows), the button drops just below them */
  /* it lines up with the first row of map controls that leaves room for it at the right (on phones, the basemap and layers row),
     and drops below the controls only when neither row does */
  const place = () => { const d = document.querySelector('.locctl'), c = document.getElementById('ctls'); if (!d) return; d.style.marginTop = '';
    if (!c || document.body.classList.contains('stackui')) return;   /* phones keep the locate button in the top row */ const m = map.getContainer().getBoundingClientRect(), b = d.getBoundingClientRect();
    const rows = ['ctlrow1', 'ctlrow2'].map(id => document.getElementById(id)).filter(r => r && r.offsetParent !== null).map(r => {
      let right = 0, top = Infinity, bottom = 0; for (const k of r.children){ if (k.hidden || k.offsetParent === null) continue; const q = k.getBoundingClientRect(); if (!q.width) continue; right = Math.max(right, q.right); top = Math.min(top, q.top); bottom = Math.max(bottom, q.bottom); }
      return {right, top, bottom}; }).filter(r => r.right);
    if (!rows.length) return; const fit = rows.find(r => r.right < b.left - 8);
    const y = fit ? fit.top + (fit.bottom - fit.top - b.height) / 2 : Math.max(...rows.map(r => r.bottom)) + 8;
    d.style.marginTop = Math.max(10, Math.round(y - m.top)) + 'px'; };
  window.addEventListener('resize', place); setTimeout(place, 0); setTimeout(place, 1500); const ro = new ResizeObserver(place); ro.observe(document.body); { const c = document.getElementById('ctls'); if (c) ro.observe(c); } } /* 18 is the tile layers' own limit */
map.attributionControl.setPrefix(false);
const ATTR = 'Basemap: USGS The National Map';
const TNM = 'https://basemap.nationalmap.gov/arcgis/rest/services/', OSMA = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
/* NAIP: the USDA's National Agriculture Imagery Program aerial photos (about 0.6 m), drawn by the USGS image service for each map tile.
   ImgLayer uses the cached USGS imagery tiles below zoom naipFrom (quick, and the image service is slow for wide views) and NAIP from there in. */
const NAIPX = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const NAIPPX = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage';
const NAIPPA = 'Imagery: USGS NAIP Plus (NAIP and high resolution orthoimagery) via <a href="https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer" target="_blank" rel="noopener">USGS The National Map</a>';
const NAIPA = 'Imagery: USDA NAIP via <a href="https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer" target="_blank" rel="noopener">USGS The National Map</a>';
const NAIPDPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
function naipUrl(lyr, c){ const ts = lyr.getTileSize(), m = lyr._map, crs = m.options.crs, p0 = c.scaleBy(ts), p1 = p0.add(ts);
  const nw = crs.project(m.unproject(p0, c.z)), se = crs.project(m.unproject(p1, c.z));
  return (lyr.options.svc || NAIPX) + '?' + new URLSearchParams({bbox:[nw.x, se.y, se.x, nw.y].map(v => v.toFixed(2)).join(','), bboxSR:3857, imageSR:3857, size:Math.round(ts.x * NAIPDPR) + ',' + Math.round(ts.y * NAIPDPR),
    format:'jpg', compressionQuality:lyr.options.q || 92, interpolation:lyr.options.interp || 'RSP_BilinearInterpolation', f:'image'}); }
/* An imagery basemap is two layers drawn together. Underneath, the cached USGS imagery tiles: quick, kept by the browser, and always there.
   On top, from zoom naipFrom in, the sharper picture the USGS image service draws on request. That service is slow and now and then fails,
   so it is asked only once the map stops moving, for a quarter as many (larger) pictures, and each fades in over the cached imagery when it
   arrives; a picture that fails is tried once more and otherwise the cached imagery simply stays. */
const SharpLayer = L.TileLayer.extend({ getTileUrl(c){ return naipUrl(this, c); },
  createTile(c, done){ let alt = null; if (this.options.svc){ const o = this.options.svc; this.options.svc = NAIPX; try { alt = naipUrl(this, c); } finally { this.options.svc = o; } }
    const img = L.TileLayer.prototype.createTile.call(this, c, done); let n = 0;
    img.addEventListener('error', () => { if (n++) return; const u = alt || img.src + '&r=1';   /* NAIP Plus falls back to plain NAIP; the others ask again */
      setTimeout(() => { if (img.parentNode) img.src = u; }, alt ? 0 : 1500); });
    return img; } });
const ImgLayer = L.LayerGroup.extend({
  initialize(o){ L.LayerGroup.prototype.initialize.call(this);
    this.under = L.tileLayer(TNM + 'USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:16, keepBuffer:3, updateWhenZooming:false, attribution:o.attribution});
    this.sharp = new SharpLayer('', {svc:o.svc, interp:o.interp, q:o.q, minZoom:o.naipFrom, maxNativeZoom:18, tileSize:512, updateWhenIdle:true, updateWhenZooming:false, keepBuffer:1});
    this.addLayer(this.under); this.addLayer(this.sharp); },
  bringToBack(){ this.sharp.bringToBack(); this.under.bringToBack(); return this; },
  /* with no signal only the cached imagery is drawn, from the tiles Save for offline keeps */
  offline(off){ this.under.options.maxNativeZoom = off ? 14 : 16; if (off) this.removeLayer(this.sharp); else this.addLayer(this.sharp); if (this._map && this._map.hasLayer(this.under)) this.under.redraw(); } });
const BASEDEF = [
  ['topo', 'USGS topo', L.tileLayer(TNM + 'USGSTopo/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:16, attribution:ATTR, className:'muted-tiles'})],
  ['hires', 'USGS imagery, highest resolution', new ImgLayer({svc:NAIPPX, naipFrom:15, interp:'RSP_CubicConvolution', q:94, attribution:NAIPPA}), 1],
  ['naip', 'NAIP aerial (USDA)', new ImgLayer({naipFrom:16, attribution:NAIPA}), 1],
  ['img', 'USGS imagery', new ImgLayer({naipFrom:17, attribution:ATTR}), 1],
  ['imgl', 'USGS imagery with labels', L.tileLayer(TNM + 'USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:16, attribution:ATTR}), 1],
  ['relief', 'USGS shaded relief', L.tileLayer(TNM + 'USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:16, attribution:ATTR})],
  ['hydro', 'USGS hydrography', L.tileLayer(TNM + 'USGSHydroCached/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:16, attribution:ATTR})],
  ['osm', 'OpenStreetMap', L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxNativeZoom:19, attribution:OSMA})],
  ['otm', 'OpenTopoMap', L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxNativeZoom:17, subdomains:'abc', attribution:'Map data: ' + OSMA + ', SRTM. Style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)'})]
];
/* Mapbox basemaps: paste a Mapbox public access token (it starts with pk.) between the quotes below.
   With no token the Mapbox options stay hidden and the page works as before. */
const MAPBOX_TOKEN = 'pk.eyJ1IjoiY3JlZXNlMzMzIiwiYSI6ImNtdXNwMWoxdTAzcWMyeXEwbWFiMXZzbHEifQ.bFsp9wzSfpJ5BPzcwc8_UA';
const MAPBOX_ON = false;   /* set to true to offer the Mapbox basemaps again (they need Mapbox credits) */
if (MAPBOX_TOKEN && MAPBOX_ON){ const MBA = '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> ' + OSMA + ' <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a>';
  const mb = id => L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/' + id + '/tiles/512/{z}/{x}/{y}' + (L.Browser.retina ? '@2x' : '') + '?access_token=' + MAPBOX_TOKEN, {tileSize:512, zoomOffset:-1, maxNativeZoom:21, attribution:MBA});
  BASEDEF.push(['mbout', 'Mapbox outdoors', mb('outdoors-v12')], ['mbsat', 'Mapbox satellite streets', mb('satellite-streets-v12'), 1], ['mblight', 'Mapbox light', mb('light-v11')]); }
const BASES = {}, DARKBASE = {}; BASEDEF.forEach(b => { BASES[b[0]] = b[2]; DARKBASE[b[0]] = !!b[3]; });
if (!BASES[S.base]) S.base = DEFBASE;
BASES[S.base].addTo(map);
map.createPane('cells').style.zIndex = 410;
map.createPane('trail').style.zIndex = 420; map.getPane('trail').style.pointerEvents = 'none';
map.createPane('sel').style.zIndex = 430; map.getPane('sel').style.pointerEvents = 'none';
const cellRenderer = L.canvas({pane:'cells', padding:.4});
const trailR = L.svg({pane:'trail'}), selR = L.svg({pane:'sel'});
const trailCase = L.polyline(D.trail, {renderer:trailR, color:'#fff', weight:4, opacity:.9, interactive:false}).addTo(map);
const trailLine = L.polyline(D.trail, {renderer:trailR, color:'#14294A', weight:1.5, interactive:false}).addTo(map);
function trailStyle(){ const z = map.getZoom(), far = z < 9, dk = DARKBASE[S.base]; const wide = z < 7; trailCase.setStyle({color: dk ? '#14294A' : '#fff', weight: wide ? 2 : far ? 3.4 : 4.6, opacity: wide ? 0 : far ? .75 : .9}); trailLine.setStyle({color: dk ? '#fff' : '#14294A', weight: wide ? .8 : far ? 1.6 : 2.2, opacity: wide ? .7 : 1}); }
const selOuter = L.polygon([], {renderer:selR, color:'#fff', weight:6, fill:false, interactive:false}).addTo(map);
const selInner = L.polygon([], {renderer:selR, color:'#14294A', weight:2.5, fill:false, interactive:false}).addTo(map);
const boxRect = L.rectangle([[0,0],[0,0]], {renderer:selR, color:'#fff', weight:2, dashArray:'7 5', fill:false, interactive:false});

function ring(lv, c){ const g = D.levels[lv].g[c], out = []; let la = g[0], lo = g[1]; out.push([la/1e5, lo/1e5]);
  for (let i = 2; i < g.length; i += 2){ la += g[i]; lo += g[i+1]; out.push([la/1e5, lo/1e5]); } return out; }
const GROUP = {}, POLY = {};
function group(lv){ if (GROUP[lv]) return GROUP[lv];
  const n = D.levels[lv].id.length, ps = new Array(n);
  for (let c = 0; c < n; c++){ const p = L.polygon(ring(lv, c), {renderer:cellRenderer, pane:'cells', bubblingMouseEvents:false}); p._c = c; ps[c] = p; }
  POLY[lv] = ps; const g = L.featureGroup(ps);
  g.on('click', e => { if (S.drawing || Date.now() - S.boxAt < 450) return; const oe = e.originalEvent || {};
    if (S.picking || oe.shiftKey || oe.ctrlKey || oe.metaKey){ pickToggle(lv, e.propagatedFrom._c); return; }
    if (liveHit(e.latlng) || segHit(e.latlng)) return; select(lv, e.propagatedFrom._c, false); });
  g.on('mouseover', e => { const c = e.propagatedFrom._c, L_ = D.levels[lv]; if (S.drawing || (TOUCHDEV && isPhone()) || (c === S.cell && lv === S.cellLv)) return;
    tip.setLatLng(e.latlng).setContent(`<b>${esc(show(S.m, S.m.get(lv, c)))}</b><br>${S.m.label}<br>Near mile ${fmt(L_.mi[c],0)}`); tip.addTo(map); });
  g.on('mousemove', e => tip.setLatLng(e.latlng));
  g.on('mouseout', () => tip.remove());
  return GROUP[lv] = g; }
const tip = L.tooltip({className:'tip', direction:'top', offset:[0,-6], opacity:1, interactive:false});
/* The value label for the selected cell stays on the map until another cell is chosen or the selection is cleared. */
const pin = L.tooltip({className:'tip pin', direction:'top', offset:[0,-8], opacity:1, interactive:true, permanent:true});
/* the measure's value for a cell; a cell size the theme does not cover borrows the value of the cell it sits in */
function cellValue(lv, c){ const v = S.m.get(lv, c), par = parentOf(lv, c); return v == null && par && !(D.themes[S.m.th] || {})[lv] ? S.m.get(par[0], par[1]) : v; }
function pinSync(){ if (S.cell == null || S.pinOff){ pin.remove(); return; } const lv = S.cellLv, c = S.cell, L_ = D.levels[lv], pv = cellValue(lv, c);
  const top = ring(lv, c).reduce((a, p) => p[0] > a[0] ? p : a);
  pin.setLatLng(top).setContent(`<button type="button" class="pinx" aria-label="Close this label" title="Close this label">&times;</button><b>${esc(show(S.m, pv))}</b><br>${esc(S.m.label)}<br>Near mile ${fmt(L_.mi[c],0)}`); if (!map.hasLayer(pin)) pin.addTo(map); }
/* the small x on the pinned label closes the label only; the cell stays selected */
document.getElementById('map').addEventListener('click', e => { if (e.target.closest && e.target.closest('.pinx')){ e.stopPropagation(); e.preventDefault(); S.pinOff = true; pin.remove(); } }, true);

let shown = null;
function autoLevel(){ const z = map.getZoom(); return z >= 10.5 ? 'hex' : z >= 8.5 ? 'cog' : 'wheel'; }
function dispLevel(){ let lv = S.level === 'auto' ? autoLevel() : S.level;
  if (!D.themes[S.m.th][lv] && Object.keys(D.themes[S.m.th]).length) lv = 'cog'; return lv; }   /* a layer not built yet keeps the chosen size */
/* Cell fill thins out as you zoom in: full strength up to zoom 9, down to 40% opacity (60% transparent) at the closest zoom. */
const FADE_FROM = 9, FADE_TO = 15, FILL_FAR = .86, FILL_NEAR = .4;
function zoomFade(){ const k = Math.max(0, Math.min(1, (map.getZoom() - FADE_FROM) / (FADE_TO - FADE_FROM))); return (FILL_FAR - k * (FILL_FAR - FILL_NEAR)) / FILL_FAR; }
/* where a measure counts records or mapped things, a cell with none is left clear rather than filled */
const ZCLEAR = new Set(['inat', 'ebird', 'hist', 'feat', 'wet', 'edd']);
const zClear = m => (!!m.zero && ZCLEAR.has(m.th)) || m.id === 'share' || !!m.zeroClear;
const BIGGRID = 15000;
function restyle(){ const zf = zoomFade(); const lv = dispLevel(), ps = POLY[lv], m = S.m, strong = m.th === 'feat' || m.th === 'hist', g = GROUP[lv], big = ps.length > BIGGRID;
  /* each cell's style is set only when it changes; on a big grid a cell with nothing to show leaves the canvas (clicks still find it, see below) */
  const put = (c, st) => { const p = ps[c], k = `${st.fillOpacity}|${st.fillColor}|${st.stroke}|${st.color}|${st.weight}|${st.opacity}`, empty = big && !st.fillOpacity && (!st.stroke || !st.opacity);
    if (empty){ if (!p.atOff){ g.removeLayer(p); p.atOff = true; } return; }
    if (p.atOff){ g.addLayer(p); p.atOff = false; } if (p._sk !== k){ p._sk = k; p.setStyle(st); } };
  const px = {hex:1700, cog:4500, wheel:12000}[lv] * Math.pow(2, map.getZoom()) / (156543 * Math.cos(map.getCenter().lat * Math.PI / 180)), tiny = px < 10, w = tiny ? 1 : lv === 'hex' ? .4 : .7; /* trail features: solid fill and a dark outline at every zoom, so any cell with a feature stands out */
  for (let c = 0; c < ps.length; c++){ const v = m.get(lv, c), ins = inSec(lv, c);
    if (m.colorFn === phWaveCol){ const on = v != null && v > 0, col = on ? phWaveCol(v) : null;
      put(c, on ? {fill:true, fillColor:col, fillOpacity:ins ? .95 : .15, stroke:true, color:tiny ? col : '#3A2600', weight:tiny ? 1.2 : lv === 'hex' ? .8 : 1.1, opacity:ins ? .95 : .2}
        : {fill:true, fillOpacity:0, stroke:false}); continue; }
    if (v == null && m.nullHide){ put(c, {fill:true, fillOpacity:0, stroke:false}); continue; }
    if (v == null || (v === 0 && zClear(m))) put(c, {fill:true, fillOpacity:0, stroke:!tiny, color:DARKBASE[S.base] ? '#C9D3CC' : '#7F8C84', weight:.5, opacity:ins ? .4 : .12});
    else if (strong){ const fc = colorOf(m, lv, v); put(c, {fill:true, fillColor:fc, fillOpacity:(!ins ? .1 : .9) * Math.max(zf, .85), stroke:true, color:px < 28 ? fc : m.th === 'hist' ? '#3B2C12' : '#0B2410', weight:px < 28 ? 1 : lv === 'hex' ? .7 : .9, opacity:ins ? .9 : .2}); }
    else put(c, {fill:true, fillColor:colorOf(m, lv, v), fillOpacity:(!ins ? .1 : faded(m, lv, c) ? .32 : .86) * zf, stroke:true, color:tiny ? colorOf(m, lv, v) : '#fff', weight:w, opacity:tiny ? (!ins ? .1 : faded(m, lv, c) ? .32 : .86) * zf : ins ? .9 : .2}); } }
function draw(){ if (S.q.id === 'hist' && !S.m.find){ const sc = histScale();
    if (sc === 'huc' && S.ext !== 'huc' && !S.histHucFail) setExt('huc', true).then(() => { if (S.ext !== 'huc'){ S.histHucFail = true; S.extMsg = ''; redraw(); } });
    else if (sc !== 'huc' && S.ext === 'huc') setExt('corr', true); }
  else if (S.ext === 'huc' && (!EXTQ.includes(S.q.id) || EXTNO.includes(S.q.id) || S.m.find)) setExt('corr', true);
  if (S.ext === 'corr') featSync();
  phQSync(); if (PHQ()){ if (SPREADQ()) phPestCounts(); phFixM(); phLoad(phSp()); } else if (phTimer) phPlay(false);
  if (S.q.id === 'hist') histLoad();
  phTick();
  if (BIO && !BIO.done && S.ext === 'corr') bioApply();
  if (GEO && !GEO.done && S.ext === 'corr') geoApply();
  if (WX && !WX.done && S.ext === 'corr') wxApply();
  if (TSL && !TSL.done && S.ext === 'corr') tslApply();
  if (typeof FHR !== 'undefined' && FHR && !FHR.done && S.ext === 'corr') fhrApply();
  if (typeof TOPO !== 'undefined' && TOPO && !TOPO.done && S.ext === 'corr') topoApply();
  if (typeof DEFIC !== 'undefined' && DEFIC && !DEFIC.done && S.ext === 'corr') deficApply();
  if (typeof SEGS !== 'undefined' && SEGS && !SEGS.done && S.ext === 'corr') segApply();
  if (typeof nasaApply === 'function' && S.ext === 'corr') nasaApply();
  const lv = dispLevel();
  if (shown !== lv){ if (shown) map.removeLayer(GROUP[shown]); group(lv); shown = lv; restyle(); if (S.cells) GROUP[lv].addTo(map); }
  else restyle();
  const want = S.level === 'auto' ? autoLevel() : S.level, note = $('#note');
  if (want !== lv){ note.style.display = 'block'; note.textContent = 'Unique species ratings are shown at 7 and 49 sq mi, not for single square miles.'; } else note.style.display = 'none';
  document.querySelectorAll('#levels button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.lv === S.level);
    if (b.dataset.lv === 'auto') b.innerHTML = `<span class="lvn">Auto</span><span class="lvac">fits the zoom</span>`; });   /* the header shows which size Auto picked */
  if (!S.m.find && document.activeElement !== $('#find')) $('#find').value = '';
  corrSync(lv); legend(); side(); refreshProfile(); pinSync(); }
function redraw(){ draw(); strip(); writeHash(); }
/* ---------- soils and wetlands extent ----------
   "A.T. corridor": the grid cells along the trail that every layer uses. "HUC10 watershed": every grid cell in the HUC10 shell,
   for soils and wetlands only. Those cells are in soils_wetlands_huc10.json beside this page and load the first time they are asked for.
   Switching swaps the grid and the soils data under the page, so the map, rankings, strip, selection and export all follow.
   Choosing another question, or searching for a species, switches back to the corridor. */
const EXTFILE = 'data/soils_wetlands_huc10.json', EXT = {corr:null, huc:null}, EXTQ = ['soil','wet','rec','inv','bird','eff','phen','pest','fcond','pinv','cult','geo','wx','tvul'];
const SOILCATS = ['VULN_DOM','SOIL_SERIES','SOIL_TEXTURE','SOIL_ORDER','SOIL_DRAIN','SOIL_HSG','SOIL_FARM','SOIL_ECOSITE','SOIL_MAPUNIT','WET_DOM','WET_LDOM'];
let extLoading = null;
function extSnapshot(){ const cats = {}; SOILCATS.forEach(k => { if (D.cats[k]) cats[k] = D.cats[k]; });
  return {levels:D.levels, themes:D.themes, cats, group:Object.assign({}, GROUP), poly:Object.assign({}, POLY)}; }
function extLoad(){ if (EXT.huc) return Promise.resolve(); if (extLoading) return extLoading;
  extLoading = fetch(EXTFILE).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
    const themes = {}; for (const th in D.themes) themes[th] = {}; themes.soil = j.soil; if (j.wet) themes.wet = j.wet;
    const H = {levels:j.levels, themes, cats:j.cats, group:{}, poly:{}};
    /* the watershed iNaturalist and eBird summaries load with the cells, so both are ready together */
    return Promise.all([fetch(BIOHUC, {cache:'no-cache'}).then(r => !r.ok ? null : /\.gz$/.test(BIOHUC) && window.DecompressionStream ? new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json() : r.json()).then(b => { if (b && b.themes) bioHuc(b, H); }).catch(() => {}),
      fetch(GEOHUC, {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(g => { if (g && g.themes) { geoTables(g); H.themes.geo = geoConv(g, H.levels); } }).catch(() => {}),
      fetch(WXHUC, {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(w => { if (w && w.themes){ if (w.meta && !WXMETA.storms_info) WXMETA = w.meta; H.themes.wx = thConv(w, 'wx', H.levels); } }).catch(() => {}),
      fetch(FHRHUC, {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(t => { if (t && t.themes) H.themes.fhr = thConv(t, 'fhr', H.levels); }).catch(() => {}),
      ...NASAF.map(([th, f]) => fetch('data/' + f + '_huc10.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(t => { if (t && t.themes){ H.themes[th] = thConv(t, th, H.levels); if (!NASAMETA[th]) NASAMETA[th] = t.meta || {}; } }).catch(() => {})),
      fetch(TSLHUC, {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(t => { if (t && t.themes) H.themes.slope = thConv(t, 'slope', H.levels); }).catch(() => {})]).then(() => { EXT.huc = H; }); });
  extLoading.catch(() => {}).then(() => { extLoading = null; });
  return extLoading; }
function extIndex(){ for (const th in ROW) delete ROW[th]; if (!D.themes.edd) D.themes.edd = {}; if (!D.themes.geo) D.themes.geo = {}; if (!D.themes.vis) D.themes.vis = {}; if (!D.themes.wx) D.themes.wx = {}; if (!D.themes.slope) D.themes.slope = {}; if (!D.themes.fhr) D.themes.fhr = {}; if (!D.themes.topo) D.themes.topo = {}; if (!D.themes.defic) D.themes.defic = {}; if (!D.themes.seg) D.themes.seg = {}; for (const th of ['dist','gedi','lsp','dym']) if (!D.themes[th]) D.themes[th] = {}; if (!D.themes.hist || !D.themes.hist.wheel) D.themes.hist = HISTTH();
  for (const th in D.themes){ ROW[th] = {}; for (const lv in D.themes[th]){ const a = new Int32Array(D.levels[lv].id.length).fill(-1); D.themes[th][lv].ix.forEach((c,k) => a[c] = k); ROW[th][lv] = a; } }
  for (const lv in D.levels){ const m = new Map(); D.levels[lv].id.forEach((id,i) => m.set(id,i)); IDX[lv] = m; }
  BRK.clear(); for (const k in COVER) delete COVER[k]; for (const k in RINGS) delete RINGS[k]; }
/* Swap to the other set of cells. quiet: swap only (draw() is already under way). */
function setExt(ext, quiet){ if (ext === S.ext) return Promise.resolve();
  if (ext === 'huc' && !EXT.huc){ S.extMsg = 'Loading the watershed cells...'; side();
    return extLoad().then(() => { S.extMsg = ''; return setExt('huc'); },
      () => { S.extMsg = 'The watershed cells (' + EXTFILE + ') could not be loaded. They need to sit beside this page on the web site.'; side(); }); }
  /* the selection is carried over by grid ID; cells outside the corridor are dropped when going back to it */
  const keep = S.cell != null ? [S.cellLv, D.levels[S.cellLv].id[S.cell]] : null;
  const box = S.box ? {lv:S.box.lv, ids:S.box.cells.map(c => D.levels[S.box.lv].id[c]), label:S.box.label, within:S.box.within ? [S.box.within[0], D.levels[S.box.within[0]].id[S.box.within[1]]] : null} : null;
  if (shown){ map.removeLayer(GROUP[shown]); shown = null; }
  EXT[S.ext] = extSnapshot();
  const to = EXT[ext]; D.levels = to.levels; D.themes = to.themes; SOILCATS.forEach(k => { if (to.cats[k]) D.cats[k] = to.cats[k]; });
  for (const k in GROUP) delete GROUP[k]; Object.assign(GROUP, to.group); for (const k in POLY) delete POLY[k]; Object.assign(POLY, to.poly);
  S.ext = ext; extIndex();
  if (keep){ const c = IDX[keep[0]].get(keep[1]); if (c != null) S.cell = c; else clearSel(); }
  else if (box){ const cells = box.ids.map(id => IDX[box.lv].get(id)).filter(c => c != null), w = box.within && IDX[box.within[0]].get(box.within[1]);
    if (cells.length) S.box = {lv:box.lv, cells, label:box.label, within:box.within && w != null ? [box.within[0], w] : null}; else clearSel(); }
  if (S.pendingCell && ext === 'huc'){ for (const lv of ['hex','cog','wheel']){ const c = IDX[lv].get(S.pendingCell); if (c != null){ S.pendingCell = null; if (!quiet){ redraw(); select(lv, c, true); return Promise.resolve(); } } } }
  if (!quiet) redraw();
  return Promise.resolve(); }
/* outlines of the corridor cells, drawn over the watershed cells */
map.createPane('corrline').style.zIndex = 415; map.getPane('corrline').style.pointerEvents = 'none';
const corrRenderer = L.canvas({pane:'corrline', padding:.4}), CORRLINE = {};
let corrShown = null, corrLast = null; const CORRZ = 8;
function corrSync(lv){ corrLast = lv; const want = S.ext === 'huc' && S.cells && map.getZoom() >= CORRZ ? lv : null; if (corrShown === want) return;
  if (corrShown) map.removeLayer(CORRLINE[corrShown]); corrShown = want; if (!want) return;
  if (!CORRLINE[lv]){ const L_ = EXT.corr.levels[lv], ps = [];
    for (let c = 0; c < L_.id.length; c++){ const g = L_.g[c], r = []; let la = g[0], lo = g[1]; r.push([la/1e5, lo/1e5]);
      for (let i = 2; i < g.length; i += 2){ la += g[i]; lo += g[i+1]; r.push([la/1e5, lo/1e5]); }
      ps.push(L.polygon(r, {renderer:corrRenderer, pane:'corrline', fill:false, color:'#FFD54A', weight:lv === 'hex' ? 1 : 1.6, opacity:.85, interactive:false})); }
    CORRLINE[lv] = L.layerGroup(ps); }
  CORRLINE[lv].addTo(map); }
map.on('zoomend', () => { if (corrLast) corrSync(corrLast); });
const CORRSET = {}; function inCorr(lv, c){ if (!EXT.corr) return true; const s_ = CORRSET[lv] = CORRSET[lv] || new Set(EXT.corr.levels[lv].id); return s_.has(D.levels[lv].id[c]); }
function refreshProfile(){ if ((S.cell != null || S.box) && $('#profile').classList.contains('open')) profile(); }
map.on('zoomend', () => { trailStyle(); if (S.level === 'auto' && dispLevel() !== shown){ draw(); strip(); } else if (shown) restyle(); });
map.on('moveend', viewWindow);
map.on('moveend zoomend', () => segDraw());
{ const r0 = redraw; redraw = function(){ r0(); segDraw(); }; }
{ const l0 = legend; legend = function(){ l0(); segSync(); const e = $('#legend'); if (!e || !SEGS || !S.q || S.q.id !== 'tvul' || S.m.id === 'tfall' || S.ext !== 'corr') return;
    const R = RAMP.tvul, lab = ['under 40', '40 to 60', '60 to 80', '80 to 90', '90 and over'];
    const d = document.createElement('div'); d.className = 'segleg';
    d.innerHTML = `<label><input type="checkbox" id="segtog"${segOn ? ' checked' : ''}> Trail segments, about 500 feet each${map.getZoom() < SEGZ ? ' <span class="sub">(zoom in to see)</span>' : ''}</label><div class="segmode"><button type="button" data-m="risk"${segMode === 'risk' ? ' class="on"' : ''}>Erosion risk</button><button type="button" data-m="tsr"${segMode === 'tsr' ? ' class="on"' : ''}>Sustainability rating</button></div>` + (segMode === 'tsr' ? TSR.map(x => `<div class="row"><i class="ln" style="background:${x.c}"></i><span>${x.t}</span></div>`).join('') + '<div class="sub" style="margin:2px 0 4px">From trail grade and how directly the trail climbs</div>' : lab.map((t, k) => `<div class="row"><i class="ln" style="background:${R[k]}"></i><span>${t}</span></div>`).join('')) + `<div class="row"><i class="ln" style="background:repeating-linear-gradient(90deg,${SEGWETC} 0 4px,transparent 4px 8px)"></i><span>Low, flat trail (often wet)</span></div>`;
    const b = e.querySelector('#legbody') || e; b.appendChild(d);
    d.querySelectorAll('.segmode button').forEach(bt => bt.addEventListener('click', () => { segMode = bt.dataset.m; try { localStorage.setItem('atgrid_segmode', segMode); } catch (x) {} segKey = ''; segDraw(); legend(); }));
    d.querySelector('#segtog').addEventListener('change', ev => { segOn = ev.target.checked; try { localStorage.setItem('atgrid_segs', segOn ? '1' : '0'); } catch (x) {} segKey = ''; segDraw(); }); }; }
map.on('zoomend', () => { const t = $('#segtog'); if (t) legend(); });
map.createPane('states').style.zIndex = 412; map.getPane('states').style.pointerEvents = 'none';
let STL = null, stOn = true; try { stOn = localStorage.getItem('atgrid_states') !== '0'; } catch (e) {}
function statesShow(){ const cb = $('#stlines'); if (cb) cb.checked = stOn; if (!STL) return; if (stOn) STL.addTo(map); else map.removeLayer(STL); }
fetch('data/states.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (!j || !j.features) return;
  STL = L.geoJSON(j, {renderer:L.canvas({pane:'states', padding:.3}), interactive:false, smoothFactor:1.5, style:() => ({color:'#C4A57C', weight:map.getZoom() < 7 ? .7 : 1.2, opacity:.9})}); statesShow(); }).catch(() => {});
map.on('zoomend', () => { if (STL) STL.setStyle({weight:map.getZoom() < 7 ? .7 : 1.2}); });
document.addEventListener('change', e => { if (e.target.id === 'stlines'){ stOn = e.target.checked; try { localStorage.setItem('atgrid_states', stOn ? '1' : '0'); } catch (x) {} statesShow(); } });
/* the rare species priority zones: data/nrpz.enc, unlocked with the passphrase (AES-256-GCM, PBKDF2-SHA256). The passphrase is kept
   only for this tab (sessionStorage), so a reload in the same tab stays unlocked and a new tab asks again */
const b64u8 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
async function nrpzUnlock(pass){ const r = await fetch('data/nrpz.enc', {cache:'no-cache'}); if (!r.ok) throw new Error('missing');
  const e = await r.json(), base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2', hash:'SHA-256', salt:b64u8(e.salt), iterations:e.iter}, base, {name:'AES-GCM', length:256}, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64u8(e.iv)}, key, b64u8(e.ct));   // throws on a wrong passphrase
  return JSON.parse(new TextDecoder().decode(plain)).nrpz; }
function nrpzOpen(z, go){ D.themes.nrpz = z; extIndex(); BRK.clear(); for (const k in RESTC) delete RESTC[k]; JERRY = true; document.body.classList.add('jerry');
  if (go){ const q = Q.find(x => x.id === 'pri'); S.q = q; S.m = q.m[0]; S.secOpen = {}; S.side.qs = true; }
  redraw(); if (S.cell != null || S.box) refreshProfile(); }
function jerryAsk(){ let f = $('#jerrylock'); if (f){ f.querySelector('input').focus(); return; }
  f = document.createElement('form'); f.id = 'jerrylock'; f.setAttribute('autocomplete', 'off');
  f.innerHTML = '<label for="jerrypass">Passphrase</label><input id="jerrypass" type="password" autocomplete="off" spellcheck="false"><button type="submit">Unlock</button><button type="button" data-jx="1">Cancel</button><p role="status"></p>';
  document.querySelector('header').appendChild(f); const inp = f.querySelector('input'), msg = f.querySelector('p'); inp.focus();
  f.querySelector('[data-jx]').onclick = () => f.remove();
  f.onsubmit = async ev => { ev.preventDefault(); const pass = inp.value; if (!pass) return; msg.textContent = 'Unlocking…';
    try { const z = await nrpzUnlock(pass); try { sessionStorage.setItem('jerrykey', pass); } catch (x) {}
      f.remove(); $('#jerrybtn').hidden = true; fin.value = ''; closeFind(); nrpzOpen(z, true); }
    catch (x){ msg.textContent = x && x.message === 'missing' ? 'The protected data file is missing.' : 'That passphrase did not unlock the data.'; inp.select(); } }; }
$('#jerrybtn').addEventListener('click', jerryAsk);
{ let k = null; try { k = sessionStorage.getItem('jerrykey'); } catch (e) {} if (k) nrpzUnlock(k).then(z => nrpzOpen(z, false)).catch(() => { try { sessionStorage.removeItem('jerrykey'); } catch (e) {} }); }
{ let ct; map.on('moveend', () => { clearTimeout(ct); ct = setTimeout(cultVizRefresh, 150); }); }

$('#levels').innerHTML = '<button type="button" class="lvh" aria-expanded="false"><span class="lvt">Cell size</span><i aria-hidden="true"></i></button>' + [['auto','Auto','',' fits the zoom'],['wheel','49',' sq mi',' 31,360 ac'],['cog','7',' sq mi',' 4,480 ac'],['hex','1',' sq mi',' 640 ac']].map(x => `<button type="button" data-lv="${x[0]}"><span class="lvn">${x[1]}<span class="u">${x[2]}</span></span><span class="lvac">${x[3]}</span></button>`).join('');
$('#levels').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('lvh')){ const o = !$('#levels').classList.contains('open'); $('#levels').classList.toggle('open', o); b.setAttribute('aria-expanded', o); return; } S.level = b.dataset.lv; $('#levels').classList.remove('open'); $('#levels .lvh').setAttribute('aria-expanded', 'false'); redraw(); });
const mbLogo = L.control({position:'bottomright'});
mbLogo.onAdd = () => { const a = L.DomUtil.create('a', 'mblogo'); a.href = 'https://www.mapbox.com/'; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Mapbox homepage'); return a; };
$('#basesel').innerHTML = BASEDEF.map(b => `<option value="${b[0]}">${b[1]}</option>`).join(''); $('#basesel').value = S.base;
function baseSync(){ $('#map').style.background = DARKBASE[S.base] ? '#142235' : '#DDE3DC'; trailStyle(); if (S.base.startsWith('mb')) mbLogo.addTo(map); else mbLogo.remove(); }
function setBase(k){ if (!BASES[k] || k === S.base) return; map.removeLayer(BASES[S.base]); S.base = k; BASES[k].addTo(map); BASES[k].bringToBack();
  baseSync(); if (shown) restyle(); writeHash(); }
$('#basesel').addEventListener('change', e => setBase(e.target.value));

$('#cellsbtn').onclick = () => { S.cells = !S.cells; map.getPane('cells').style.pointerEvents = S.cells ? '' : 'none'; const b = $('#cellsbtn');
  b.setAttribute('aria-pressed', S.cells); b.querySelector('span').textContent = S.cells ? 'Cells on' : 'Cells off';
  if (shown){ if (S.cells) GROUP[shown].addTo(map); else { map.removeLayer(GROUP[shown]); tip.remove(); } } };

function trailMid(){ if (!isPhone()) return; /* phones: the default view - Springer Mountain near the lower left and Katahdin near the upper right,
   at the same places on the map as the agreed reference view (Nov 2026), scaled to the phone's width */
  const L_ = D.levels.hex.mi ? D.levels.hex : D.levels.wheel; let s0 = 0, n = 0; for (let i = 1; i < L_.id.length; i++){ if (L_.mi[i] < L_.mi[s0]) s0 = i; if (L_.mi[i] > L_.mi[n]) n = i; }
  const sz = map.getSize(), A = {x:.0462, y:.8295}, B = {x:.9285, y:.2545};   /* Springer and Katahdin as shares of the map's width and height */
  const pS0 = map.project(L_.c[s0], 0), pK0 = map.project(L_.c[n], 0);
  /* on shorter screens, keep both ends clear of the control row and the legend button */
  const mr = map.getContainer().getBoundingClientRect(), row = $('#section'), lb = $('#legtog');
  const tops = [row, $('#lvbar')].filter(e => e && e.offsetParent).map(e => e.getBoundingClientRect().bottom), topMin = tops.length ? Math.max(...tops) - mr.top + 24 : 0, botMax = lb && lb.offsetParent ? lb.getBoundingClientRect().top - mr.top - 16 : sz.y - 40;
  const yK = Math.max(sz.y * B.y, topMin), yS = Math.min(sz.y * A.y, botMax);
  const z = Math.min(Math.log2(sz.x * (B.x - A.x) / Math.max(1e-9, pK0.x - pS0.x)), Math.log2(Math.max(40, yS - yK) / Math.max(1e-9, pS0.y - pK0.y)));
  const cp = map.project(L_.c[s0], z).subtract(L.point(sz.x * A.x, yS)).add(sz.divideBy(2)), ctr = map.unproject(cp, z);
  /* move the map once, and only when it is not already there, so the basemap is not dropped and reloaded */
  if (map._loaded && Math.abs(map.getZoom() - z) < 1e-6 && map.project(map.getCenter(), z).distanceTo(cp) < 3) return;
  map.setView(ctr, z, {animate:false}); }
function fitSection(){ const lv = 'wheel', L_ = D.levels[lv], pts = [];
  for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c)) pts.push(L_.c[c]);
  if (pts.length){ map.fitBounds(L.latLngBounds(pts).pad(.08)); if (S.sec === 'all') trailMid(); } }

/* ---------- live layers from the NPS Appalachian Trail ArcGIS services ----------
   These load in the visitor's browser, only when switched on. If a service is unreachable the layer reports it and the rest of the page is unaffected. */
const SVC = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/';
map.createPane('lands').style.zIndex = 411;   /* administrative areas draw over the grid cells, under the trail */
map.createPane('feat').style.zIndex = 440;
const landsR = L.svg({pane:'lands', padding:.3}), featR = L.svg({pane:'feat', padding:.3});
const LANDKEY = [['FEDERAL LAND - NPS - APPA FEE','NPS, A.T. fee land','rgb(0,77,168)'],['FEDERAL LAND - NPS - APPA EASEMENT','NPS, A.T. easement','rgb(145,135,245)'],['FEDERAL LAND - NPS - APPA ROW EASEMENT','NPS, A.T. right-of-way easement','rgb(190,210,255)'],
  ['FEDERAL LAND - NPS - APPA ADMINISTRATIVELY TRANSFERRED LANDS','NPS, A.T. administratively transferred','rgb(255,190,190)'],['FEDERAL LAND - NPS - OTHER','NPS, other park units','rgb(223,115,255)'],['FEDERAL LAND - USFS','US Forest Service','rgb(38,115,0)'],
  ['FEDERAL LAND - USFS - APPA ADMINISTRATIVELY TRANSFERRED LANDS','USFS, A.T. administratively transferred','rgb(168,168,0)'],['FEDERAL LAND - USFWS','US Fish and Wildlife Service','rgb(0,168,132)'],['FEDERAL LAND - OTHER','Other federal','rgb(255,170,0)'],
  ['STATE LAND','State','rgb(85,255,0)'],['CONSERVATION LAND','Conservation land','rgb(211,255,190)'],['TOWN LAND','Town','rgb(255,255,115)']];
const LANDMAP = new Map(LANDKEY.map(k => [k[0], k]));
const LIVE = [
  {id:'shelters', name:'Shelters', url:SVC + 'ANST_Facilities/FeatureServer/4', type:'pt', color:'#D62839'},
  {id:'campsites', name:'Campsites', url:SVC + 'ANST_Facilities/FeatureServer/1', type:'pt', color:'#2E6B3A'},
  {id:'parking', name:'Parking', url:SVC + 'ANST_Facilities/FeatureServer/2', type:'pt', color:'#23436B'},
  {id:'privies', name:'Privies', url:SVC + 'ANST_Facilities/FeatureServer/3', type:'pt', color:'#74224E'},
  {id:'bridges', name:'Bridges', url:SVC + 'ANST_Facilities/FeatureServer/0', type:'pt', color:'#4FA096'},
  {id:'vistas', name:'Vistas', url:SVC + 'ANST_Facilities/FeatureServer/5', type:'pt', color:'#B38E2F'},
  {id:'sidetrails', name:'Side trails', url:SVC + 'ANST_Facilities/FeatureServer/6', type:'line', bbox:1, minZoom:10, color:'#35A7FF'},
  {id:'lands', name:'Administrative areas', url:SVC + 'AT_Lands/FeatureServer/1', type:'poly', bbox:1, minZoom:11, fields:'NAME,ADMIN,ACRES,TRACT1,LEGEND3', color:'rgb(0,77,168)'},
  {id:'mland', name:'Maintained landscapes', file:'data/maintained_landscapes.json', type:'poly', color:'#B5A33A'},
  {id:'nrhp', name:'National Register (NPS)', local:1, hist:'nr', type:'pt', color:'#8C5A2B'},
  {id:'osmcem', name:'Cemeteries (OpenStreetMap)', local:1, type:'pt', color:'#4F6B5A'}
];
const GLYPH = {
  shelters:'<path d="M2.5 9.5 8 3.5l5.5 6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 8.5V13h7V8.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>',
  campsites:'<path d="M8 2.8 2.2 13h11.6z" fill="#fff"/><path d="M8 7.6 5.9 13h4.2z" fill="currentColor"/>',
  parking:'<path d="M5.2 13V3.2h3.6a3 3 0 0 1 0 6H5.2" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  privies:'<path d="M4.3 13.3V6.4L8 2.8l3.7 3.6v6.9z" fill="#fff"/><path d="M8.9 7.2a1.9 1.9 0 1 0 0 3.4 2.3 2.3 0 0 1 0-3.4z" fill="currentColor"/>',
  bridges:'<path d="M1.6 6h12.8M2.8 6v6.4M13.2 6v6.4M2.8 12.2Q8 3.6 13.2 12.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  vistas:'<path d="M1.6 13 6 5.8l2.6 3.4 1.7-2.1L14.4 13z" fill="#fff"/><circle cx="11.6" cy="4" r="1.5" fill="#fff"/>'};
Object.assign(GLYPH, {
  osmcem:'<path d="M6.6 2.4h2.8v3h3v2.8h-3V14H6.6V8.2h-3V5.4h3z" fill="#fff"/>',
  nrhp:'<path d="M2 6 8 2.6 14 6z" fill="#fff"/><path d="M3.6 7.2v4.6M6.5 7.2v4.6M9.5 7.2v4.6M12.4 7.2v4.6" stroke="#fff" stroke-width="1.5"/><path d="M2.2 13h11.6" stroke="#fff" stroke-width="1.6"/>'});
const glyphHTML = (l, size) => `<span class="fic" style="background:${l.color};color:${l.color};width:${size}px;height:${size}px"><svg viewBox="0 0 16 16" width="${Math.round(size * .68)}" height="${Math.round(size * .68)}" aria-hidden="true">${GLYPH[l.id] || ''}</svg></span>`;
LIVE.forEach(l => { l.on = false; l.group = L.layerGroup(); l.status = ''; l.loaded = false; l.req = 0; });
async function arcQuery(url, params, maxPages){ let out = [], off = 0; const seen = new Set();
  for (let pg = 0; pg < (maxPages || 15); pg++){ const u = url + '/query?' + new URLSearchParams(Object.assign({where:'1=1', outSR:4326, f:'geojson', resultOffset:off, resultRecordCount:2000}, params));
    const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'service error');
    const got = j.features || [], f = got.filter(x => { const id = x.id != null ? x.id : (x.properties ? (x.properties.OBJECTID != null ? x.properties.OBJECTID : x.properties.FID) : null); if (id == null) return true; if (seen.has(id)) return false; seen.add(id); return true; });
    out = out.concat(f); if (!got.length || !f.length || !((j.properties && j.properties.exceededTransferLimit) || j.exceededTransferLimit)) break; off += got.length; }
  return out; }
async function arcMeta(l){ if (l.meta) return l.meta; try { const r = await fetch(l.url + '?f=json'); l.meta = await r.json(); } catch (e){ l.meta = {}; } return l.meta; }
const tcase = s => String(s || '').toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Nps|Usfs|Usfws|Appa|Hafe|Grsm|Blri|Shen|Choh|Dewa|Nhp|Nra|Nf|Np|Wma|Atc|Row|Us|Usa|Dcr|Dec|Dep|Dnr|Dcnr|Tva|Llc|Inc|Ii|Iii)\b/g, x => x.toUpperCase()).replace(/ (Of|The|And|For|At|In) /g, x => x.toLowerCase());
function featName(l, p){ const bad = /^(na|n\/a|none|null|unknown|unnamed|tbd|[\s?.\-_]*)$/i, df = (l.meta || {}).displayField, k = [df, 'Name', 'NAME', 'Label'].find(k => k && p[k] != null && !bad.test(String(p[k]).trim())); return k ? String(p[k]).trim() : ''; }
/* Popups for the live layers show the feature's name only, until the source attributes are reliable. Vistas also keep their photo buttons. */
function featPopup(l, p){ const kind = ({mland:'Maintained landscape', lands:'Administrative area', shelters:'Shelter', campsites:'Campsite', parking:'Parking area', privies:'Privy', bridges:'Bridge', vistas:'Vista', sidetrails:'Side trail'})[l.id] || l.name;
  const nm = l.id === 'lands' ? tcase(p.NAME) : featName(l, p); let h = `<h4>${esc(nm || 'Unnamed ' + kind.toLowerCase())}</h4>`;
  if (l.id === 'mland'){ if (p.Type) h += `<div><span class="k">Type</span> ${esc(p.Type === 'Agricultural Crop/Pasture' ? 'Farm field or pasture' : p.Type === 'Meadow/Field' ? 'Meadow or field' : p.Type)}</div>`; if (p.Acres > 0) h += `<div><span class="k">Acres</span> ${fmt(p.Acres, p.Acres < 100 ? 1 : 0)}</div>`; if (p.Trail_Club) h += `<div><span class="k">Club section</span> ${esc(p.Trail_Club)}</div>`; }
  if (l.id === 'lands'){ const ad = String(p.ADMIN == null ? '' : p.ADMIN).trim(), ac = p.ACRES == null || p.ACRES === '' ? NaN : +p.ACRES, tr = String(p.TRACT1 == null ? '' : p.TRACT1).trim();
    if (ad) h += `<div><span class="k">Administered by</span> ${esc(tcase(ad))}</div>`;
    if (isFinite(ac) && ac > 0) h += `<div><span class="k">Acres</span> ${fmt(ac, ac < 100 ? 1 : 0)}</div>`;
    if (tr) h += `<div><span class="k">Tract</span> ${esc(tr)}</div>`; }
  if (l.id === 'nrhp'){ if (p.nhl) h += `<div>National Historic Landmark</div>`; if (p.type) h += `<div><span class="k">Type</span> ${esc(p.type)}</div>`;
    if (p.listed) h += `<div><span class="k">Listed</span> ${esc(p.listed)}</div>`; if (p.city || p.state) h += `<div><span class="k">Place</span> ${esc([p.city, p.state].filter(Boolean).join(', '))}</div>`;
    if (p.refnum) h += `<div><a href="https://npgallery.nps.gov/AssetDetail/NRIS/${esc(p.refnum)}" target="_blank" rel="noopener">National Register record (NPGallery)</a></div>`; }
  if (l.id === 'osmcem'){ if (p.Source) h += `<div><span class="k">Source</span> ${esc(p.Source)}</div>`; if (p.Denomination) h += `<div><span class="k">Denomination</span> ${esc(p.Denomination)}</div>`;
    if (p.ld) h += `<div><span class="k">Land</span> ${esc((LANDMAP.get(p.ld) || [0, tcase(p.ld)])[1])}</div>`;
    if (p.osm) h += `<div><a href="https://www.openstreetmap.org/${esc(p.osm)}" target="_blank" rel="noopener">Open in OpenStreetMap</a></div>`;
    { const fg = histFag({nm:p.NAME, la:p.la, lo:p.lo, a:{fag:p.fag}}); if (fg) h += `<div>${fg}</div>`; } }
  if (l.id === 'vistas'){ const ph = []; for (let k = 1; k <= 10; k++){ const u = String(p['Photo' + k] || '').trim(); if (/^https?:\/\//i.test(u)) ph.push(u); }
    /* Google Drive links: show a small preview straight from Drive, loaded only when the popup opens. If Drive will not serve it, the preview removes itself and the button remains. */
    const did = u => { const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/) || u.match(/docs\.google\.com\/[^?#]*\/d\/([\w-]{20,})/); return m ? m[1] : null; };
    const first = ph.map(did).findIndex(x => x);
    if (first >= 0) h += `<a class="pthumb" href="${esc(ph[first])}" target="_blank" rel="noopener" title="Open the full photo"><img src="https://drive.google.com/thumbnail?id=${did(ph[first])}&sz=w480" alt="Photo of ${esc(nm || 'this vista')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>`;
    if (ph.length) h += '<div class="pbtns">' + ph.map((u, k) => `<a class="pbtn" href="${esc(u)}" target="_blank" rel="noopener">${ph.length === 1 ? 'View photo' : 'Photo ' + (k + 1)}</a>`).join('') + '</div>'; }
  return h; }
const featOpen = (l, p, latlng, offset) => L.popup(Object.assign({autoPan:false, maxWidth:260}, offset && {offset})).setLatLng(latlng).setContent(featPopup(l, p || {})).openOn(map);
function liveStatus(l, s){ l.status = s; const e = document.querySelector('#layerspanel [data-st="' + l.id + '"]'); if (e) e.textContent = s; }
const ICONZ = 9;
function liveDraw(l, feats){ l.group.clearLayers();
  if (l.type === 'pt'){ if (feats) l.feats = feats.filter(f => f.geometry && f.geometry.type === 'Point'); const z = map.getZoom(), b = map.getBounds().pad(.15), isz = Math.round(Math.min(34, Math.max(16, 16 + (z - ICONZ) * 3.5))); let n = 0;
    (l.feats || []).forEach(f => { const c = f.geometry.coordinates, ll = [c[1], c[0]]; let mk;
      if (z >= ICONZ){ if (!b.contains(ll) || n >= 700) return; n++; mk = L.marker(ll, {pane:'feat', keyboard:false, title:featName(l, f.properties || {}), icon:L.divIcon({className:'ficm', html:glyphHTML(l, isz), iconSize:[isz, isz], iconAnchor:[isz / 2, isz / 2]})}); }
      else mk = L.circleMarker(ll, {renderer:featR, pane:'feat', radius:Math.max(2.5, Math.min(5, z * .55 - .5)), color:'#fff', weight:1, fillColor:l.color, fillOpacity:1, bubblingMouseEvents:false});
      mk.on('click', () => featOpen(l, f.properties, mk.getLatLng(), [0, -6])).addTo(l.group); mk._p = f.properties || {}; mk._nm = featName(l, mk._p); }); }
  else L.geoJSON({type:'FeatureCollection', features:feats.filter(f => f.geometry)}, {renderer:l.type === 'poly' ? landsR : featR, pane:l.type === 'poly' ? 'lands' : 'feat', bubblingMouseEvents:false,
    style:f => l.id === 'mland' ? {color:MLCOL[(f.properties || {}).Type] || '#B5A33A', weight:1.8, fillColor:MLCOL[(f.properties || {}).Type] || '#B5A33A', fillOpacity:.45} : l.type === 'poly' ? {color:'#4A4A4A', weight:.6, fillColor:(LANDMAP.get((f.properties || {}).LEGEND3) || [0, 0, '#BBBBBB'])[2], fillOpacity:.5} : {color:l.color, weight:2.2, dashArray:'6 4', opacity:.95},
    onEachFeature:(f, ly) => { if (l.type === 'line') ly._nm = featName(l, f.properties || {}); return ly.on('click', e => featOpen(l, f.properties, e.latlng)); }}).addTo(l.group);
  labelSync(l); }
/* Keep a popup or the pinned value label clear of everything that sits on top of the map: the cell-size, Map tools, basemap and Map layers controls,
   the zoom buttons, an open layers list, the legend, and the details panel. The map is nudged just far enough to clear them. */
function keepClear(el){ if (!el || !el.getBoundingClientRect) return; const m = $('#map').getBoundingClientRect(), r = el.getBoundingClientRect(); if (!r.width) return;
  const obs = []; document.querySelectorAll('#ctlrow1 > *, #ctlrow2 > .mapctl, #note, .leaflet-control-zoom, #levels, #layers, #legend, #layerspanel, #profile.open').forEach(o => { if (o.hidden || o.offsetParent === null || (o.id === 'profile' && isPhone())) return; const q = o.getBoundingClientRect(); if (q.width && q.height && q.bottom > m.top && q.top < m.bottom) obs.push(q); });
  const g = 8; let sx = 0, sy = 0;
  const fits = (dx, dy) => r.left + dx >= m.left + 4 && r.right + dx <= m.right - 4 && r.top + dy >= m.top + 4 && r.bottom + dy <= m.bottom - 4;
  const clash = (dx, dy) => obs.find(q => r.left + dx < q.right + g && r.right + dx > q.left - g && r.top + dy < q.bottom + g && r.bottom + dy > q.top - g);
  for (let pass = 0; pass < 8; pass++){
    if (r.left + sx < m.left + 4) sx = m.left + 4 - r.left; if (r.right + sx > m.right - 4) sx = m.right - 4 - r.right;
    if (r.top + sy < m.top + 4) sy = m.top + 4 - r.top; if (r.bottom + sy > m.bottom - 4) sy = m.bottom - 4 - r.bottom;
    const q = clash(sx, sy); if (!q) break;
    const moves = [[q.right + g - r.left, sy], [q.left - g - r.right, sy], [sx, q.bottom + g - r.top], [sx, q.top - g - r.bottom]].filter(v => fits(v[0], v[1])).sort((a, b) => (Math.abs(a[0] - sx) + Math.abs(a[1] - sy)) - (Math.abs(b[0] - sx) + Math.abs(b[1] - sy)));
    const free = moves.find(v => !clash(v[0], v[1])) || moves[0]; if (!free) break; sx = free[0]; sy = free[1]; }
  if (Math.abs(sx) > 1 || Math.abs(sy) > 1) map.panBy([-sx, -sy], {animate:true, duration:.25}); }
map.on('popupopen', e => setTimeout(() => keepClear(e.popup.getElement()), 40));
/* A click on the map goes to a feature of a switched-on layer when one is under it (points within a fingertip, then side trails, then administrative areas). Only otherwise does it select a grid cell. */
function liveHit(latlng){ const cp = map.latLngToContainerPoint(latlng), tol = TOUCHDEV ? 20 : 11; let best = null, bd = Infinity, bl = null;
  const open = (l, p) => { featOpen(l, p, latlng); return true; };
  LIVE.forEach(l => { if (!l.on || l.type !== 'pt') return; l.group.eachLayer(m => { if (!m.getLatLng) return; const d = map.latLngToContainerPoint(m.getLatLng()).distanceTo(cp); if (d <= tol && d < bd){ bd = d; best = m; bl = l; } }); });
  if (best) return open(bl, best._p || {});
  const lp = map.latLngToLayerPoint(latlng);
  for (const l of LIVE){ if (!l.on || l.type !== 'line') continue; let hit = null; l.group.eachLayer(g => { if (g.eachLayer) g.eachLayer(ly => { if (!hit && ly.closestLayerPoint){ const c = ly.closestLayerPoint(lp); if (c && c.distance <= tol) hit = ly; } }); }); if (hit) return open(l, hit.feature ? hit.feature.properties || {} : {}); }
  for (const l of LIVE){ if (!l.on || l.type !== 'poly') continue; let hit = null; const inside = (ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){ const a = ring[i], b = ring[j]; if (((a.lat > latlng.lat) !== (b.lat > latlng.lat)) && (latlng.lng < (b.lng - a.lng) * (latlng.lat - a.lat) / (b.lat - a.lat) + a.lng)) c = !c; } return c; };
    const polyHit = ll => Array.isArray(ll[0]) && Array.isArray(ll[0][0]) ? ll.some(polyHit) : (Array.isArray(ll[0]) ? (inside(ll[0]) && !ll.slice(1).some(inside)) : inside(ll));
    l.group.eachLayer(g => { if (g.eachLayer) g.eachLayer(ly => { if (!hit && ly.getLatLngs && ly.getBounds().contains(latlng) && polyHit(ly.getLatLngs())) hit = ly; }); }); if (hit) return open(l, hit.feature ? hit.feature.properties || {} : {}); }
  return false; }
map.on('click', e => { if (S.drawing || Date.now() - S.boxAt < 450) return; if (liveHit(e.latlng) || segHit(e.latlng)) return;
  /* a big grid keeps empty cells off the canvas, so a click there is matched to its cell here */
  const lv = dispLevel(), ps = POLY[lv]; if (!ps || ps.length <= BIGGRID || !S.cells) return; const c = phCell(lv, e.latlng.lat, e.latlng.lng); if (c < 0) return;
  const oe = e.originalEvent || {}; if (S.picking || oe.shiftKey || oe.ctrlKey || oe.metaKey){ pickToggle(lv, c); return; } select(lv, c, false); });
/* Features of a switched-on layer are labelled with their names once the map is zoomed in far enough to read them. */
const LABELZ = 11;
/* One pass places every name label for all switched-on layers together, so none overlap:
   each side trail gets a single label however many segments it has, a label never covers another feature's icon,
   and a label that cannot be placed clear of the others (right, left, above, below) is left out until you zoom in. */
const LABELS = L.layerGroup().addTo(map); let labT = 0;
function labelSync(){ cancelAnimationFrame(labT); labT = requestAnimationFrame(labelAll); }
function labelAll(){ LABELS.clearLayers(); if (map.getZoom() < LABELZ) return; const b = map.getBounds().pad(.05), ctr = map.latLngToContainerPoint(map.getCenter()), cand = [], taken = [];
  LIVE.forEach((l, li) => { if (!l.on) return;
    if (l.type === 'pt') l.group.eachLayer(m => { if (!m.getLatLng) return; const ll = m.getLatLng(); if (!b.contains(ll)) return; const p = map.latLngToContainerPoint(ll); taken.push([p.x - 12, p.y - 12, p.x + 12, p.y + 12]); if (m._nm) cand.push({nm:m._nm, ll, p, r:13, pri:li}); });
    else if (l.type === 'line'){ const by = new Map(); /* trail name -> the segment in view nearest the middle of the screen */
      l.group.eachLayer(g => { if (g.eachLayer) g.eachLayer(ly => { if (!ly._nm || !ly.getBounds || !ly.getBounds().intersects(b)) return; let ll; try { ll = ly.getCenter(); } catch (e){ ll = ly.getBounds().getCenter(); } if (!b.contains(ll)) return;
        const p = map.latLngToContainerPoint(ll), d = p.distanceTo(ctr), cur = by.get(ly._nm); if (!cur || d < cur.d) by.set(ly._nm, {nm:ly._nm, ll, p, r:5, pri:li + 100, d}); }); });
      by.forEach(v => cand.push(v)); } });
  cand.sort((a, c) => a.pri - c.pri || a.p.y - c.p.y || a.p.x - c.p.x);
  const hit = bx => taken.some(t => bx[0] < t[2] && bx[2] > t[0] && bx[1] < t[3] && bx[3] > t[1]); let n = 0;
  for (const c of cand){ if (n >= 120) break; const w = Math.min(230, c.nm.length * 6.1 + 14), h = 18, x = c.p.x, y = c.p.y, g = c.r + 2;
    const opts = [['right', [x + g, y - h/2, x + g + w, y + h/2], [g - 6, 0]], ['left', [x - g - w, y - h/2, x - g, y + h/2], [-(g - 6), 0]], ['top', [x - w/2, y - g - h, x + w/2, y - g], [0, -(g - 6)]], ['bottom', [x - w/2, y + g, x + w/2, y + g + h], [0, g - 6]]];
    const o = opts.find(o => !hit(o[1])); if (!o) continue; taken.push(o[1]); n++;
    LABELS.addLayer(L.tooltip({permanent:true, direction:o[0], offset:o[2], className:'featlab', interactive:false, opacity:1}).setLatLng(c.ll).setContent(esc(c.nm))); } }
map.on('moveend zoomend', () => labelSync());
const FEATLIVE = [['shelters', 'Shelter'], ['campsites', 'Campsite'], ['privies', 'Privy'], ['parking', 'Parking'], ['bridges', 'Bridge'], ['vistas', 'Vista']];
let FEATGOT = null, FEATDONE = false, FEATRUN = false, FEATAT = null;
function featSync(){ if (FEATDONE) return; if (FEATGOT){ if (S.ext === 'corr') featApply(); return; } if (FEATRUN) return; FEATRUN = true;
  const one = url => arcQuery(url, {outFields:'Name,Type', geometryPrecision:6}).catch(() => arcQuery(url, {outFields:'Name', geometryPrecision:6}));
  Promise.allSettled(FEATLIVE.map(([id, t]) => one(LIVE.find(l => l.id === id).url).then(f => [t, f])))
    .then(rs => { const got = rs.filter(r => r.status === 'fulfilled').map(r => r.value); if (got.length){ FEATGOT = got; FEATAT = new Date(); if (S.ext === 'corr') featApply(); } }).then(() => { FEATRUN = false; }); }
function featApply(){ if (FEATDONE || !FEATGOT || S.ext !== 'corr' || !D.themes.feat) return; FEATDONE = true;
  const liveT = new Set(FEATGOT.map(x => x[0])), feats = D.feat.filter(f => !liveT.has(f[0]));
  for (const [t, fs] of FEATGOT) fs.forEach(g => { const c = g.geometry && g.geometry.coordinates; if (!c || c.length < 2) return; const p = g.properties || {};
    let det = String(p.Type == null ? '' : p.Type).trim(); if (['0', '1', '2', '3', '4', 'None', 'nan', 'No info', 'null'].includes(det)) det = '';
    feats.push([t, String(p.Name || t).trim() || t, det, Math.round(c[1] * 1e5) / 1e5, Math.round(c[0] * 1e5) / 1e5]); });
  const TY = FTYPES.map(x => x[0]);
  for (const lv of ['hex', 'cog', 'wheel']){ const T = D.themes.feat[lv]; if (!T) continue; const n = D.levels[lv].id.length, lists = new Map();
    feats.forEach((f, i) => { const c = phCell(lv, f[3], f[4]); if (c < 0) return; let a = lists.get(c); if (!a) lists.set(c, a = []); a.push(i); });
    const row = ROW.feat[lv], add = [...lists.keys()].filter(c => row[c] < 0);
    if (add.length){ add.forEach(c => { T.ix.push(c); for (const k in T.f) T.f[k].push(Array.isArray(T.f[k][0]) ? [] : 0); });
      const a = new Int32Array(n).fill(-1); T.ix.forEach((c, k) => a[c] = k); ROW.feat[lv] = a; }
    T.ix.forEach((c, r) => { const L = lists.get(c) || [], cnt = {}; L.forEach(i => cnt[feats[i][0]] = (cnt[feats[i][0]] || 0) + 1); T.f.LIST[r] = L;
      TY.forEach(t => { const k = 'N_' + t.toUpperCase(); if (T.f[k]) T.f[k][r] = cnt[t] || 0; });
      if (T.f.N_FAC) T.f.N_FAC[r] = TY.filter(t => t !== 'Vista').reduce((s, t) => s + (cnt[t] || 0), 0); }); }
  D.feat = feats; FIDX = null; BRK.clear(); for (const k in RESTC) delete RESTC[k];
  redraw(); if (S.cell != null || S.box) profile(); }
let ACQ = null, acqTimer = null;
const ACQURL = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/AT_Lands/FeatureServer/1';
function acqLoad(){ if (ACQ) return; ACQ = {st:'loading', n:0};
  (async () => { const fs = await arcQuery(ACQURL, {where:"CONVEYED > DATE '1901-01-01'", outFields:'CONVEYED,ACRES,ADMIN,TRACT1,ESTATE', geometryPrecision:5, maxAllowableOffset:0.0002}, 10);
    const lvs = ['hex', 'cog', 'wheel'], cy = {hex:new Map(), cog:new Map(), wheel:new Map()}, tr = [];
    const inPoly = (la, lo, rings) => { let ins = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
    for (let k = 0; k < fs.length; k++){ const f = fs[k], p = f.properties || {}, g = f.geometry; if (!g || p.CONVEYED == null) continue;
      const y = new Date(p.CONVEYED).getUTCFullYear(), ac = +p.ACRES || 0; if (!(y > 1901) || !(ac > 0)) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; if (!polys.length) continue;
      tr.push({y, ac, adm:p.ADMIN || '', tract:p.TRACT1 || '', est:p.ESTATE || ''});
      /* sample points on a grid inside the tract; its acres are shared among the cells the points fall in */
      const hits = lvs.map(() => new Map()); let n = 0;
      for (const rings of polys){ let s = 90, n0 = 90, w = 180, e = -180; rings[0].forEach(([x, yy]) => { s = Math.min(s, yy); n0 = Math.max(n0 === 90 ? -90 : n0, yy); w = Math.min(w, x); e = Math.max(e, x); });
        const st = Math.max(0.0003, Math.sqrt((n0 - s) * (e - w) / 64));
        for (let la = s + st / 2; la < n0; la += st) for (let lo = w + st / 2; lo < e; lo += st) if (inPoly(la, lo, rings)){ n++; lvs.forEach((lv, i) => { const c = phCell(lv, la, lo); if (c >= 0) hits[i].set(c, (hits[i].get(c) || 0) + 1); }); } }
      if (!n){ const r0 = polys[0][0], la = r0.reduce((t, q) => t + q[1], 0) / r0.length, lo = r0.reduce((t, q) => t + q[0], 0) / r0.length; n = 1;
        lvs.forEach((lv, i) => { const c = phCell(lv, la, lo); if (c >= 0) hits[i].set(c, 1); }); }
      lvs.forEach((lv, i) => hits[i].forEach((m, c) => { let Y = cy[lv].get(c); if (!Y) cy[lv].set(c, Y = new Map()); Y.set(y, (Y.get(y) || 0) + ac * m / n); }));
      if (k % 150 === 0){ ACQ.n = k; acqStatusOnly(); await new Promise(r => setTimeout(r)); } }
    const ys = tr.map(t => t.y), y0 = Math.min(...ys), y1 = Math.max(...ys), by = new Map();
    tr.forEach(t => { const e = by.get(t.y) || {ac:0, n:0}; e.ac += t.ac; e.n++; by.set(t.y, e); });
    Object.assign(ACQ, {st:'done', cy, tracts:tr, y0, y1, by, cum:{}, total:tr.reduce((s, t) => s + t.ac, 0), at:new Date()});
    if (!S.acqYr || S.acqYr > y1 || S.acqYr < y0) S.acqYr = y1;
    /* fixed classes from the final totals, so colors mean the same thing in every year */
    ACQ.brk = {}; for (const lv of lvs){ const a = [...acqCum(lv, y1)].filter(v => v >= 1).sort((p, q) => p - q), q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))];
      let b = a.length ? [.35, .6, .8, .93].map(f => Math.max(1, Math.round(niceNum(q(f))))) : []; b = b.filter((v, i) => i === 0 || v > b[i - 1]); ACQ.brk[lv] = b; }
    { const a = [...acqCum('wheel', y1)].filter(v => v >= 1).sort((p, q) => p - q); ACQ.stripMax = a.length ? a[Math.min(a.length - 1, Math.floor(.95 * a.length))] : 1; }
    if (S.q.id === 'land' && S.m.id === 'acq'){ BRK.clear(); redraw(); side(); phTick(); } })()
  .catch(e => { ACQ = {st:'error', msg:e.message}; if (S.q.id === 'land' && S.m.id === 'acq') side(); }); }
function acqTop(lv){ if (!ACQ || ACQ.st !== 'done') return 1; ACQ.top = ACQ.top || {}; if (ACQ.top[lv]) return ACQ.top[lv];
  const a = acqCum(lv, ACQ.y1), L_ = D.levels[lv], s = new Float64Array(NB), n = new Uint32Array(NB);
  for (let c = 0; c < L_.id.length; c++){ if (a[c] < 0.5) continue; const i = Math.min(NB - 1, Math.floor(L_.mi[c] / BIN)); s[i] += Math.round(a[c]); n[i]++; }
  let mx = 1; for (let i = 0; i < NB; i++) if (n[i]) mx = Math.max(mx, s[i] / n[i]); return ACQ.top[lv] = mx; }
function acqCum(lv, y){ const key = lv + y; if (ACQ.cum[key]) return ACQ.cum[key]; const n = D.levels[lv].id.length, a = new Float64Array(n);
  ACQ.cy[lv].forEach((Y, c) => { let t = 0; Y.forEach((ac, yy) => { if (yy <= y) t += ac; }); a[c] = t; }); return ACQ.cum[key] = a; }
function acqVal(lv, c){ if (S.ext !== 'corr') return null; if (!ACQ){ acqLoad(); return null; } if (ACQ.st !== 'done') return null;
  const v = acqCum(lv, S.acqYr || ACQ.y1)[c]; return v >= 0.5 ? Math.round(v) : null; }
/* visitation: observer-days per year, one year at a time (S.visYr) or the recent average; fixed classes so colors mean the same in every year */
const VISRAMP = RAMP.eff;
function visYears(){ const t = D.themes.vis && D.themes.vis.wheel; if (!t || !t.f.VIS_OD_Y) return null; let a = 9999, b = 0; t.f.VIS_OD_Y.forEach(p => { if (p) for (let k = 0; k < p.length; k += 2){ a = Math.min(a, p[k]); b = Math.max(b, p[k]); } }); return b ? [a, b] : null; }
function visList(lv, c, f){ const a = val('vis', f, lv, c); if (a || !has('vis', lv, c)) return a; const t = D.themes.vis[lv]; if (!t || t.f[f]) return null;
  const p = parentOf(lv, c); if (!p || !has('vis', p[0], p[1])) return null; const b = val('vis', f, p[0], p[1]); if (!b) return null;
  const r = val('vis','VIS_OD',lv,c) || 0, q = val('vis','VIS_OD',p[0],p[1]), k = q ? r / q : 0;
  if (f === 'VIS_OD_Y') return b.map((x, i) => i % 2 ? x * k : x);
  if (f === 'VIS_OD_M' || f === 'VIS_LD_M') return b.map(x => x * k);
  return null; }
/* busiest days: each cell's own list, or the surrounding 7 sq mi cell's (counted once) where a square mile has none */
function visBusyLists(lv, cells){ const out = [], seen = new Set(); let via = false;
  cells.forEach(c => { const a = val('vis','VIS_BUSY_TOP',lv,c); if (a){ out.push(a); return; } if (!has('vis', lv, c) || (D.themes.vis[lv] && D.themes.vis[lv].f.VIS_BUSY_TOP)) return;
    const p = parentOf(lv, c); if (!p || seen.has(p[1])) return; seen.add(p[1]); const b = val('vis','VIS_BUSY_TOP',p[0],p[1]); if (b){ out.push(b); via = true; } });
  return [out, via]; }
let VISFULL = null;
function visFull(){ const m = typeof BIO !== 'undefined' && BIO && BIO.meta && BIO.meta.vis; if (m && m.complete_through) return m.complete_through; if (VISFULL) return VISFULL;
  let mx = ''; for (const lv of ['wheel','cog','hex']){ const t = D.themes.ebird && D.themes.ebird[lv]; if (t && t.f.LAST_OBS){ t.f.LAST_OBS.forEach(x => { if (x && String(x) > mx) mx = String(x); }); break; } }
  const now = new Date().getFullYear() - 1; if (!mx) return now; const y = +mx.slice(0, 4); VISFULL = Math.min(now, mx.slice(5, 10) === '12-31' ? y : y - 1); return VISFULL; }
/* observer-days in an average recent year: the last three years with eBird as well as iNaturalist and EDDMapS */
function visRecent(lv, c){ const p = visList(lv, c, 'VIS_OD_Y'); if (!p) return val('vis','VIS_OD_YR',lv,c); const F = visFull(); let s = 0;
  for (let k = 0; k < p.length; k += 2) if (p[k] >= F - 2 && p[k] <= F) s += p[k + 1]; return s / 3; }
function visYearVal(lv, c, y){ const p = visList(lv, c, 'VIS_OD_Y'); if (!p) return has('vis', lv, c) ? null : null; for (let k = 0; k < p.length; k += 2) if (p[k] === y) return p[k + 1]; return 0; }
function visRaw(lv, c){ if (!has('vis', lv, c)) return null; return S.visYr ? visYearVal(lv, c, S.visYr) : visRecent(lv, c); }
function visOD(lv, c){ const r = visRaw(lv, c); return S.visAdj ? visIdx(r, lv, S.visYr) : r; }
const VISBRK = {};
function visBrk(lv){ const key = lv + '|' + S.ext + '|' + (S.visAdj ? 'i' : 'n'); if (VISBRK[key] && VISBRK[key].lev === D.levels[lv]) return VISBRK[key].b; const t = D.themes.vis && D.themes.vis[lv], a = [];
  if (t){ if (t.f.VIS_OD_Y) t.f.VIS_OD_Y.forEach(p => { if (p) for (let k = 1; k < p.length; k += 2) if (p[k] > 0) a.push(S.visAdj ? visIdx(p[k], lv, p[k - 1]) : p[k]); }); else (t.f.VIS_OD_YR || []).forEach(v => { if (v > 0) a.push(S.visAdj ? visIdx(v, lv, null) : v); }); }
  for (let i = a.length - 1; i >= 0; i--) if (a[i] == null) a.splice(i, 1);
  a.sort((p, q) => p - q); const q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))];
  let b = a.length ? [.35, .6, .8, .93].map(f => Math.max(1, Math.round(niceNum(q(f))))) : []; b = b.filter((v, i) => i === 0 || v > b[i - 1]);
  VISBRK[key] = {lev:D.levels[lv], b}; return b; }
function visCol(v, lv){ const b = visBrk(lv); let i = 0; while (i < b.length && v > b[i]) i++; return VISRAMP[Math.round(i * (VISRAMP.length - 1) / Math.max(1, b.length))]; }
function visLegend(lv){ const b = visBrk(lv), lab = []; b.forEach((v, i) => lab.push(i === 0 ? `1 to ${fmt(v, 0)}` : `${fmt(b[i - 1] + 1, 0)} to ${fmt(v, 0)}`)); lab.push(b.length ? `over ${fmt(b[b.length - 1], 0)}` : 'any');
  if (!b.length) return '<p class="sub">The visitation summaries have not been built yet. They are added the next time the iNaturalist workflow runs.</p>';
  return lab.map((t, i) => `<div class="row"><i style="background:${VISRAMP[Math.round(i * (VISRAMP.length - 1) / Math.max(1, b.length))]}"></i><span>${t}${S.visAdj ? '' : ' observer-days'}</span></div>`).join('') +
    `<p class="sub">${S.visAdj ? 'Visitation index: observer-days as a share of the average cell’s, 100 = average, ' + (S.visYr ? 'in ' + S.visYr : 'over the latest three years with eBird data') + '. Adjusted for growth in iNaturalist use.' : (S.visYr ? 'Observer-days in ' + S.visYr : 'Observer-days per year, average of the latest three years with eBird data') + ', per cell.'} Classes stay the same in every year.</p>`; }
function visTop(lv){ const b = visBrk(lv); return b.length ? b[b.length - 1] * 1.4 : 1; }
let visTimer = null; S.visAdj = false;
const VISTOT = {};
function visTot(lv, y){ const key = lv + '|' + S.ext + '|' + (y || 'avg'); const t = D.themes.vis && D.themes.vis[lv]; if (!t) return null;
  if (VISTOT[key] && VISTOT[key].lev === D.levels[lv]) return VISTOT[key].v; let s = 0, ok = false;
  if (y){ if (t.f.VIS_OD_Y){ ok = true; t.f.VIS_OD_Y.forEach(p => { if (p) for (let k = 0; k < p.length; k += 2) if (p[k] === y) s += p[k + 1]; }); }
    else if (lv === 'hex' && D.themes.vis.cog && D.themes.vis.cog.f.VIS_OD_Y){ ok = true; const n = D.levels[lv].id.length; for (let c = 0; c < n; c++){ const p = visList(lv, c, 'VIS_OD_Y'); if (p) for (let k = 0; k < p.length; k += 2) if (p[k] === y) s += p[k + 1]; } } }
  else { ok = true; (t.f.VIS_OD_YR || []).forEach(v => s += v || 0); }
  const v = ok && s > 0 ? s / D.levels[lv].id.length : null; VISTOT[key] = {lev:D.levels[lv], v}; return v; }
const visIdx = (raw, lv, y) => { if (raw == null) return null; const a = visTot(lv, y); return a ? 100 * raw / a : null; };
function visCtl(){ const yr = visYears(); if (!yr) return '<p class="phstat">The yearly animation appears once the visitation summaries are built.</p>'; const y = S.visYr || yr[1];
  return `<div class="acqctl"><button type="button" class="phplay" data-visplay="1" aria-pressed="${!!visTimer}">${visTimer ? 'Pause' : 'Play years'}</button>` +
    `<label class="acqyr"><span id="visyl">${S.visYr ? 'In ' + S.visYr : 'Average'}</span><input type="range" id="visyr" min="${yr[0]}" max="${yr[1]}" step="1" value="${y}" aria-label="Year"></label>` +
    (S.visYr && !visTimer ? '<button type="button" class="lbtn" data-visavg="1">Show the recent average</button>' : '') + `</div>`; }
function visFrame(full){ const l = $('#visyl'), r = $('#visyr'); if (l) l.textContent = S.visYr ? 'In ' + S.visYr : 'Average'; if (r && S.visYr) r.value = S.visYr;
  BRK.clear(); restyle(); strip(); legend(); phTick(); qVizRefresh(); if (full) side(); }
function visPlay(on){ if (visTimer){ clearInterval(visTimer); visTimer = null; } const yr = visYears();
  if (on && yr){ if (!S.visYr || S.visYr >= yr[1]) S.visYr = yr[0] - 1;
    visTimer = setInterval(() => { if (S.q.id !== 'eff' || S.m.id !== 'od'){ clearInterval(visTimer); visTimer = null; return; }
      if (S.visYr >= yr[1]){ visPlay(false); return; } S.visYr++; visFrame(); }, 800); }
  const b = document.querySelector('[data-visplay]'); if (b){ b.textContent = visTimer ? 'Pause' : 'Play years'; b.setAttribute('aria-pressed', String(!!visTimer)); }
  if (!on) visFrame(true); }
document.addEventListener('click', e => { if (e.target.closest('[data-visplay]')) visPlay(!visTimer); else if (e.target.closest('[data-visavg]')){ S.visYr = null; visFrame(true); } });
document.addEventListener('input', e => { if (e.target.id === 'visyr'){ if (visTimer) visPlay(false); S.visYr = +e.target.value; visFrame(); } });
document.addEventListener('change', e => { if (e.target.id === 'visyr') side(); if (e.target.id === 'visadj'){ S.visAdj = e.target.checked; BRK.clear(); redraw(); side(); } });
const ACQRAMP = ['#38A3FF','#3D7BF5','#5A5CEB','#7A44DB','#9430C9'];
function acqCol(v, lv){ const b = (ACQ && ACQ.brk && ACQ.brk[lv]) || [], cols = ACQRAMP; let i = 0; while (i < b.length && v > b[i]) i++;
  return cols[Math.round(i * (cols.length - 1) / Math.max(1, b.length))]; }
function acqLegend(lv){ if (!ACQ || ACQ.st !== 'done') return `<p class="sub">${ACQ && ACQ.st === 'error' ? 'The administrative areas layer could not be reached.' : 'Loading the A.T. tracts…'}</p>`;
  const b = ACQ.brk[lv] || [], cols = ACQRAMP, lab = []; b.forEach((v, i) => lab.push(i === 0 ? `1 to ${fmt(v, 0)} acres` : `${fmt(b[i - 1] + 1, 0)} to ${fmt(v, 0)} acres`)); lab.push(b.length ? `over ${fmt(b[b.length - 1], 0)} acres` : 'any acres');
  return lab.map((t, i) => `<div class="row"><i style="background:${cols[Math.round(i * (cols.length - 1) / Math.max(1, b.length))]}"></i><span>${t}</span></div>`).join('') +
    `<p class="sub">Acres conveyed by ${S.acqYr || ACQ.y1}, per cell. Classes stay the same in every year.</p>`; }
function acqStatus(){ if (!ACQ) return 'Loading the A.T. tracts…'; if (ACQ.st === 'loading') return `Loading the A.T. tracts from the administrative areas layer… ${ACQ.n ? fmt(ACQ.n, 0) + ' placed' : ''}`;
  if (ACQ.st === 'error') return 'The administrative areas layer could not be reached just now (' + esc(ACQ.msg || '') + ').';
  return `${fmt(ACQ.tracts.length, 0)} tracts with a conveyance date, ${fmt(ACQ.total, 0)} acres, ${ACQ.y0} to ${ACQ.y1}, loaded live from the A.T. administrative areas layer. Tracts without a recorded date are left out.`; }
function acqStatusOnly(){ const e = $('#acqstat'); if (e) e.textContent = acqStatus(); }
function acqBlock(){ if (S.ext !== 'corr') return '<p class="none">Land protection is mapped for the A.T. corridor only.</p>'; if (!ACQ) acqLoad();
  const ok = ACQ && ACQ.st === 'done', y = ok ? S.acqYr || ACQ.y1 : 0;
  return `<div class="acqctl">` + (ok ? `<button type="button" class="phplay" data-acqplay="1" aria-pressed="${!!acqTimer}">${acqTimer ? 'Pause' : 'Play'}</button>` +
    `<label class="acqyr"><span id="acqyl">By ${y}</span><input type="range" id="acqyr" min="${ACQ.y0}" max="${ACQ.y1}" step="1" value="${y}" aria-label="Year"></label>` : '') + `</div>` +
    `<p class="phstat" id="acqstat" role="status">${esc(acqStatus())}</p>`; }
/* ---------- chart text at a readable size ----------
   The charts are drawn in small coordinate systems (viewBox) and stretched to the panel's width, so on wide panels their labels
   came out oversized. This measures how much each chart is stretched and resizes its text to read at about 10.5px everywhere.
   It runs from a MutationObserver, which fires before the browser paints, so the resized text is the only text ever shown. */
function chFit(){ document.querySelectorAll('svg.phch').forEach(sv => { const vb = sv.viewBox && sv.viewBox.baseVal, w = sv.clientWidth || sv.getBoundingClientRect().width;
    if (!vb || !vb.width || !w) return; const key = Math.round(100 * w / vb.width); if (+sv.dataset.fitk === key) return; sv.dataset.fitk = key; const k = key / 100;
    sv.querySelectorAll('text').forEach(t => { let b = +t.dataset.fs; if (!b){ b = parseFloat(t.getAttribute('font-size')) || 9; t.dataset.fs = b; }
      const r = b * k, want = r > 11.5 ? 11.5 : r < 8.5 ? Math.min(8.5, r * 1.25) : r;   /* shrink outsized text; nudge tiny text up a little */
      t.setAttribute('font-size', (want / k).toFixed(2)); }); }); }
{ new MutationObserver(chFit).observe(document.body, {childList:true, subtree:true});
  let chT = 0; addEventListener('resize', () => { clearTimeout(chT); chT = setTimeout(() => { document.querySelectorAll('svg.phch').forEach(sv => delete sv.dataset.fitk); chFit(); }, 150); }); }
function acqChart(){ if (!ACQ || ACQ.st !== 'done') return '<p class="phstat">The chart appears once the tracts have loaded.</p>';
  const ys = []; for (let y = ACQ.y0; y <= ACQ.y1; y++) ys.push(y); const sel = S.acqYr || ACQ.y1;
  const W = 272, H = 150, pl = 34, pr = 34, pt = 12, pb = 18, pw = W - pl - pr, ph = H - pt - pb, bw = pw / ys.length, f = v => v.toFixed(1);
  const per = ys.map(y => (ACQ.by.get(y) || {ac:0}).ac); let c = 0; const cum = per.map(v => c += v);
  const mx = Math.max(1, ...per), sp = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000].find(s => mx / s <= 4) || 50000, top = Math.ceil(mx / sp) * sp, tot = cum[cum.length - 1] || 1;
  const Y = v => pt + ph - ph * v / top, Yc = v => pt + ph - ph * v / tot, X = i => pl + bw * i + bw / 2;
  let g = `<svg class="phch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Acres of A.T. tracts conveyed each year">`;
  for (let v = 0; v <= top; v += sp) g += `<line x1="${pl}" x2="${W - pr}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="${v ? '#2E4460' : '#4A6182'}" stroke-width="${v ? .6 : .9}"/><text x="${pl - 3}" y="${f(Y(v) + 3)}" text-anchor="end" font-size="8.5" fill="#A8B8CA">${v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : v}${v && v + sp > top ? ' ac' : ''}</text>`;
  [0, .5, 1].forEach(fr => { g += `<text x="${W - pr + 3}" y="${f(Yc(tot * fr) + 3)}" font-size="8.5" fill="#7FE0B8">${fmt(Math.round(tot * fr / 1000), 0)}k</text>`; });
  ys.forEach((y, i) => { if (!per[i]) return; const y0 = Y(per[i]), on = y === sel;
    g += `<rect x="${f(pl + bw * i + .4)}" y="${f(y0)}" width="${f(Math.max(.8, bw - .8))}" height="${f(Y(0) - y0)}" fill="${on ? '#FFFFFF' : HUE.lands}" opacity="${y > sel ? .3 : 1}"><title>${y}: ${fmt(Math.round(per[i]), 0)} acres in ${(ACQ.by.get(y) || {n:0}).n} tracts</title></rect>`; });
  g += `<polyline points="${ys.map((y, i) => f(X(i)) + ',' + f(Yc(cum[i]))).join(' ')}" fill="none" stroke="#7FE0B8" stroke-width="1.6"/>`;
  { const i = ys.indexOf(sel); if (i >= 0) g += `<circle cx="${f(X(i))}" cy="${f(Yc(cum[i]))}" r="3" fill="#FFFFFF" stroke="#7FE0B8"/>`; }
  ys.forEach((y, i) => { if (y % 5) return; g += `<text x="${f(X(i))}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="${y === sel ? '#FFE014' : '#A8B8CA'}">${y % 10 === 0 ? y : '’' + String(y).slice(2)}</text>`; });   /* fixed ticks: the playing year is shown by the white bar, dot and caption */
  const i = ys.indexOf(sel), byN = ACQ.tracts.filter(t => t.y <= sel).length;
  return `<h4 class="phh">Acres conveyed each year, the whole trail</h4><p class="phflow acqsub">By ${sel}: ${fmt(Math.round(cum[i]), 0)} acres · ${fmt(byN, 0)} tracts · ${Math.round(100 * cum[i] / tot)}% of the dated acres · ${fmt(Math.round(per[i]), 0)} acres in ${sel} itself</p>` + g + '</svg>' +
    `<div class="phkey"><span class="thin"><i style="background:${HUE.lands}"></i>acres conveyed that year · <i style="background:#7FE0B8"></i>running total (right axis)</span></div>`; }
function acqFrame(full){ const y = S.acqYr, l = $('#acqyl'), r = $('#acqyr'), v = $('#acqviz'); if (l) l.textContent = 'By ' + y; if (r) r.value = y;
  if (v) v.innerHTML = acqChart(); BRK.clear(); restyle(); strip(); legend(); phTick(); if (full) side(); }
function acqPlay(on){ if (acqTimer){ clearInterval(acqTimer); acqTimer = null; }
  if (on && ACQ && ACQ.st === 'done'){ if (S.acqYr >= ACQ.y1) S.acqYr = ACQ.y0 - 1;
    acqTimer = setInterval(() => { if (S.q.id !== 'land' || S.m.id !== 'acq'){ clearInterval(acqTimer); acqTimer = null; return; }   /* another measure was picked */
      if (S.acqYr >= ACQ.y1){ acqPlay(false); return; } S.acqYr++; acqFrame(); }, 800); }
  const b = document.querySelector('[data-acqplay]'); if (b){ b.textContent = acqTimer ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', String(!!acqTimer)); }
  if (!on) acqFrame(true); }
document.addEventListener('click', e => { if (e.target.closest('[data-acqplay]')) acqPlay(!acqTimer); });
document.addEventListener('input', e => { if (e.target.id === 'acqyr'){ if (acqTimer) acqPlay(false); S.acqYr = +e.target.value; acqFrame(); } });
document.addEventListener('change', e => { if (e.target.id === 'acqyr') side(); });
async function liveLoad(l){ if (!l.on) return; const my = ++l.req, z = map.getZoom(); if (l.local) return histLayer(l, my);
  if (l.file){ if (!l.loaded){ liveStatus(l, 'Loading…'); try { const j = await (await fetch(l.file)).json(); if (my !== l.req) return; liveDraw(l, j.features); l.loaded = true; liveStatus(l, fmt(j.features.length, 0) + ' meadows, fields, farm fields and balds'); } catch (e){ liveStatus(l, 'Could not load this layer just now'); } } return; }
  try {
    if (l.bbox){ if (z < l.minZoom){ l.group.clearLayers(); liveStatus(l, 'Zoom in to see these'); return; }
      liveStatus(l, 'Loading…'); const b = map.getBounds().pad(.15), px = (b.getEast() - b.getWest()) / (map.getSize().x * 1.3); await arcMeta(l);
      const f = await arcQuery(l.url, {geometry:[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','), geometryType:'esriGeometryEnvelope', inSR:4326, spatialRel:'esriSpatialRelIntersects', outFields:l.fields || '*', maxAllowableOffset:px.toFixed(7), geometryPrecision:6}, 3);
      if (my !== l.req) return; liveDraw(l, f); liveStatus(l, f.length ? fmt(f.length, 0) + ' in view' + (l.id === 'lands' ? '. Click an area for its details. Switch this layer off to select grid cells here.' : '') : 'None in view'); return; }
    if (!l.loaded){ liveStatus(l, 'Loading…'); const [f] = await Promise.all([arcQuery(l.url, {outFields:'*', geometryPrecision:6}), arcMeta(l)]); if (my !== l.req) return; liveDraw(l, f); l.loaded = true; liveStatus(l, fmt(f.length, 0) + ' along the trail'); }
  } catch (e){ if (my === l.req) liveStatus(l, 'Could not load this layer just now'); } }
function liveToggle(l, on){ l.on = on; if (on){ l.group.addTo(map); liveLoad(l); if (l.type === 'pt' && l.loaded) liveDraw(l); } else { map.removeLayer(l.group); l.req++; liveStatus(l, ''); } labelSync(); layersUI(); writeHash(); }
function layersUI(){ const n = LIVE.filter(l => l.on).length; $('#layerstog span').innerHTML = (document.body.classList.contains('stackui') ? 'Layers' : 'Map layers') + (n ? ` <b>${n}</b>` : '');
  const lk = $('#landkey'); if (lk) lk.hidden = !LIVE.find(l => l.id === 'lands').on; const mk = $('#mlkey'); if (mk) mk.hidden = !LIVE.find(l => l.id === 'mland').on; }
$('#layerspanel').innerHTML = `<label><input type="checkbox" id="stlines"${stOn ? ' checked' : ''}><i class="ln" style="background:#C4A57C;justify-self:center"></i><span>State lines</span><span class="st"></span></label>` + LIVE.map(l => `<label><input type="checkbox" data-live="${l.id}">${l.type === 'pt' ? glyphHTML(l, 18) : `<i class="${l.type === 'poly' ? 'sq' : 'ln'}" style="background:${l.color};justify-self:center"></i>`}<span>${l.name}</span><span class="st" data-st="${l.id}"></span></label>` +
  (l.id === 'mland' ? `<div class="lk" id="mlkey" hidden>${[['Meadow/Field','Meadow or field'],['Agricultural Crop/Pasture','Farm field or pasture'],['Bald','Bald']].map(k => `<div><i style="background:${MLCOL[k[0]]}"></i><span>${k[1]}</span></div>`).join('')}</div>` : '') + (l.id === 'lands' ? `<div class="lk" id="landkey" hidden>${LANDKEY.map(k => `<div><i style="background:${k[2]}"></i><span>${k[1]}</span></div>`).join('')}</div>` : '')).join('') +
  '<p>State lines: APPA AT_States layer. Maintained landscapes: A.T. facilities inventory. The other layers load live from the National Park Service and Appalachian Trail Conservancy map services.</p>';
$('#layerspanel').addEventListener('change', e => { const l = LIVE.find(x => x.id === e.target.dataset.live); if (l) liveToggle(l, e.target.checked); });
$('#layerstog').onclick = () => { const p = $('#layerspanel'); p.hidden = !p.hidden; $('#layerstog').setAttribute('aria-expanded', !p.hidden); };
{ let lt; map.on('moveend', () => { clearTimeout(lt); lt = setTimeout(() => LIVE.forEach(l => { if (!l.on) return; if (l.bbox) liveLoad(l); else if (l.type === 'pt' && l.loaded){ liveDraw(l); } else labelSync(l); }), 350); }); }
/* squared distance, in rough degrees, from a point to the trail line the page is drawing */
function trailDist(la, lo){ const k = Math.cos(la * Math.PI / 180), lines = trailLine.getLatLngs(); let best = Infinity;
  const seg = (a, b) => { const ax = (a.lng - lo) * k, ay = a.lat - la, bx = (b.lng - lo) * k, by = b.lat - la, dx = bx - ax, dy = by - ay, L2 = dx*dx + dy*dy; let u = L2 ? -(ax*dx + ay*dy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u; const x = ax + u*dx, y = ay + u*dy; return x*x + y*y; };
  const walk = arr => { if (!arr.length) return; if (Array.isArray(arr[0])){ arr.forEach(walk); return; } for (let i = 1; i < arr.length; i++){ if (Math.abs(arr[i].lat - la) > .3 && Math.abs(arr[i-1].lat - la) > .3) continue; const d = seg(arr[i-1], arr[i]); if (d < best) best = d; } };
  walk(lines); return best; }
let MILEP = null;
function milePts(){ if (!MILEP) MILEP = arcQuery(SVC + 'MilePointsFromSpringer/FeatureServer/0', {outFields:'MileNumber', geometryPrecision:5}).then(f => {
    const raw = f.filter(x => x.geometry && x.geometry.type === 'Point' && x.properties && x.properties.MileNumber != null && isFinite(+x.properties.MileNumber)).map(x => [x.geometry.coordinates[1], x.geometry.coordinates[0], Math.round(+x.properties.MileNumber * 10) / 10]);
    const by = new Map(); raw.forEach(p => { const g = by.get(p[2]); if (g) g.push(p); else by.set(p[2], [p]); });
    /* a mile with several markers keeps the one nearest the trail line */
    const pts = [...by.values()].map(g => g.length === 1 ? g[0] : g.map(p => [trailDist(p[0], p[1]), p]).sort((a,b) => a[0] - b[0])[0][1]).sort((a,b) => a[2] - b[2]);
    if (!pts.length) throw new Error('no markers'); return pts; }).catch(e => { MILEP = null; throw e; });
  return MILEP; }
/* Give every cell the MileNumber of its nearest official marker, then move the region and club bands and the graph onto the same scale. */
function alignMiles(pts){ if (pts.length < 1500) return; const old = D.levels.wheel.mi.slice();
  for (const lv of ['hex','cog','wheel']){ const L_ = D.levels[lv];
    for (let c = 0; c < L_.id.length; c++){ const la = L_.c[c][0], lo = L_.c[c][1], k = Math.cos(la * Math.PI / 180); let best = Infinity, bm = L_.mi[c];
      for (let i = 0; i < pts.length; i++){ const dy = pts[i][0] - la, dx = (pts[i][1] - lo) * k, d = dx*dx + dy*dy; if (d < best){ best = d; bm = pts[i][2]; } }
      L_.mi[c] = bm; } }
  const pairs = old.map((m, i) => [m, D.levels.wheel.mi[i]]).sort((a,b) => a[0] - b[0]);
  const mapMi = x => { let lo = 0, hi = pairs.length - 1; while (lo < hi){ const m = (lo + hi) >> 1; if (pairs[m][0] < x) lo = m + 1; else hi = m; }
    const w = pairs.slice(Math.max(0, lo - 2), lo + 3).map(p => p[1]).sort((a,b) => a - b); return w[w.length >> 1]; };
  D.totalMi = Math.round((pts[pts.length - 1][2] + .5) * 10) / 10;
  D.regions.forEach((r, i) => { r[2] = i === D.regions.length - 1 ? D.totalMi : mapMi(r[2]); r[1] = i === 0 ? 0 : D.regions[i - 1][2]; });
  D.clubs.forEach(c => { c[1] = mapMi(c[1]); c[2] = mapMi(c[2]); });
  NB = Math.ceil(D.totalMi / BIN); S.milesOfficial = true;
  side(); strip(); pinSync(); refreshProfile(); }
/* Mile markers are switched off until the source layer is cleaned up. Set this to true to bring back the marker-based mileage. */
const USE_MILE_MARKERS = false;
if (USE_MILE_MARKERS) milePts().then(alignMiles).catch(() => {});
/* the trail line itself: refreshed from the official centerline service, keeping the built-in line if that fails */
arcQuery(SVC + 'ANST_Centerline/FeatureServer/0', {outFields:'OBJECTID', maxAllowableOffset:'0.0003', geometryPrecision:5}).then(f => { const lines = [];
  f.forEach(x => { const g = x.geometry; if (!g) return; (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]).forEach(c => { if (c.length > 1) lines.push(c.map(p => [p[1], p[0]])); }); });
  if (lines.length > 500){ trailCase.setLatLngs(lines); trailLine.setLatLngs(lines); S.trailLive = true; } }).catch(() => {});
/* detailed trail line: fetched by 0.25° tiles as the map moves, simplified to about 2 m; a tile that fails leaves the generalized line showing */
const HIZ = 12, HIT = .25, HIC = new Map();
const trailCaseHi = L.polyline([], {renderer:trailR, color:'#fff', weight:4.6, opacity:.9, interactive:false}).addTo(map);
const trailLineHi = L.polyline([], {renderer:trailR, color:'#14294A', weight:2.2, interactive:false}).addTo(map);
let hiKey = '', hiTimer = 0;
function hiTile(tx, ty){ const k = tx + ',' + ty; if (HIC.has(k)) return HIC.get(k);
  const w = tx * HIT, s = ty * HIT, p = arcQuery(SVC + 'ANST_Centerline/FeatureServer/0', {outFields:'OBJECTID', geometry:[w, s, w + HIT, s + HIT].join(','), geometryType:'esriGeometryEnvelope', inSR:4326, spatialRel:'esriSpatialRelIntersects', maxAllowableOffset:'0.00002', geometryPrecision:6}, 5)
    .then(f => { const lines = []; f.forEach(x => { const g = x.geometry; if (!g) return; (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]).forEach(c => { if (c.length > 1) lines.push(c.map(q => [q[1], q[0]])); }); }); return lines; })
    .catch(() => { HIC.delete(k); return null; });
  HIC.set(k, p); return p; }
function trailHi(){ clearTimeout(hiTimer); hiTimer = setTimeout(async () => {
  const z = map.getZoom(); if (z < HIZ){ if (hiKey){ hiKey = ''; trailCaseHi.setLatLngs([]); trailLineHi.setLatLngs([]); trailStyle(); } return; }
  const b = map.getBounds().pad(.2), x0 = Math.floor(b.getWest() / HIT), x1 = Math.floor(b.getEast() / HIT), y0 = Math.floor(b.getSouth() / HIT), y1 = Math.floor(b.getNorth() / HIT);
  const key = [x0, x1, y0, y1].join('|'); if (key === hiKey) return; const tiles = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push(hiTile(x, y));
  const got = await Promise.all(tiles); if (map.getZoom() < HIZ) return;
  if (got.some(t => t == null) || !got.some(t => t.length)){ hiKey = ''; trailStyle(); return; }    /* keep the generalized line if any tile failed */
  hiKey = key; const lines = [].concat(...got); trailCaseHi.setLatLngs(lines); trailLineHi.setLatLngs(lines); trailStyle(); }, 250); }
{ const t0 = trailStyle; trailStyle = function(){ t0(); const on = !!hiKey && map.getZoom() >= HIZ, dk = DARKBASE[S.base];
  trailCaseHi.setStyle({color: dk ? '#14294A' : '#fff', opacity: on ? .9 : 0}); trailLineHi.setStyle({color: dk ? '#fff' : '#14294A', opacity: on ? 1 : 0});
  if (on){ trailCase.setStyle({opacity:0}); trailLine.setStyle({opacity:0}); } }; }
map.on('moveend zoomend', trailHi); trailHi();

/* ---------- phone gestures ----------
   On a phone the map fills most of the screen, so a one-finger drag on it must scroll the page.
   Two fingers move and zoom the map. Taps still select cells. Wide screens are not affected. */
const TOUCHDEV = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
function mapGestures(){ if (TOUCHDEV && VW() <= 860 && !document.body.classList.contains('stackui')) map.dragging.disable(); else map.dragging.enable(); }
{ const mc = map.getContainer(), hint = $('#maphint'); let sx = 0, sy = 0, ht = null;
  const showHint = () => { hint.classList.add('on'); clearTimeout(ht); ht = setTimeout(() => hint.classList.remove('on'), 1600); };
  const onTouch = e => { if (S.drawing){ if (e.cancelable) e.preventDefault(); return; } if (!(TOUCHDEV && VW() <= 860) || document.body.classList.contains('stackui')) return;
    if (e.touches.length >= 2){ if (e.cancelable) e.preventDefault(); hint.classList.remove('on'); return; }
    if (e.type === 'touchstart'){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; return; }
    const dx = Math.abs(e.touches[0].clientX - sx), dy = Math.abs(e.touches[0].clientY - sy); if (dx > 18 && dx > dy * 1.3) showHint(); };
  mc.addEventListener('touchstart', onTouch, {passive:false}); mc.addEventListener('touchmove', onTouch, {passive:false}); }

/* ---------- legend ---------- */
function legend(){ const lv = dispLevel(), m = S.m; let h = `<h3><button type="button" id="legtog" aria-expanded="${S.legend}" aria-controls="legbody"><span>${esc(m.label)}</span><i aria-hidden="true"></i></button></h3><div id="legbody"${S.legend ? '' : ' hidden'}>`;
  if (m.kind === 'cat'){ const present = new Set(); const n = D.levels[lv].id.length;
    for (let c = 0; c < n; c++){ const v = m.get(lv, c); if (v != null) present.add(D.cats[m.f][v]); }
    if (m.many){ const cnt = new Map(); for (let c = 0; c < n; c++){ const v = m.get(lv, c); if (v != null && inSec(lv, c)) cnt.set(v, (cnt.get(v) || 0) + 1); }
      const top = [...cnt].sort((a,b) => b[1] - a[1]);
      top.slice(0, 8).forEach(x => { const e = CATMAP[m.f].get(D.cats[m.f][x[0]]); h += `<div class="row"><i style="background:${e[1]}"></i><span>${esc(e[0])}</span></div>`; });
      if (top.length > 8) h += `<p class="sub">and ${top.length - 8} more types, shaded by land cover group. Point to a cell for its name.</p>`; }
    else CATCOL[m.f].forEach(e => { if (present.has(e[0])) h += `<div class="row"><i style="background:${e[1]}"></i><span>${esc(e[2] || e[0])}</span></div>`; });
  } else if (m.legendFn){ h += m.legendFn(lv); } else { const B = breaks(m, lv), u = m.unit || '', st = m.int ? 1 : 0;
    if (m.zero) h += `<div class="row"><i style="${zClear(m) ? 'background:transparent;box-shadow:inset 0 0 0 1px #8A97A6' : 'background:' + ZERO}"></i><span>${m.th === 'veg' ? 'None mapped' : m.th === 'soil' || m.th === 'feat' || m.th === 'hist' ? 'None' : m.th === 'wet' ? (m.zeroText || 'None mapped') : m.th === 'fhr' || m.id === 'withinv' ? m.zeroText : 'None reported'}</span></div>`;
    B.cols.forEach((col,i) => { let t; const lo = i === 0 ? B.min : B.b[i-1] + st, hi = i < B.b.length ? B.b[i] : B.max;
      if (m.int) t = lo >= hi ? fmt(hi,0) : `${fmt(lo,0)} to ${fmt(hi,0)}`;
      else t = i === 0 ? `up to ${fmt(hi,m.d)}${u}` : i === B.cols.length-1 ? `over ${fmt(B.b[i-1],m.d)}${u}` : `${fmt(B.b[i-1],m.d)} to ${fmt(hi,m.d)}${u}`;
      h += `<div class="row"><i style="background:${col}"></i><span>${t}</span></div>`; }); }
  h += m.nullHide && !m.find ? `<p class="sub">${esc(m.none)}</p>` : `<div class="row"><i class="hollow"></i><span>${m.find ? 'Not recorded' : (m.none || 'No data for this measure')}</span></div>`;
  if (m.find) h += `<p class="sub">${m.find.complete ? 'A blank cell means no record there. It does not mean the species is absent.' : 'Partial results. Only each cell\'s ten most-recorded iNaturalist species can be searched, so a blank cell is not an absence.'}</p>`;
  if (m.note) h += `<p class="sub">${esc(m.note)}</p>`;
  if (m.cite) h += `<p class="sub legcite">${m.citeUrl ? `<a href="${m.citeUrl}" target="_blank" rel="noopener">${esc(m.cite)}</a>` : esc(m.cite)}</p>`;
  if (S.ext === 'huc' && S.cells) h += '<div class="row"><i class="corrkey"></i><span>A.T. corridor cells (outlined when zoomed in)</span></div>';
  h += `<p class="sub">Per ${LV[lv].name} cell${S.ext === 'huc' ? ', HUC10 watershed' : ''}</p>`;
  if (m.find) h += '<button type="button" id="findclear" class="lbtn">Clear search</button>';
  if (m.fade) h += `<label><input type="checkbox" id="fadebox" ${S.fade ? 'checked' : ''}> ${m.fadeLabel ? m.fadeLabel : m.th === 'veg' ? 'Fade cells with under ' + THIN_AC + ' acres mapped' : 'Fade thinly sampled cells'}</label>`;
  $('#legend').innerHTML = h + '</div>';
  $('#legtog').onclick = () => { S.legend = !S.legend; store.set('legend', S.legend); legend(); };
  { const fc = $('#findclear'); if (fc) fc.onclick = clearFind; }
  const fb = $('#fadebox'); if (fb) fb.onchange = () => { S.fade = fb.checked; restyle(); }; }

/* ---------- side panel ---------- */
const cellItem = (lv, c, extra) => `<li><button type="button" data-cell="${c}" data-lv="${lv}"><span class="where">Near mile ${fmt(D.levels[lv].mi[c], 0)}</span>${extra || ''}<span class="club">${esc(cat('club', D.levels[lv].club[c]) || '')}</span></button></li>`;
const scroller = el => { for (let p = el.parentElement; p; p = p.parentElement){ const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) return p; } return document.scrollingElement; };
function keepPlace(el, sels, fn){ const t0 = el && el.isConnected ? el.getBoundingClientRect().top : null, side = $('#side'); S.keepH = {q:S.q.id, h:Math.max(side.scrollHeight, side.offsetHeight), sels, top:t0}; fn();
  if (t0 == null) return; const nu = sels.map(s => document.querySelector(s)).find(Boolean); if (!nu) return; const d = nu.getBoundingClientRect().top - t0;
  if (Math.abs(d) >= 1){ const sc = scroller(nu); sc.scrollTop += d; } }
/* a question or measure with its own choices (species, years, scale) opens the Selections block */
const hasSel = () => PHQ() || (S.q.id === 'inv' && S.m.id === 'edrr') || (S.q.id === 'land' && S.m.id === 'acq');
/* questions with an animation (Play), in the list; and whether the one on screen has one now */
const QANIM = new Set(['mig', 'phen', 'pest', 'inv', 'cult', 'land', 'fcond']);
const PLAYQ = () => !S.m.find && (S.q.id === 'mig' || (S.q.id === 'land' && S.m.id === 'acq') || (typeof PHQ === 'function' && PHQ()) || (typeof dlAnimOn === 'function' && dlAnimOn()));
/* Play on the map, bottom left, for whatever animation is on screen; it presses the panel's own Play, so both stay in step */
function mapPlay(){ let b = $('#mapplay'); const src = $('#migplay') || $('#phplay') || $('[data-acqplay]') || $('[data-dlplay]');
  if (!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'mapplay'; b.className = 'mapctl'; b.innerHTML = '<i aria-hidden="true">▶</i><span></span>';
    b.onclick = () => { const r = $('#migplay') || $('#phplay') || $('[data-acqplay]') || $('[data-dlplay]'); if (r) r.click(); setTimeout(mapPlay, 60); }; if (window.L && L.DomEvent) L.DomEvent.disableClickPropagation(b); $('#mapwrap').append(b); }
  const on = !!src && PLAYQ(); b.hidden = !on; document.body.classList.toggle('hasplay', on); if (!on) return;
  const pl = /pause/i.test(src.textContent), lab = ($('#migwkl') || $('#phwkl') || $('#acqyl') || $('#dlml') || {textContent:''}).textContent.split(' · ')[0];
  const ic = pl ? '❚❚' : '▶'; if (b.firstChild.textContent !== ic) b.firstChild.textContent = ic; if (b.lastChild.textContent !== lab) b.lastChild.textContent = lab; b.classList.toggle('nolab', !lab);
  b.setAttribute('aria-label', (pl ? 'Pause' : 'Play') + ' the animation'); }
if (window.MutationObserver) new MutationObserver(() => { clearTimeout(mapPlay.t); mapPlay.t = setTimeout(mapPlay, 30); }).observe($('#side'), {subtree:true, childList:true, characterData:true});
/* phones: the species picker sits under the question title, so it can be changed without opening Measures */
function quickPick(){ const q = $('#qquick'); if (!q || !document.body.classList.contains('stackui')) return; const sel = $('#side .qbody #migsp, #side .qbody #phsp, #side .qbody #pinvsel'), ex = $('#side .qbody .extblk .extsw');
  if (sel) q.append(sel); if (ex) q.append(ex); }
/* the map legend, repeated in Answer on phones (where the map legend sits small over the map) */

/* phones: the map and the trail profile on top, then the question and a row of buttons; a button opens its part below
   (Measures, Results, Charts, About, or Cell for a picked cell) and the map gets smaller to make room; the same button closes it */
let PTAB = '';
function ptabSet(k){ PTAB = PTAB === k ? '' : k; stackSync(); const q = $('#side .qbody'); if (q) q.scrollTop = 0; }
/* phones: the Map layers list stops at the bottom of the map, so it never runs over the question line */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#layerstog')) setTimeout(() => { const pn = $('#layerspanel'); if (!pn || pn.hidden) return; if (!document.body.classList.contains('stackui')){ pn.style.maxHeight = ''; return; } pn.style.maxHeight = Math.max(160, $('#mapwrap').getBoundingClientRect().bottom - pn.getBoundingClientRect().top - 8) + 'px'; }, 0); });
/* installable web app: the service worker keeps the last copy for use without signal; Install shows only where the browser offers it */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
{ let ip = null; const ib = $('#installbtn'); addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; if (ib) ib.hidden = false; });
  addEventListener('appinstalled', () => { ip = null; if (ib) ib.hidden = true; });
  if (ib) ib.onclick = async () => { if (!ip) return; ip.prompt(); try { await ip.userChoice; } catch (e) {} ip = null; ib.hidden = true; }; }
/* the real visible height, for the phone layout (100vh and 100dvh are wrong in an installed app on iPhone) */
{ const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName); };
  /* the height is not taken while the keyboard is up, so the layout does not keep the keyboard's shorter screen after it closes */
  const apph = () => { if (!typing()) document.documentElement.style.setProperty('--apph', innerHeight + 'px'); };
  apph(); addEventListener('resize', apph); addEventListener('orientationchange', () => setTimeout(apph, 300));
  /* the map controls are placed from where the header and map sit; lay them out again whenever those move */
  let fireT = 0; const relayout = () => { clearTimeout(fireT); fireT = setTimeout(() => dispatchEvent(new Event('resize')), 40); };
  /* phones: the screen itself never scrolls (the panels scroll inside it). iPhone can leave it pushed up, under the clock, after the
     keyboard closes or after jumping to a place; this puts it back. Tours scroll on purpose. */
  const pin = () => { const b = document.body, h = document.documentElement; if (!b.classList.contains('stackui') || b.classList.contains('touring') || typing()) return;
    if (scrollY || h.scrollTop || b.scrollTop){ scrollTo(0, 0); h.scrollTop = 0; b.scrollTop = 0; relayout(); } };
  const soon = () => requestAnimationFrame(pin), settle = () => [80, 350, 800].forEach(t => setTimeout(() => { apph(); pin(); relayout(); }, t));
  addEventListener('scroll', soon, {passive:true}); document.body.addEventListener('scroll', soon, {passive:true});
  document.addEventListener('focusout', settle); addEventListener('pageshow', settle); document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(() => { apph(); pin(); }, 120));
  /* an installed app on iPhone sizes the space under the clock a moment after it opens: the header grows, so place everything again */
  [250, 1000, 2500].forEach(t => setTimeout(() => { apph(); relayout(); }, t));
  if (window.ResizeObserver){ let last = ''; const ro = new ResizeObserver(() => { const hd = document.querySelector('header'), mw = document.getElementById('mapwrap'); if (!hd || !mw) return;
      const r = hd.getBoundingClientRect(), m = mw.getBoundingClientRect(), k = [r.height, m.top, m.height, innerHeight].map(Math.round).join(); if (k !== last){ const first = !last; last = k; if (!first) relayout(); } });
    const hd = document.querySelector('header'), mw = document.getElementById('mapwrap'); if (hd) ro.observe(hd); if (mw) ro.observe(mw); } }
function stackSync(){ const on = isPhone(), body = document.body, a = $('aside'), pr = $('#profile');
  if (on !== body.classList.contains('stackui')){ body.classList.toggle('stackui', on); if (!on) PTAB = '';
    if (pr){ if (on) a.append(pr); else $('#mapwrap').append(pr); }
    if (typeof mapGestures === 'function') mapGestures(); }
  if (on && S.side.qs) body.dataset.qpick = '1'; else delete body.dataset.qpick;
  { const qp = $('#qpick'); if (qp && !qp.hidden){ if (!on){ const r = a.getBoundingClientRect(), z = parseFloat(getComputedStyle(a).zoom) || 1; qp.style.top = (r.top / z) + 'px'; qp.style.left = (r.left / z) + 'px'; qp.style.width = (r.width / z) + 'px'; qp.style.bottom = '0px'; }
    } }
  { const qp = $('#qpick'); if (on && qp && !qp.hidden){ const ar = a.getBoundingClientRect(), mr = $('#mapwrap').getBoundingClientRect();
      qp.style.bottom = Math.max(0, innerHeight - ar.top) + 'px'; qp.style.top = Math.max(mr.top + 8, ar.top - Math.max(260, mr.height * .78)) + 'px'; } }
  if (on){ const cellOn = !!(pr && pr.classList.contains('open')), has = {show:!!$('#side .qsec[data-sec="show"] .blk'), res:!!$('#side [data-blk="results"]'), charts:!!$('#side .qsec[data-sec="charts"] .blk, #side .qsec[data-sec="charts"] .migcard'), about:!!$('#side .qsec[data-sec="about"] .blk'), prof:!!$('#strip'), cell:cellOn};
    if (PTAB && !has[PTAB]) PTAB = '';
    document.querySelectorAll('button[data-ptab]').forEach(b => { b.hidden = !has[b.dataset.ptab]; b.setAttribute('aria-pressed', PTAB === b.dataset.ptab); });
    a.dataset.pt = PTAB; body.dataset.pt = PTAB; }
  clearTimeout(stackSync.t); stackSync.t = setTimeout(() => { if (typeof map !== 'undefined') map.invalidateSize(); if (on && typeof strip === 'function') strip(); }, 80); }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[data-ptab]'); if (b) ptabSet(b.dataset.ptab); });
{ const c0 = $('#ctls'), cb = document.createElement('button'); cb.type = 'button'; cb.id = 'ctlbtn'; cb.className = 'mapctl'; cb.setAttribute('aria-expanded', 'false'); cb.innerHTML = '<span class="cbl">Map tools</span><span class="cbs">Map tools</span><i aria-hidden="true"></i>'; cb.title = 'Map tools: cells on, select area, pick cells';
  cb.onclick = () => { const o = !document.body.classList.contains('ctlopen'); document.body.classList.toggle('ctlopen', o); cb.setAttribute('aria-expanded', o); };
  if (c0) c0.prepend(cb);
  /* picking a cell opens Cell; closing it closes Cell */
  const pr = $('#profile'); if (pr && window.MutationObserver) new MutationObserver(() => { if (!document.body.classList.contains('stackui')) return; const o = pr.classList.contains('open');
    if (o && PTAB !== 'cell'){ PTAB = 'cell'; stackSync(); } else if (!o && PTAB === 'cell'){ PTAB = ''; stackSync(); } }).observe(pr, {attributes:true, attributeFilter:['class']});
  addEventListener('resize', () => { clearTimeout(stackSync.r); stackSync.r = setTimeout(stackSync, 120); }); }
/* the question list: type to filter (folded groups open while filtering); Escape closes it */
/* the filter text survives the panel redrawing (the map moving, the phone keyboard opening), and matches each question's
   title, group and description */
let QFILT = '';
let QFT = 0;
function qFilter(){ const f = $('.qfilt'); if (!f) return; if (f.value !== QFILT) f.value = QFILT; if (document.activeElement !== f && Date.now() - QFT < 4000 && !f.closest('[hidden]')){ f.focus({preventScroll:true}); try { f.setSelectionRange(QFILT.length, QFILT.length); } catch (x) {} } const t = QFILT.trim().toLowerCase(), nav = f.parentNode.querySelector('.qs'); if (!nav) return;
  let grp = null, any = false; const fin = () => { if (grp) grp.hidden = !!t && !any; };
  [...nav.children].forEach(b => { if (b.classList.contains('qgrp')){ fin(); grp = b; any = false; return; }
    const q = Q.find(x => x.id === b.dataset.q), hay = (b.textContent + ' ' + (q ? (QGRP[q.id] || '') + ' ' + (q.use || '') : '')).toLowerCase();
    const ok = t ? t.split(/\s+/).every(w => hay.includes(w)) : !b.dataset.folded; b.hidden = !ok; if (ok) any = true; }); fin(); }
['input', 'keyup', 'search', 'change'].forEach(ev => document.addEventListener(ev, e => { const f = e.target.closest && e.target.closest('.qfilt'); if (!f) return; QFILT = f.value; QFT = Date.now(); qFilter(); }));
document.addEventListener('click', e => { if (e.target.closest && (e.target.closest('.qpick [data-q]') || e.target.closest('.qpx'))){ QFILT = ''; QFT = 0; } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.side.qs && $('#qpick') && !$('#qpick').hidden){ S.side.qs = false; store.set('side2', S.side); side(); const c = $('.qchange'); if (c) c.focus(); } });
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.qchange') && !S.side.qs) setTimeout(() => { const f = $('.qfilt'); if (f && !isPhone()) f.focus(); }, 30); });
/* the "How to use" walkthrough: five stops, each pointing at one part of the screen; it changes nothing on the map */
const HOWTO = [
  {t:'Pick a question', el:() => isPhone() ? $('.qtitle') : $('.qchange'), x:() => 'Everything here starts with a guiding question, such as where invasive plants are showing up or when birds migrate through. Open <b>All questions</b> to choose one. The map, numbers and charts all change to answer it.'},
  {t:'Search', el:() => $('#find'), x:() => 'Search for almost anything along the trail: a geographic feature such as a mountain, gap, river or town; a shelter, campsite, parking area or vista; a plant or animal; a historic resource; an A.T. tract number; or a trail mile. Pick a result and the map zooms there and opens that cell. A species shows everywhere it\u2019s been recorded.'},
  {t:'Choose where', el:() => $('#section'), x:() => isPhone() ? 'The whole trail is shown to start. Pick a club section, region or state in the green <b>Whole trail</b> button at the top of the map to see just that area.'
      : 'The whole trail is shown to start. Pick a club section, region or state in <b>Section of trail</b> to see just that area.'},
  {t:'Read the map', el:() => isPhone() ? $('.ptabs') : $('.qhead'), x:() => 'Darker cells mean more. Questions marked <b>\u25B6 Animated</b> change over time: press <b>\u25B6</b> at the bottom left of the map to play them. ' + (isPhone() ? 'Tap <b>Measures</b> to change what’s mapped, or <b>Results</b>, <b>Charts</b> or <b>Profile</b> for more. Tap the same button again to close it.' : '<b>Measures</b>, <b>Results</b> and the charts are in the panel on the left.')},
  {t:'Look closer at a cell', el:() => $('#map'), x:() => 'Tap any cell for what’s known there across every dataset, not only this question. You can see the details or download them as text, CSV or Excel. To compare several cells, use <b>Select area</b> or <b>Pick cells</b> under ' + (isPhone() ? '<b>Map ▾</b>.' : '<b>Map tools</b>.')},
  {t:'Take a guided tour', el:() => $('#howbtn'), x:() => 'Want an example? The <b>grassland tour</b> walks through 12 stops on where restoration matters most along the trail. Look for the <b>Tour</b> badge in the question list. This walkthrough is always under the <b>?</b> button at the top.'}];
let HOWK = -1;
function howHL(on){ document.querySelectorAll('.howhl').forEach(e => e.classList.remove('howhl')); if (on && HOWK >= 0){ const e = HOWTO[HOWK].el(); if (e) e.classList.add('howhl'); } }
function howDraw(){ let d = $('#howto'); if (HOWK < 0){ if (d) d.remove(); howHL(false); return; }
  if (!d){ d = document.createElement('div'); d.id = 'howto'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'How to use'); document.body.append(d); }
  const st = HOWTO[HOWK], last = HOWK === HOWTO.length - 1;
  d.innerHTML = `<div class="hk">How to use · ${HOWK + 1} of ${HOWTO.length}</div><button type="button" class="hx" data-howx="1" aria-label="Close">×</button><h3>${st.t}</h3><p>${st.x()}</p>` +
    `<div class="hnav"><div class="hdots">${HOWTO.map((_, i) => `<i${i === HOWK ? ' class="on"' : ''}></i>`).join('')}</div>` + (last ? `<button type="button" class="qtour hgo" data-tour="grassland">Start the grassland tour</button><button type="button" class="pri" data-howx="1">Done</button>`
      : `<button type="button" data-howb="1"${HOWK ? '' : ' disabled'}>Back</button><button type="button" class="pri" data-hown="1">Next</button>`) + '</div>';
  if (!isPhone()){ const a = $('aside').getBoundingClientRect(); d.style.left = (a.right + 18) + 'px'; const qh = $('.qhead'); d.style.top = Math.max(70, qh ? qh.getBoundingClientRect().top : 70) + 'px'; d.style.bottom = 'auto'; }
  else { /* phones: the card sits in the half of the screen away from what it points at, so that stays in view */
    d.style.left = ''; const e = st.el(), r = e ? e.getBoundingClientRect() : null, H = innerHeight;
    const low = r && (r.top + Math.min(r.height, H) / 2) < H * .45 && r.height < H * .6;
    if (low){ d.style.top = 'auto'; d.style.bottom = '12px'; } else { d.style.top = '52px'; d.style.bottom = 'auto'; } }
  howHL(true); const b = d.querySelector('.pri'); if (b) b.focus({preventScroll:true}); }
function howStart(){ if (S.side.qs){ S.side.qs = false; store.set('side2', S.side); side(); } HOWK = 0; try { store.set('howseen', 1); } catch (e) {} howDraw(); }
function howEnd(){ HOWK = -1; howDraw(); }
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-howto], [data-hown], [data-howb], [data-howx], #howto .hgo'); if (!t) return;
  if (t.dataset.howto) howStart(); else if (t.dataset.hown){ HOWK = Math.min(HOWTO.length - 1, HOWK + 1); howDraw(); } else if (t.dataset.howb){ HOWK = Math.max(0, HOWK - 1); howDraw(); } else howEnd(); });
document.addEventListener('keydown', e => { if (HOWK < 0) return; if (e.key === 'Escape') howEnd(); else if (e.key === 'ArrowRight' && !/input|select|textarea/i.test(e.target.tagName || '')){ HOWK = Math.min(HOWTO.length - 1, HOWK + 1); howDraw(); } else if (e.key === 'ArrowLeft' && !/input|select|textarea/i.test(e.target.tagName || '')){ HOWK = Math.max(0, HOWK - 1); howDraw(); } });
{ const hc = $('header .hctl'), hb = document.createElement('button'); hb.type = 'button'; hb.id = 'howbtn'; hb.innerHTML = '<svg viewBox="0 1.3 24 24" width="17" height="17" aria-hidden="true"><path d="M8.6 8.4a3.5 3.5 0 0 1 6.8 1.1c0 2.3-3.4 2.9-3.4 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18.9" r="1.6" fill="currentColor"/></svg>'; hb.title = 'How to use'; hb.setAttribute('aria-label', 'How to use'); hb.dataset.howto = '1'; if (hc) hc.insertBefore(hb, $('#aboutbtn'));
  addEventListener('resize', () => { if (HOWK >= 0) howDraw(); });
  /* once, on a first visit (not when a link opens a tour) */
  setTimeout(() => { let seen = 0; try { seen = store.get('howseen', 0); } catch (e) {} if (!seen && !/tour=/.test(location.hash) && !(typeof TOUR !== 'undefined' && TOUR.id)) howStart(); }, 2200); }
const EXTHUCQ = new Set(['inv', 'pest']);   /* questions that open on the HUC10 watershed cells */
function side(){ const lv = dispLevel(), el = $('#side'), q = S.q;
  segSync();
  if (S.lastQ !== q.id){ S.lastQ = q.id; if (EXTHUCQ.has(q.id)){ if (S.ext !== 'huc'){ S.extAuto = true; setTimeout(() => setExt('huc'), 0); } } else if (S.extAuto){ S.extAuto = false; if (S.ext === 'huc') setTimeout(() => setExt('corr'), 0); } } el.style.minHeight = S.keepH && S.keepH.q === q.id ? S.keepH.h + 'px' : '';
  const blk = (key, title, body, cls) => `<section class="blk${cls ? ' ' + cls : ''}"><h2><button type="button" class="blktog" data-blk="${key}" aria-expanded="${S.side[key]}"><span>${title}</span><i aria-hidden="true"></i></button></h2><div class="blkbody"${S.side[key] ? '' : ' hidden'}>${body}</div></section>`;
  const SUMH = S.m.find ? '' : summary(lv), ANS = {h:'', used:''};
  let h = `<section class="qhead" style="--hue:${q.hue}"><div class="qcrumb">${S.m.find ? 'Search' : 'Guiding question' + (QGRP[q.id] ? ' · ' + esc(QGRP[q.id]) : '')}</div><div class="qtitle"><h2>${S.m.find ? 'Search results' : esc(q.title)}</h2><button type="button" class="blktog qchange" data-blk="qs" aria-expanded="${!!S.side.qs}" aria-controls="qpick">All questions<i aria-hidden="true"></i></button></div>` +
    '' + '<div class="qquick" id="qquick"></div>' + ANS.h + (typeof QTOUR !== 'undefined' && typeof TOURS !== 'undefined' && QTOUR[q.id] && !S.m.find && TOURS[QTOUR[q.id]] ? `<button type="button" class="qtour qtstart" data-tour="${QTOUR[q.id]}"><b>Take the ${esc(QTOUR[q.id])} tour</b> · ${TOURS[QTOUR[q.id]].steps.length} stops<span>Start</span></button>` : '') +
    `<div class="qpick" id="qpick"${S.side.qs ? '' : ' hidden'}><div class="qph"><b>Choose a question</b><button type="button" class="blktog qpx" data-blk="qs" aria-label="Close the question list">×</button></div><input class="qfilt" type="search" placeholder="Filter questions…" aria-label="Filter questions" autocomplete="off"><p class="qstart"><b>Start here:</b> pick a question to see its answer on the map. Not sure where to begin? <button type="button" class="qhow" data-howto="1">Show me how</button> · or try the <button type="button" class="qtour qtlink" data-tour="grassland">grassland tour</button>.</p>` +
    `<nav class="qs" aria-label="Guiding questions">` + Q.filter(qVis).map((x, i, a) => { const g = QGRP[x.id], off = g && QGOFF.has(g), cur = x === q && !S.m.find; return (g && (!i || QGRP[a[i - 1].id] !== g) ? `<button type="button" class="qgrp" data-qg="${esc(g)}" aria-expanded="${!off}"><span>${esc(g)}</span><i aria-hidden="true"></i></button>` : '') + (`<button type="button" data-q="${x.id}" style="--hue:${x.hue}" aria-current="${cur}"${off && !cur ? ' hidden data-folded="1"' : ''}>${esc(x.title)}${QANIM.has(x.id) ? '<span class="qanim" title="This question has an animation">▶ Animated</span>' : ''}${typeof QTOUR !== 'undefined' && QTOUR[x.id] ? `<span class="qtour" role="button" tabindex="0" data-tour="${QTOUR[x.id]}" title="Take a guided tour"><svg class="qnew" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>Tour<span class="vh"> (new)</span></span>` : ''}</button>`); }).join('') + '</nav></div></section>' +
    '<nav class="ptabs" aria-label="Open in the panel">' + [['show', 'Measures'], ['res', 'Results'], ['charts', 'Charts'], ['prof', 'Profile'], ['about', 'About'], ['cell', 'Cell']].map(([k, t]) => `<button type="button" data-ptab="${k}" aria-pressed="${PTAB === k}">${t}</button>`).join('') + '</nav>';
  if (S.m.find){ const fs = findSummary(lv); el.innerHTML = h + `<div class="qbody">${fs[0]}${blk('results', 'Results', fs[1], 'res')}</div>`; return; }
  const extBlk = q.id === 'hist' && !S.m.find ? `<section class="blk extblk">${histAdmBlock().replace('<span>Extent</span>', '<h2>Extent</h2>')}${histBlock()}</section>` : !EXTQ.includes(q.id) ? '' : `<section class="blk extblk"><div class="extsw" role="group" aria-label="Extent"><h2>Extent</h2><button type="button" data-ext="corr" aria-pressed="${S.ext === 'corr'}">A.T. corridor</button><button type="button" data-ext="huc" aria-pressed="${S.ext === 'huc'}"${EXTNO.includes(q.id) ? ' disabled class="extna" title="The trail is measured along the trail itself, so the HUC10 watershed extent does not apply"' : S.extMsg && !EXT.huc && !/could not/.test(S.extMsg) ? ' disabled' : ''}>HUC10 watershed</button></div>` +
    (S.extMsg ? `<p class="extnote" role="status">${esc(S.extMsg)}</p>` : '') + '</section>';
  const herbBlk = q.id !== 'rest' ? '' : `<div class="extsw" role="group" aria-label="Herbicide use"><span>Herbicide use</span><button type="button" data-herb="off" aria-pressed="${!S.herb}">Off</button><button type="button" data-herb="on" aria-pressed="${!!S.herb}">On</button></div>` +
    (S.herb ? '<p class="extnote">Cells are marked down by up to 10 points for the share of their A.T. lands in wetland, where herbicide use may be limited.</p>' : '') +
    (q.id !== 'rest' ? '' : `<div class="extsw" role="group" aria-label="Lands"><span>Lands</span><button type="button" data-lands="all" aria-pressed="${!S.appa}">All but private</button><button type="button" data-lands="appa" aria-pressed="${!!S.appa}">APPA only</button></div>` +
      (S.appa ? '<p class="extnote">Only NPS – APPA land counts: scores are scaled by the share of the cell’s corridor land that APPA administers. Cells without APPA land, or with too little to score, are left blank.</p>' : ''));
  const selHTML = S.m.find ? '' : PHQ() ? phBlock() : q.id === 'mig' ? migBlock() : q.id === 'inv' && S.m.id === 'edrr' ? pinvPick() : q.id === 'land' && S.m.id === 'acq' ? acqBlock() : q.id === 'fcond' && S.m.dlAnim ? dlBlock() : '';
  h += `<div class="qbody${(PHQ() || q.id === 'land' && S.m.id === 'acq' || q.id === 'cult' || q.id === 'geo' || qVizOn(q)) && !S.m.find ? ' hasviz' : ''}" style="--hue:${q.hue}">` + '<div class="qsec" data-sec="show">' + extBlk + (herbBlk ? blk('mgmt', `Management filters <small class="mgsum">Herbicide ${S.herb ? 'on' : 'off'} · ${S.appa ? 'APPA only' : 'All but private'}</small>`, herbBlk) : '') +
    blk('measures', 'Measures', '<div class="chips" role="group" aria-label="Measure">' + q.m.filter(m => !m.pinv && (!m.hideFn || !m.hideFn())).map((m, k, a) => (m.grp && (!k || a[k - 1].grp !== m.grp) ? `</div><h4 class="mgrp">${esc(m.grp)}</h4><div class="chips" role="group" aria-label="${esc(m.grp)}">` : '') + `<button type="button" data-m="${m.id}" aria-pressed="${m === S.m || (m.id === 'edrr' && !!S.m.pinv)}">${esc(m.label)}</button>`).join('') + '</div>') + (selHTML ? blk('sel', 'Selections', selHTML, 'selblk') : '') +
    '</div><div class="qsec" data-sec="res">' + blk('results', 'Results', ANS.used ? SUMH.replace(ANS.used, '') : SUMH, 'res') + '</div><div class="qsec" data-sec="charts">' + (PHQ() && !S.m.find ? phVizBlk(qVizOn(q) ? `<div id="qviz">${qVizHTML()}</div>` : '') : '') + (q.id === 'cult' && !S.m.find && !CULTM() ? blk('viz', 'Visualizations', `<div id="cultviz">${cultCharts()}</div>`) : '') + (q.id === 'geo' && !S.m.find ? blk('viz', 'Visualizations', `<div id="geoviz">${geoCharts(lv)}</div>`) : '') + (q.id === 'rest' && !S.m.find ? blk('rw', 'Model weights', `<div id="rwts">${restWeightsHTML()}</div>`) : '') + (((q.id === 'tvul' && S.m.id === 'score') || (q.id === 'fcond' && S.m.id === 'tfall')) && !S.m.find ? blk('tvw', 'Model weights', S.m.id === 'tfall' ? `<p class="sub tvwfor">These weights set the Tree fall vulnerability score.</p><div id="tfwts">${tfWeightsHTML()}</div>` : `<p class="sub tvwfor">These weights set the Vulnerability score. The Sustainability rating (TSA) and the slope measures do not use them.</p><div id="tvwts">${tvWeightsHTML()}</div>`) : '') + (qVizOn(q) && !S.m.find && !PHQ() ? blk('viz', 'Visualizations', `<div id="qviz">${q.id === 'eff' && S.m.id === 'od' ? visCtl() : ''}${q.id === 'wx' ? wxCtl() : ''}${qVizHTML()}</div>`) : '') + (q.id === 'land' && S.m.id === 'acq' ? blk('viz', 'Visualizations', `<div id="acqviz">${acqChart()}</div>`) : '') + '</div><div class="qsec" data-sec="about">' + blk('about', 'About this data', `<p class="use">${esc(q.use)}</p>`) + '</div></div>';
  const sc = scroller(el), st = sc.scrollTop; el.innerHTML = h; if (sc.scrollTop !== st) sc.scrollTop = st; phWire(); migWire(); stackSync(); quickPick(); mapPlay(); qFilter();
  const ld = PHQ() && PHD[phSp().key] && PHD[phSp().key].st === 'loading';
  if (S.keepH && !ld){ const k = S.keepH; S.keepH = null; requestAnimationFrame(() => { el.style.minHeight = '';
    const nu = k.top == null ? null : (k.sels || []).map(s => document.querySelector(s)).find(Boolean); if (nu){ const d = nu.getBoundingClientRect().top - k.top; if (Math.abs(d) >= 1) scroller(nu).scrollTop += d; } }); } }
/* the cells behind the results on show, for the Select all button */
let SUMSEL = null; const SELMAX = 2000;
function selAllBtn(lv, cells, label){ SUMSEL = {lv, cells, label}; if (!cells.length) return '';
  return cells.length > SELMAX ? `<p class="statline">${fmt(cells.length, 0)} cells: too many to select at once. Pick a larger cell size or a section of trail.</p>`
    : `<button type="button" class="selall" data-selsum="1">Select all ${nCells(cells.length)}</button>`; }
function summary(lv){ SUMSEL = null; const m = S.m, L_ = D.levels[lv], n = L_.id.length, rows = [];
  let total = 0;
  for (let c = 0; c < n; c++){ if (!inSec(lv, c)) continue; total++; const v = m.get(lv, c); if (v != null) rows.push([c, v]); }
  const where = S.sec === 'all' ? '' : ' in ' + esc(secName());
  let h = `<p class="statline">${fmt(m.id === 'withinv' ? rows.filter(r => r[1] > 0).length : rows.length,0)} of ${fmt(total,0)} cells${where} ${m.hasTxt ? m.hasTxt() : m.yn ? 'have ' + esc(m.yn) : 'have data for this measure'}.</p>`;
  if (!rows.length) return h + '<p class="statline">Nothing to show for this measure here. Try a larger cell size or another section.</p>';
  if (m.sumFn) return h + m.sumFn(lv, rows, where);
  h += selAllBtn(lv, rows.filter(r => m.kind === 'cat' || m.yn || r[1] !== 0).map(r => r[0]), m.yn || m.label);   /* zero counts (none reported) are not selected */
  if (m.yn){ rows.sort((a,b) => L_.mi[a[0]] - L_.mi[b[0]]);
    h += `<div class="rank"><h3>Cells with ${esc(m.yn)}<span class="cnt">${rows.length > 400 ? 'first 400, ' : ''}south to north</span></h3><ol class="scroll" tabindex="0" aria-label="Cells with ${esc(m.yn)}, scrollable list">`;
    rows.slice(0, 400).forEach(r => { h += cellItem(lv, r[0]); });
    return h + '</ol></div>'; }
  if (m.kind === 'cat' && S.q.id === 'geo') return h + `<p class="statline">${m.id === 'lith' ? 'The share of the bedrock area in each type' : 'The share of cells in each class'} is under Visualizations.</p>`;
  if (m.kind === 'cat'){ const cnt = new Map(); rows.forEach(r => cnt.set(r[1], (cnt.get(r[1]) || 0) + 1));
    h += '<div class="rank"><h3>Share of cells</h3>';
    const order = m.many ? [...cnt].sort((a,b) => b[1] - a[1]).slice(0, 10).map(x => CATMAP[m.f].get(D.cats[m.f][x[0]])) : CATCOL[m.f];
    if (m.many) h = h.replace('Share of cells', 'Most common main types');
    order.forEach(e => { const i = D.cats[m.f].indexOf(e[0]), k = cnt.get(i); if (k) h += `<div class="catrow"><i style="background:${e[1]}"></i><span>${esc(e[2] || e[0])}</span><b>${fmt(100*k/rows.length, k/rows.length < .1 ? 1 : 0)}%</b></div>`; });
    return h + '</div>'; }
  /* Sampling and the ranking:
     - counts (species, records): every cell is ranked. Thinly sampled cells have low counts, so they fall to the bottom on their own; if one does rank, its row says so.
     - shares (percentages): a cell with two records can show 50%, so thinly sampled cells are left out of the ranking. */
  let left = 0; const smp = sampled(m) || m.f === 'COV_RICHNESS', lim = sampled(m) && m.unit === '%';
  if (lim){ const keep = rows.filter(r => !thin(m.th, lv, r[0])); left = rows.length - keep.length; rows.length = 0; keep.forEach(r => rows.push(r)); }
  if (left) h += `<p class="statline">${fmt(left,0)} thinly sampled ${left === 1 ? 'cell is' : 'cells are'} left out of this ranking, because a share based on a handful of records is not reliable.</p>`;
  else if (sampled(m)){ const nThin = rows.filter(r => thin(m.th, lv, r[0])).length; if (nThin) h += `<p class="statline">All ${fmt(rows.length,0)} are ranked. ${fmt(nThin,0)} are thinly sampled: they are faded on the map and marked in the list.</p>`; }
  if (!rows.length) return h + '<p class="statline">No adequately sampled cells to rank here. Try a larger cell size or another section.</p>';
  const eff = c => { if (!smp) return ''; const th = m.th, n = th === 'ebird' ? val('ebird','N_CHECKLISTS',lv,c) : val('inat','N_OBS',lv,c); if (n == null) return '';
    const unit = th === 'ebird' ? (n === 1 ? 'checklist' : 'checklists') : (n === 1 ? 'record' : 'records'); return sampled(m) && thin(th, lv, c) ? `<span class="eff thin">thin sample, ${fmt(n,0)} ${unit}</span>` : `<span class="eff">from ${fmt(n,0)} ${unit}</span>`; };
  rows.sort((a,b) => b[1] - a[1]);
  const nTop = Math.min(50, rows.length);
  h += `<div class="rank"><h3>Highest cells${where}<span class="cnt">${rows.length > nTop ? 'top ' + nTop : 'all ' + nTop}</span></h3><ol class="scroll" tabindex="0" aria-label="Highest cells, scrollable list">`;
  rows.slice(0, 50).forEach(r => { const e = eff(r[0]); h += cellItem(lv, r[0], `<span class="val${e ? ' two' : ''}">${m.showFn && m.th === 'wx' ? m.showFn(r[1]) : fmt(r[1], m.d) + (m.unit === '%' ? '%' : '')}</span>${e}`); });
  return h + '</ol></div>'; }
$('#side').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ext){ S.hadm = null; S.extAuto = false; setExt(b.dataset.ext); return; }
  if (b.dataset.herb){ S.herb = b.dataset.herb === 'on'; BRK.clear(); redraw(); return; }
  if (b.dataset.lands){ S.appa = b.dataset.lands === 'appa'; BRK.clear(); redraw(); return; }
  if (b.dataset.hadm){ S.hadm = b.dataset.hadm; S.histHucFail = false; for (const k in HAGG) delete HAGG[k]; BRK.clear(); const want = histScale() === 'huc' ? 'huc' : 'corr';
    if (S.ext !== want) setExt(want); else redraw(); LIVE.forEach(l => { if (l.local && l.on) liveLoad(l); }); return; }
  if (b.dataset.blk){ S.side[b.dataset.blk] = !S.side[b.dataset.blk]; store.set('side2', S.side); side(); return; }
  if (b.dataset.qg){ const g = b.dataset.qg; if (QGOFF.has(g)) QGOFF.delete(g); else QGOFF.add(g); store.set('qgroups', [...QGOFF]); side(); return; }
  if (b.dataset.selall && S.m.find){ const lv = dispLevel(), e = S.m.find, L_ = D.levels[lv], cells = []; for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c) && e.cells[lv].has(c)) cells.push(c);
    if (cells.length) selectMany(lv, cells, null, e.common || e.sci); return; }
  if (b.dataset.phrk){ S.ph.rk = b.dataset.phrk; side(); return; }
  if (b.dataset.selsum && SUMSEL && SUMSEL.cells.length){ selectMany(SUMSEL.lv, SUMSEL.cells.slice(), null, SUMSEL.label); return; }
  if (b.dataset.clearfind){ clearFind(); return; }
  if (b.dataset.q){ const wasOpen = !!S.side.qs; S.side.qs = false; store.set('side2', S.side); const q = Q.find(x => x.id === b.dataset.q); if (q !== S.q || S.m.find){ S.q = q; S.m = q.m[0]; if (typeof wxReset === 'function') wxReset(); S.secOpen = {}; if (hasSel()) S.side.sel = true; redraw(); } else if (wasOpen) side(); }
  else if (b.dataset.m){ keepPlace(b, [`[data-m="${b.dataset.m}"]`], () => { const m0 = S.m; S.m = S.q.m.find(x => x.id === b.dataset.m); if (S.m !== m0 && typeof wxReset === 'function') wxReset(); if (S.m.th !== m0.th) S.secOpen = {}; if (hasSel()) S.side.sel = true; redraw(); }); }
  else if (b.dataset.cell) select(b.dataset.lv, +b.dataset.cell, true); });
secSel.addEventListener('change', () => { S.sec = secSel.value; fitSection(); redraw(); });

/* ---------- species search ---------- */
let FIDX = null;
function findIndex(){ if (FIDX) return FIDX; if (S.ext === 'huc') setExt('corr', true); const M = new Map();
  const add = (key, common, sci, kind, th, complete, lv, c) => { let e = M.get(key);
    if (!e){ e = {key, common, sci, kind, th, complete, lc:common.toLowerCase(), ls:sci.toLowerCase(), cells:{hex:new Set(), cog:new Set(), wheel:new Set()}}; M.set(key, e); }
    else if (complete && !e.complete){ e.complete = true; e.kind = kind; e.th = th; }
    e.cells[lv].add(c); };
  const lists = (th, lv, fields, kind, complete) => { const t = D.themes[th] && D.themes[th][lv]; if (!t) return;
    fields.forEach(f => { const col = t.f[f]; if (!col) return; for (let r = 0; r < col.length; r++){ const a = col[r]; for (let k = 0; k < a.length; k++){ const p = sppName(a[k]); add(p.sci.toLowerCase(), p.common, p.sci, kind, th, complete, lv, t.ix[r]); } } }); };
  for (const lv of ['hex','cog','wheel']){
    const eb = D.themes.ebird && D.themes.ebird[lv]; if (eb) lists('ebird', lv, Object.keys(eb.f).filter(k => k.endsWith('_LIST')), 'Bird', true);
    lists('inat', lv, ['INVASIVE_LIST','EDRR_LIST'], 'Invasive plant', true);
    lists('inat', lv, ['PEST_LIST'], 'Forest pest', true);
    lists('edd', lv, ['EDD_INV_LIST','EDD_EDRR_LIST'], 'Invasive plant', true);
    lists('edd', lv, ['EDD_PEST_LIST'], 'Forest pest', true);
    lists('inat', lv, ['TOP10_SPECIES'], 'iNaturalist species', false);
    lists('inat', lv, ['CULT_LIST'], 'Culturally significant plant', true);
    const vg = D.themes.veg && D.themes.veg[lv]; if (vg && vg.f.COMP) for (let r = 0; r < vg.f.COMP.length; r++){ const a = vg.f.COMP[r]; for (let k = 0; k < a.length; k += 2){ const nm = D.cats.DOM_TYPE[a[k]]; add('veg:' + nm.toLowerCase(), nm, '', 'Vegetation type', 'veg', true, lv, vg.ix[r]); } } }
  PRIORITY.forEach(p => { const k = p.sci.toLowerCase(); let e = M.get(k);
    if (!e){ e = {key:k, th:'inat', complete:false, cells:{hex:new Set(), cog:new Set(), wheel:new Set()}}; M.set(k, e); }
    Object.assign(e, {common:p.common, sci:p.sci, kind:'Priority species', lc:p.common.toLowerCase(), ls:p.sci.toLowerCase(), prio:p, sumComplete:e.complete}); prioApply(e); });
  return FIDX = M; }
function findMetric(e){ return {id:'find', find:e, q:S.q, th:e.th, kind:'cat', f:'FIND', label:e.common || e.sci, get:(lv, c) => e.cells[lv].has(c) ? 0 : null}; }
function setFind(e, fly){ if (S.ext === 'huc') setExt('corr', true); S.m = findMetric(e); S.secOpen = {}; $('#find').value = S.m.label; closeFind(); redraw();
  if (e.prio) prioFetch(e.prio, true).catch(() => {});
  if (fly){ const L_ = D.levels.wheel, pts = []; e.cells.wheel.forEach(c => { if (inSec('wheel', c)) pts.push(L_.c[c]); }); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(.12), {maxZoom:9}); } }
function clearFind(){ if (!S.m.find) return; S.m = S.q.m[0]; $('#find').value = ''; redraw(); }
function findSummary(lv){ const e = S.m.find, L_ = D.levels[lv], rows = []; let total = 0;
  for (let c = 0; c < L_.id.length; c++){ if (!inSec(lv, c)) continue; total++; if (e.cells[lv].has(c)) rows.push(c); }
  rows.sort((a,b) => L_.mi[a] - L_.mi[b]); const where = S.sec === 'all' ? '' : ' in ' + esc(secName());
  const bar = `<div class="findbar"><div><b>${esc(e.common || e.sci)}</b>${e.common && e.sci ? `<em>${esc(e.sci)}</em>` : ''}<span>${e.prio ? prioStatus(e.prio) : e.kind + (e.complete ? '' : ', partial results')}</span></div><button type="button" data-clearfind="1">Clear</button></div>`;
  let h = `<p class="statline">Recorded in ${fmt(rows.length,0)} of ${fmt(total,0)} ${LV[lv].name} cells${where}.${e.complete ? '' : e.prio ? ' Until the live records load, only cells where it is among the ten most-recorded iNaturalist species are shown.' : ' Only cells where it is among the ten most-recorded iNaturalist species are shown.'}</p>`;
  if (!rows.length) return [bar, h + '<p class="statline">None here at this cell size. Try another section or a larger cell size.</p>'];
  h += `<button type="button" class="selall" data-selall="1">Select all ${nCells(rows.length)}</button>`;
  h += `<div class="rank"><h3>Cells where recorded<span class="cnt">south to north</span></h3><ol class="scroll" tabindex="0" aria-label="Cells where recorded, scrollable list">`;
  const st = e.prio && PRIO[e.key], cnt = c => { const n = st && st.st === 'done' ? st.counts[lv].get(c) : 0; return n ? `<span class="val">${fmt(n,0)}</span>` : ''; };
  rows.slice(0, 400).forEach(c => { h += cellItem(lv, c, cnt(c)); });
  return [bar, h + '</ol></div>']; }
/* ---------- one search for everything: species and vegetation types, trail features and places, historic resources,
   tract numbers (looked up live in the administrative areas layer), trail miles, grid IDs and trail clubs.
   Results are grouped by kind; a species shows where it is recorded, everything else zooms there and opens its cell. */
const FGROUPS = [['spp', 'Species and vegetation'], ['place', 'Places and landmarks'], ['feat', 'Trail features'], ['hist', 'Historic resources'], ['tract', 'Tracts'], ['where', 'Trail miles, cells and clubs']];
/* place names: the landmarks on the elevation profile, plus USGS GNIS names (towns, summits, gaps, falls, lakes, rivers ...) from
   place_names.json, built monthly on GitHub; loaded the first time the search is used */
let PLACES = null;
function placesLoad(){ if (PLACES) return; PLACES = {st:'loading', items:[]};
  fetch('data/place_names.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => {
    /* compact rows [name, class index, lat, lon, state index]; older files list objects */
    const items = !j ? [] : Array.isArray(j.rows) ? j.rows.map(r => ({n:r[0], k:j.classes[r[1]], la:r[2], lo:r[3], s:j.states[r[4]]})) : Array.isArray(j.items) ? j.items : [];
    items.forEach(x => { x.lc = x.n.toLowerCase(); }); PLACES = {st:'done', items};
    if (document.activeElement === fin && fin.value.trim().length >= 2) listFind(); }).catch(() => { PLACES = {st:'done', items:[]}; }); }
/* ranking among names that match equally well: towns and natural landmarks before buildings and other local features */
const PLACEK = {'populated place':0, civil:1, summit:1, gap:2, falls:3, lake:4, reservoir:4, stream:5, ridge:5, range:5, valley:6, park:6, island:6, cliff:6, spring:7, 'locale':8, bridge:8, dam:8, crossing:8};
const LMKIND = {s:'Summit', p:'Town', f:'Landmark', r:'River'};
let TRACTQ = '', TRACTRES = [], tractT = 0, tractLayer = null;
const fscore = (s, q) => s.startsWith(q) ? 0 : (s.includes(' ' + q) || s.includes('-' + q) || s.includes('(' + q)) ? 1 : s.includes(q) ? 2 : -1;
const nearMile = (la, lo) => { const c = phCell('cog', la, lo); return c < 0 ? null : D.levels.cog.mi[c]; };
function findAll(q){ const G = {spp:[], place:[], feat:[], hist:[], tract:[], where:[]};
  /* species and vegetation types, as before */
  const sp = []; findIndex().forEach(e => { const c = e.lc, s = e.ls; let sc = -1;
    if (c.startsWith(q)) sc = 0; else if (c.includes(' ' + q) || c.includes('-' + q)) sc = 1; else if (c.includes(q)) sc = 2; else if (s.startsWith(q)) sc = 3; else if (s.includes(q)) sc = 4;
    if (sc >= 0) sp.push([sc, -e.cells.wheel.size, e]); });
  sp.sort((a, b) => a[0] - b[0] || a[1] - b[1]); G.spp = sp.slice(0, 8).map(x => ({g:'spp', e:x[2]}));
  /* landmarks (on the elevation profile, so they have a trail mile) and GNIS place names */
  const seen = new Set();
  ELEVMARKS.forEach(([fm, name, kind, ft]) => { if (fscore(name.toLowerCase(), q) < 0) return; seen.add(name.toLowerCase());
    G.place.push({g:'place', nm:name, kind:LMKIND[kind] + (ft ? ', ' + fmt(ft, 0) + ' ft' : '') + ', on the trail', mile:fm * ELEVK()}); });
  if (PLACES && PLACES.st === 'done'){ const pl = []; PLACES.items.forEach(x => { const lc = x.lc, sc = fscore(lc, q); if (sc >= 0 && !seen.has(lc)) pl.push([sc, PLACEK[(x.k || '').toLowerCase()] ?? 9, x.n.length, x]); });
    /* among equally good matches, places in the corridor grid come first (checked for the best 80 only, to stay quick) */
    pl.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const top = pl.slice(0, 80).map(p => [p[0], nearMile(p[3].la, p[3].lo) == null ? 1 : 0, p[1], p[2], p[3]]);
    top.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]); top.map(p => [p[0], p[2], p[3], p[4]]).slice(0, Math.max(0, 10 - G.place.length)).forEach(([, , , x]) => G.place.push({g:'place', nm:x.n, kind:[x.k, x.s].filter(Boolean).join(', '), la:x.la, lo:x.lo})); }
  /* trail features (shelters, campsites, parking, bridges, vistas ...) */
  const ft = []; D.feat.forEach((f, i) => { const sc = fscore(f[1].toLowerCase(), q); if (sc >= 0) ft.push([sc, f[1].length, i]); });
  ft.sort((a, b) => a[0] - b[0] || a[1] - b[1]); G.feat = ft.slice(0, 6).map(x => { const f = D.feat[x[2]]; return {g:'feat', nm:f[1], kind:f[0] + (f[2] ? ', ' + f[2].toLowerCase() : ''), la:f[3], lo:f[4]}; });
  /* historic resources, once loaded */
  if (HIST && HIST.st === 'done'){ const hs = []; HIST.items.forEach(x => { if (!x.nm) return; const sc = fscore(x.nm.toLowerCase(), q); if (sc >= 0) hs.push([sc, x.nm.length, x]); });
    hs.sort((a, b) => a[0] - b[0] || a[1] - b[1]); G.hist = hs.slice(0, 6).map(([, , x]) => ({g:'hist', nm:x.nm, kind:x.t === 'nr' ? 'National Register' + (x.a.type ? ', ' + x.a.type : '') : 'Cemetery', la:x.la, lo:x.lo})); }
  /* tracts: results of the live lookup for this text */
  if (TRACTQ === q) G.tract = TRACTRES.map(t => Object.assign({g:'tract'}, t));
  /* trail miles, grid IDs, trail clubs */
  const m = q.match(/^(?:mile|mi\.?)?\s*(\d{1,4}(?:\.\d+)?)$/);
  if (m && +m[1] <= D.totalMi) G.where.push({g:'where', nm:'Mile ' + fmt(+m[1], +m[1] % 1 ? 1 : 0), kind:'Trail mile, from Springer Mountain', mile:+m[1]});
  for (const lv of ['wheel', 'cog', 'hex']){ const L_ = D.levels[lv]; for (let c = 0; c < L_.id.length && G.where.length < 6; c++) if (L_.id[c].toLowerCase().startsWith(q) && q.length >= 4)
    G.where.push({g:'where', nm:L_.id[c], kind:`${LV[lv].name} cell near mile ${fmt(L_.mi[c], 0)}`, lv, c}); }
  D.clubs.forEach(cl => { if (fscore(cl[0].toLowerCase(), q) >= 0) G.where.push({g:'where', nm:cl[0], kind:`Trail club, miles ${fmt(cl[1], 0)} to ${fmt(cl[2], 0)}`, club:cl[0]}); });
  return G; }
/* tract numbers: a short live query of the administrative areas layer, after a pause in typing */
function tractLookup(q){ clearTimeout(tractT); if (!/\d/.test(q) || q.length < 2){ TRACTQ = q; TRACTRES = []; return; }
  if (TRACTQ === q) return;
  tractT = setTimeout(async () => { const lands = LIVE.find(l => l.id === 'lands');
    try { const f = await arcQuery(lands.url, {where:`UPPER(TRACT1) LIKE '${q.toUpperCase().replace(/'/g, "''")}%'`, outFields:'TRACT1,NAME,ADMIN,LEGEND3,ACRES', returnGeometry:true, geometryPrecision:5, maxAllowableOffset:.0001, resultRecordCount:8, orderByFields:'TRACT1'}, 1);
      TRACTQ = q; TRACTRES = f.filter(x => x.properties && x.geometry).slice(0, 8).map(x => { const p = x.properties, ac = +p.ACRES;
        return {nm:'Tract ' + String(p.TRACT1).trim(), kind:[(LANDMAP.get(p.LEGEND3) || [0, tcase(p.ADMIN || '')])[1], isFinite(ac) && ac > 0 ? fmt(ac, ac < 100 ? 1 : 0) + ' acres' : ''].filter(Boolean).join(', '), geo:x.geometry}; });
    } catch (e){ TRACTQ = q; TRACTRES = [{nm:'Tract lookup unavailable', kind:'The administrative areas service did not answer', none:1}]; }
    if (fin.value.trim().toLowerCase() === q && document.activeElement === fin) listFind(); }, 350); }
/* go to a place: zoom in, mark it, and open the 1 sq mi cell it is in (if it is in the corridor grid) */
function findGo(la, lo, z){ map.setView([la, lo], Math.max(map.getZoom(), z || 15)); flyMark.setLatLng([la, lo]).addTo(map); setTimeout(() => flyMark.remove(), 4000);
  const c = phCell('hex', la, lo); if (c >= 0) select('hex', c, false); }
function pickFind(r){ if (!r || r.none) return;
  if (r.g === 'spp'){ setFind(r.e, true); return; }
  if (S.m.find) clearFind(); fin.value = r.nm; closeFind();
  if (r.g === 'tract'){ if (tractLayer) map.removeLayer(tractLayer); tractLayer = L.geoJSON(r.geo, {pane:'feat', interactive:false, style:{color:'#FFC233', weight:3, fill:false}}).addTo(map);
    const bb = tractLayer.getBounds(); map.fitBounds(bb.pad(.4), {maxZoom:16}); const ct = bb.getCenter(), c = phCell('hex', ct.lat, ct.lng); if (c >= 0) select('hex', c, false);
    setTimeout(() => { if (tractLayer){ map.removeLayer(tractLayer); tractLayer = null; } }, 15000); return; }
  if (r.club){ const k = D.cats.club.indexOf(r.club); if (k >= 0){ S.sec = 'c' + k; secSel.value = S.sec; fitSection(); redraw(); } return; }
  if (r.lv){ select(r.lv, r.c, true); return; }
  if (r.mile != null){ const L_ = D.levels.cog; let best = -1, bd = Infinity; for (let c = 0; c < L_.id.length; c++){ const d = Math.abs(L_.mi[c] - r.mile); if (d < bd){ bd = d; best = c; } } if (best >= 0) select('cog', best, true); return; }
  findGo(r.la, r.lo); }
const fin = $('#find'), fl = $('#findlist'); let fsel = -1, fres = [];
function closeFind(){ fl.hidden = true; fin.setAttribute('aria-expanded', 'false'); fin.removeAttribute('aria-activedescendant'); fsel = -1; }
function listFind(){ const q = fin.value.trim().toLowerCase(); if (q.length < 2){ closeFind(); return; }
  if (!HIST) histLoad(false, true); placesLoad(); tractLookup(q);
  const G = findAll(q); fres = []; let h = '';
  /* a query with digits is most likely a tract number or a trail mile, so those groups come first */
  const order = /\d/.test(q) ? ['tract', 'where', 'spp', 'place', 'feat', 'hist'].map(k => FGROUPS.find(g => g[0] === k)) : FGROUPS;
  order.forEach(([g, title]) => { const rs = G[g]; if (!rs.length) return; h += `<li class="fgrp" role="presentation">${title}</li>`;
    rs.forEach(r => { const i = fres.length; fres.push(r);
      if (r.g === 'spp'){ const e = r.e; h += `<li role="option" id="fo${i}" data-i="${i}" aria-selected="${i === fsel}"><span>${esc(e.common || e.sci)}${e.common && e.sci ? ` <em>${esc(e.sci)}</em>` : ''}</span><span class="n">${nCells(e.cells.wheel.size)}</span><span class="k">${e.kind}${e.prio && !e.complete ? ', full records load live' : e.complete ? '' : ', partial'}</span></li>`; return; }
      const mi = r.la != null ? nearMile(r.la, r.lo) : r.g === 'place' && r.mile != null ? r.mile : null;
      h += `<li role="option" id="fo${i}" data-i="${i}" aria-selected="${i === fsel}"${r.none ? ' class="none"' : ''}><span>${esc(r.nm)}</span><span class="n">${mi != null ? 'mile ' + fmt(mi, 0) : ''}</span><span class="k">${esc(r.kind || '')}${r.la != null && mi == null ? ', outside the corridor grid' : ''}</span></li>`; }); });
  if (/\d/.test(q) && TRACTQ !== q) h = '<li class="fgrp" role="presentation">Tracts</li><li class="none">Looking up tract numbers…</li>' + h;
  fl.innerHTML = h || '<li class="none">No match. Try a species, a shelter or other trail feature, a cemetery, a tract number, a trail mile or a trail club.</li>';
  fl.hidden = false; fin.setAttribute('aria-expanded', 'true'); if (fsel >= 0) fin.setAttribute('aria-activedescendant', 'fo' + fsel); }
fin.addEventListener('input', () => { $('#jerrybtn').hidden = JERRY || fin.value.trim().toLowerCase() !== 'jerry'; fsel = -1; if (!fin.value && S.m.find) clearFind(); listFind(); });
fin.addEventListener('keydown', e => { if (e.key === 'Enter' && fl.hidden && fin.value.trim().length >= 2) listFind(); });
fin.addEventListener('focus', () => { if (fin.value.trim().length >= 2) listFind(); });
fin.addEventListener('blur', () => setTimeout(closeFind, 150));
fin.addEventListener('keydown', e => { if (e.key === 'Escape'){ if (!fl.hidden) closeFind(); else { fin.value = ''; clearFind(); } return; }
  if (fl.hidden || !fres.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); fsel = (fsel + (e.key === 'ArrowDown' ? 1 : -1) + fres.length) % fres.length; listFind(); const o = $('#fo' + fsel); if (o) o.scrollIntoView({block:'nearest'}); }
  else if (e.key === 'Enter'){ e.preventDefault(); pickFind(fres[fsel >= 0 ? fsel : 0]); fin.blur(); } });
fl.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); e.preventDefault(); if (li){ pickFind(fres[+li.dataset.i]); fin.blur(); } });

/* ---------- cell profile ---------- */
const wiki = name => 'https://en.wikipedia.org/wiki/Special:Search?go=Go&search=' + encodeURIComponent(name);
const PEST_NAMES = {'Adelges tsugae':'Hemlock woolly adelgid', 'Agrilus planipennis':'Emerald ash borer', 'Fiorinia externa':'Elongate hemlock scale',
  'Litylenchus crenatae':'Beech leaf disease nematode', 'Lycorma delicatula':'Spotted lanternfly', 'Lymantria dispar':'Spongy moth'};
/* D.spp entries read "Common name (Scientific name) [lists]"; forest pests are often a bare scientific name */
const SPPN = [];
function sppName(i){ if (SPPN[i]) return SPPN[i]; const s = D.spp[i], m = s.match(/^(.*?)\s*\(([^)]*)\)\s*(\[.*\])?$/), sci = m ? m[2] : s.replace(/\s*\[.*\]$/, '');
  return SPPN[i] = {common: m ? m[1] : (PEST_NAMES[sci] || ''), sci, tag: m && m[3] ? m[3].slice(1, -1) : ''}; }
/* SPPBOX: the bounding box of the selected cell(s), set when the details panel is built */
let SPPBOX = null;
const setSppBox = rings => { const ll = rings.flat(); SPPBOX = ll.length ? [Math.min(...ll.map(p => p[0])), Math.min(...ll.map(p => p[1])), Math.max(...ll.map(p => p[0])), Math.max(...ll.map(p => p[1]))] : null; };
const inatObsUrl = sci => SPPBOX ? `https://www.inaturalist.org/observations?taxon_name=${encodeURIComponent(sci)}&swlat=${SPPBOX[0].toFixed(4)}&swlng=${SPPBOX[1].toFixed(4)}&nelat=${SPPBOX[2].toFixed(4)}&nelng=${SPPBOX[3].toFixed(4)}&quality_grade=research` : '';
/* tier of a priority invasive plant (EDRR or established priority), from the dashboard's list, which follows invasive_lookup.csv */
let PINVIX = null, PINVIXN = -1;
function pinvSp(sci){ const n = PHSP.length; if (!PINVIX || PINVIXN !== n){ PINVIX = new Map(); PINVIXN = n;
    PHSP.filter(s => s.set === 'pinv').forEach(s => { const k = s.sci.toLowerCase().replace('×', 'x'); PINVIX.set(k, s); PINVIX.set(k.split(' ').slice(0, 2).join(' '), s); }); }
  const k = (sci || '').toLowerCase().replace('×', 'x'), alias = {'mahonia bealei':'berberis bealei', 'humulus japonicus':'humulus scandens', 'photinia villosa':'pourthiaea villosa', 'fallopia japonica':'reynoutria japonica', 'fallopia sachalinensis':'reynoutria sachalinensis'};
  return PINVIX.get(k) || PINVIX.get(k.split(' ').slice(0, 2).join(' ')) || PINVIX.get(alias[k.split(' ').slice(0, 2).join(' ')] || '') || null; }
const pinvTier = sci => { const s = pinvSp(sci); return s ? (s.group === PINVG.EDRR ? 'EDRR' : 'Priority') : null; };
/* invasive plants for a cell or a selection, grouped: early detection (EDRR), established priority, other invasive plants.
   entries: [[species index, cells or null]]; a priority plant gets a link that maps its spread */
function invPlantsHTML(entries, ed, lv, cells){
  const G = {EDRR:[], Priority:[], Other:[]}; entries.forEach(x => { const t = ed.has(x[0]) ? (pinvTier(sppName(x[0]).sci) || 'Priority') : 'Other'; G[t].push(x); });
  const T = invSrc(lv, cells), li = x => srcItem(x[0], T, false, x[1] != null ? `<span class="tag">${nCells(x[1])}</span>` : '');
  const list = (arr, lab) => !arr.length ? '' : `<p style="margin-top:8px">${lab}, ${arr.length}:</p><ul class="spp">${arr.slice(0, 15).map(li).join('')}</ul>` +
    (arr.length > 15 ? `<details><summary>${arr.length - 15} more</summary><ul class="spp">${arr.slice(15).map(li).join('')}</ul></details>` : '');
  let b = entries.length ? list(G.EDRR, 'Early detection (EDRR) priority plants') + list(G.Priority, 'Established priority plants') + list(G.Other, 'Other invasive plants')
    : '<p class="none" style="margin-top:8px">No invasive plants reported.</p>';
  return b; }
function sppItem(i, edrr, inat){ const {common, sci, tag} = sppName(i), tx = common ? `${esc(common)} <em>${esc(sci)}</em>` : `<em>${esc(sci)}</em>`;
  let h = `<a href="${wiki(sci)}" target="_blank" rel="noopener" title="Look up ${esc(sci)} on Wikipedia">${tx}</a>`;
  if (tag) h += `<span class="tag">${esc(tag)}</span>`;
  if (edrr){ const t = pinvTier(sci); h += `<span class="tag edrr">${t === 'EDRR' ? 'early detection (EDRR)' : 'priority invasive'}</span>`; }
  if (inat && SPPBOX) h += `<a class="obslink" href="${inatObsUrl(sci)}" target="_blank" rel="noopener" title="Research-grade iNaturalist observations of ${esc(sci)} in this area">iNat records</a>`;
  return `<li>${h}</li>`; }
/* The other cell sizes for a cell: the larger cells it sits in, and the smaller cells inside it (selected together).
   from: the cell the row is built around; on: the size now shown. */
const SIZES = ['hex','cog','wheel'];
function childrenOf(lv, c, down){ const pre = D.levels[lv].id[c] + '-', ids = D.levels[down].id, out = [];
  for (let k = 0; k < ids.length; k++) if (ids[k].startsWith(pre)) out.push(k); return out; }
function scaleRow(from, on){ const [lv, c] = from, i0 = SIZES.indexOf(lv);
  const opts = SIZES.map((L, i) => { if (L === on) return {L, cur:true};
    if (i === i0) return {L, go:() => select(lv, c, true)};
    if (i > i0){ let p = [lv, c]; while (p && p[0] !== L) p = parentOf(p[0], p[1]); return p ? {L, go:() => select(p[0], p[1], true)} : {L}; }
    const kids = childrenOf(lv, c, L); return kids.length ? {L, n:kids.length, go:() => { selectMany(L, kids, null, null, from); map.fitBounds(L_bounds(lv, c), {maxZoom:12}); }} : {L}; });
  const html = `<div class="scales" role="group" aria-label="Cell size"><span>Cell size</span>` + opts.map((o, k) =>
    `<button type="button" data-k="${k}"${o.cur ? ' aria-pressed="true"' : ''}${!o.cur && !o.go ? ' disabled' : ''}>${LV[o.L].name}${o.n ? ` <em>(${o.n})</em>` : ''}</button>`).join('') + '</div>';
  return [html, el => el.querySelectorAll('.scales button').forEach(b => { const o = opts[+b.dataset.k]; if (o.go && !o.cur) b.onclick = o.go; })]; }
const L_bounds = (lv, c) => L.latLngBounds(ring(lv, c)).pad(lv === 'hex' ? 1.5 : .6);
function parentOf(lv, c){ const id = D.levels[lv].id[c], up = lv === 'hex' ? 'cog' : lv === 'cog' ? 'wheel' : null; if (!up) return null;
  const pid = id.slice(0, id.lastIndexOf('-')); return IDX[up].has(pid) ? [up, IDX[up].get(pid)] : null; }
function phLatRefresh(){ cultVizRefresh(); const t = $('#phtrend'); if (t && S.side.viz && PHQ() && !SPREADQ() && phSp().kind === 'plant'){ t.innerHTML = phTrendBlock(); phWireTrend(); } }
function select(lv, c, fly){ S.box = null; boxRect.remove(); S.pinOff = false; S.cell = c; S.cellLv = lv; const r = ring(lv, c); selOuter.setLatLngs(r); selInner.setLatLngs(r);
  if (fly) map.fitBounds(L.latLngBounds(r).pad(lv === 'hex' ? 4 : 1.5), {maxZoom: lv === 'hex' ? 12 : lv === 'cog' ? 10 : 8});
  profile(); pinSync(); $('#clearbtn').hidden = false; writeHash(); phLatRefresh();
  setTimeout(() => { if (S.cell === c && S.cellLv === lv) keepClear(pin.getElement && pin.getElement()); }, fly ? 750 : 60);
  if (isPhone()){ placeProfile(); sheet(S.sheetFull ? 'full' : 'peek'); if (fly) $('#mapwrap').scrollIntoView({block:'start'}); showBar(); } }
function clearSel(){ S.cell = null; S.box = null; boxRect.remove(); pin.remove(); $('#clearbtn').hidden = true; selOuter.setLatLngs([]); selInner.setLatLngs([]); $('#profile').classList.remove('open', 'peek', 'full'); S.sheetFull = false; writeHash(); phLatRefresh(); }
/* Phones only: the cell details sit in the page under the graph, as a short summary that expands in place.
   Wide screens keep the popup inside the map and never get the peek/full classes. */
const isPhone = () => VW() <= 860;
function placeProfile(){ const p = $('#profile'), phone = isPhone(); if (document.body.classList.contains('stackui')){ const a = $('aside'); if (p.parentNode !== a) a.append(p); return; }
  if (phone && p.parentNode !== document.body) $('#strip').after(p);
  else if (!phone && p.parentNode !== $('#mapwrap')) $('#mapwrap').appendChild(p); }
function sheet(state){ const p = $('#profile'), hb = $('#phandle'); p.classList.toggle('peek', state === 'peek'); p.classList.toggle('full', state === 'full'); visCheck();
  hb.setAttribute('aria-expanded', state === 'full'); hb.querySelector('span').textContent = state === 'full' ? 'Hide details' : 'Show details'; }
function showBar(){ setTimeout(() => { const r = $('#profile').getBoundingClientRect(); if (!r.height) return;
  /* summary: bring the whole block on screen. expanded: bring its heading on screen and leave the map where it is. */
  const want = S.sheetFull ? r.top + Math.min(r.height, 150) : r.bottom; if (want > window.innerHeight) window.scrollBy({top: want - window.innerHeight + 10, behavior:'smooth'}); }, 90); }
function toggleSheet(){ const full = $('#profile').classList.contains('full');
  S.sheetFull = !full;
  if (full){ sheet('peek'); $('#mapwrap').scrollIntoView({block:'start'}); showBar(); }
  else { sheet('full'); setTimeout(() => $('#profile').scrollIntoView({block:'start', behavior:'smooth'}), 60); } }
$('#phandle').onclick = toggleSheet;
$('#phead').addEventListener('click', e => { if (isPhone() && !e.target.closest('button') && $('#profile').classList.contains('peek')) toggleSheet(); });
window.addEventListener('resize', () => { placeProfile(); if (!isPhone()) $('#profile').classList.remove('peek', 'full'); else if (S.cell != null) sheet(S.sheetFull ? 'full' : 'peek'); mapGestures(); });
$('#pclose').onclick = clearSel;
$('#clearbtn').onclick = clearSel;
const pctLt1 = x => x < 1 ? '<1%' : fmt(x, 0) + '%';
/* the first six rows, with the rest folded under a "N more" summary */
const topSix = (items, row, cls, more) => `<div class="${cls}">${items.slice(0, 6).map(row).join('')}</div>` +
  (items.length > 6 ? `<details><summary>${items.length - 6} ${more}</summary><div class="${cls}">${items.slice(6).map(row).join('')}</div></details>` : '');
const vegRow = x => `<div><i style="background:${CATMAP.DOM_TYPE.get(x[0])[1]}"></i><span>${esc(x[0])}</span><span>${pctLt1(x[1])}</span></div>`;
/* NLCD level 2 bar and key, from [name, percent, color] for every class */
function coverHTML(shares){ const l = shares.filter(x => x[1] >= 1).sort((a,b) => b[1] - a[1]), un = 100 - l.reduce((s,x) => s + x[1], 0); if (un >= 1) l.push(['Unassigned', un, '#ECEFEA']);
  return '<p style="margin-top:10px">NLCD level 2 land cover:</p><div class="stack">' + l.map(x => `<span style="width:${x[1]}%;background:${x[2]}"></span>`).join('') + '</div><div class="keys">' +
    l.map(x => `<div><i style="background:${x[2]}"></i><span>${x[0]}</span><span>${fmt(x[1],0)}%</span></div>`).join('') + '</div>'; }
function profile(){ setTimeout(cultVizRefresh); if (S.box) return profileBox(); const lv = S.cellLv, c = S.cell, L_ = D.levels[lv]; setSppBox([ring(lv, c)]);
  let h = `<h2>${LV[lv].name} cell near mile ${fmt(L_.mi[c],0)}</h2><p>${esc(cat('club', L_.club[c]) || '')}, ${esc(regionOf(L_.mi[c]))} region</p><p class="id">Grid ID ${esc(L_.id[c])}</p>`;
  h += `<p class="peekval"><span>${esc(S.m.label)}:</span> <b>${esc(show(S.m, cellValue(lv, c)))}</b></p>`;
  const [scales, wireScales] = scaleRow([lv, c], lv);
  h += scales + `<div class="pnav">${EXPORTBTNS}</div>`;
  $('#phead').innerHTML = h; wireScales($('#phead')); exportWire();
  if (S.ext === 'huc' && EXT.corr && inCorr(lv, c)){ withCorr(lv, L_.id[c], cc => profileCorr(lv, cc, true)); return; }
  let b = '';
  if (S.ext === 'huc'){ const note = S.q.id === 'hist' ? `${inCorr(lv, c) ? 'This cell is in the A.T. corridor grid.' : 'Outside the A.T. corridor grid, in the HUC10 shell.'} Switch the extent to A.T. corridor to see the corridor's other layers.`
      : (inCorr(lv, c) ? 'This cell is in the A.T. corridor grid. ' : 'Outside the A.T. corridor grid, in the HUC10 shell. ') + HUCONLY;
    b = recSection(lv, c) + invSection(lv, c) + cultSection(lv, c) + birdSection(lv, c) + visSection(lv, c) + (S.q.id === 'wet' ? wetSection(lv, c) + soilSection(lv, c) : soilSection(lv, c) + wetSection(lv, c)) + geoSection(lv, c) + tvSection(lv, c) + wxSection(lv, c) + dymSection(lv, c) + fhrSection(lv, c) + fcSection(lv, c) + histSection(lv, c) + phSection(lv, c);
    finishProfile(`<p class="none" style="font-size:13.5px;margin:0 0 10px">${note}</p>` + b); inatLive([ring(lv, c)], L_.id[c]); return; }
  profileCorr(lv, c, false); }
/* run fn with the A.T. corridor cells and layers in place (while the HUC10 extent is on), then put the watershed cells back.
   fn gets the corridor index of the cell with grid ID id at level lv. */
function withCorr(lv, id, fn){ const H = extSnapshot(), ext = S.ext, cell = S.cell, corr = EXT.corr;
  D.levels = corr.levels; D.themes = corr.themes; SOILCATS.forEach(k => { if (corr.cats[k]) D.cats[k] = corr.cats[k]; }); S.ext = 'corr'; extIndex();
  try { S.cell = IDX[lv].get(id); return fn(S.cell); }
  finally { S.cell = cell; D.levels = H.levels; D.themes = H.themes; SOILCATS.forEach(k => { if (H.cats[k]) D.cats[k] = H.cats[k]; }); S.ext = ext; extIndex(); } }
/* the details of one corridor cell; fromHuc: shown while the HUC10 extent is on */
function profileCorr(lv, c, fromHuc){ const L_ = D.levels[lv], par = parentOf(lv, c), v = (th, f) => val(th, f, lv, c); let b = '';
  // land
  let landSec = '';
  if (D.themes.lands){ landSec = `<div class="sec" style="--hue:${HUE.lands}"><h3>Land administrators</h3>`;
    if (has('lands', lv, c)){ const raw = v('lands','MGRS') || [], mg = []; for (let k = 0; k < raw.length; k += 2) mg.push([D.cats.MGR[raw[k]], raw[k+1]]);
      const n = mg.length, pl = v('lands','PCT_LAND');
      landSec += `<p>${n} ${n === 1 ? 'administrator has' : 'administrators have'} mapped land in this cell. Each share is of the mapped land, not of the whole cell:</p>` + topSix(mg, x => `<div><span>${esc(x[0])}</span><span>${pctLt1(x[1])}</span></div>`, 'keys nosw', 'more');
      if (pl != null) landSec += `<p style="margin-top:8px">Mapped land covers about ${pctLt1(pl)} of this cell.</p>`;
      landSec += '<p class="none" style="font-size:13.5px;margin-top:8px">Generalized to the cell from tract records. Not a boundary determination, and not a record of who administers any given spot.</p>';
    } else landSec += '<p class="none">No land records summarized for this cell.</p>';
    landSec += '</div>'; }

  // vegetation
  b += `<div class="sec" style="--hue:${HUE.veg}"><h3>Vegetation</h3>`;
  if (has('veg', lv, c)){
    b += `<div class="facts"><div><b>${v('veg','VEG_AREA') < 1 ? '<1' : fmt(v('veg','VEG_AREA'),0)}</b>acres mapped</div><div><b>${fmt(v('veg','PCT_MAPPED'), v('veg','PCT_MAPPED') < 10 ? 1 : 0)}%</b>of the cell</div><div><b>${fmt(v('veg','N_TYPES'),0)}</b>vegetation types</div></div>`;

    const cp = v('veg','COMP') || [], ty = []; for (let k = 0; k < cp.length; k += 2) ty.push([D.cats.DOM_TYPE[cp[k]], cp[k+1]]);
    b += '<p>Vegetation types, by share of the mapped acres:</p>' + topSix(ty, vegRow, 'keys', 'more types');
    b += coverHTML(L2.map(x => [x[1], v('veg', x[0]) || 0, x[2]]));
  } else b += '<p class="none">The vegetation map does not reach this cell.</p>';
  b += '</div>';

  b += recSection(lv, c) + invSection(lv, c) + cultSection(lv, c) + birdSection(lv, c) + visSection(lv, c);

  // review priority (shown only once unlocked)
  const jStart = b.length;
  let plv = lv, pc = c, viaParent = false;
  if (!D.themes.nrpz[lv] && par){ plv = par[0]; pc = par[1]; viaParent = true; }
  b += `<div class="sec" style="--hue:${HUE.nrpz}"><h3>Unique species</h3>`;
  if (D.themes.nrpz[plv] && has('nrpz', plv, pc)){ const t = cat('review_tie', val('nrpz','review_tie',plv,pc)), e = CATCOL.review_tie.find(x => x[0] === t);
    b += `<p><span class="badge" style="background:${e[1]};color:${t === 'Avoid' ? '#fff' : '#142235'}">${esc(e[2] || t)}</span></p>`;
    if (viaParent) b += '<p class="none">Shown for the 7 sq mi cell this square mile sits in.</p>';
  } else b += `<p class="none">No rare species priority zone ${viaParent ? 'in the surrounding 7 sq mi cell' : 'in this cell'}.</p>`;
  b += '</div>'; if (!JERRY) b = b.slice(0, jStart);
  b += S.q.id === 'wet' ? wetSection(lv, c) + soilSection(lv, c) : soilSection(lv, c) + wetSection(lv, c);
  b += geoSection(lv, c) + tvSection(lv, c) + wxSection(lv, c) + dymSection(lv, c) + fhrSection(lv, c) + fcSection(lv, c);
  b += featSection(lv, c);
  b += histSection(lv, c);
  b += phSection(lv, c);
  b = S.q.id === 'rest' ? restSection(lv, c) + b : b + restSection(lv, c);
  finishProfile((fromHuc ? '<p class="none" style="font-size:13.5px;margin:0 0 10px">This cell is in the A.T. corridor grid, so every layer mapped for the corridor is shown. Cells outside the corridor show the watershed layers only.</p>' : '') + b + landSec); inatLive([ring(lv, c)], L_.id[c]); }
/* Trail features section: facility lists by type, side trails, maintained landscapes, and estimated trail structures */
const FTYPES = [['Shelter','Shelters'],['Campsite','Campsites'],['Privy','Privies'],['Parking','Parking areas'],['Bridge','Bridges'],['Vista','Vistas'],['Building','Buildings'],['Dam','Dams'],['Tunnel','Tunnels']];
const SGROUPS = [['S_DRAIN','Drainage','Drainage'],['S_STEPS','Steps and climbs','Steps and climbs'],['S_SIGNS','Signs','Signs'],['S_BARR','Barriers and crossings','Barriers and crossings']];
const miTxt = x => x == null ? '–' : x < .05 && x > 0 ? 'under 0.1 mi' : fmt(x, 1) + ' mi';
/* a list of features, grouped by type; each name zooms the map to the feature */
function featLists(ids, tagFn){ let b = '';
  FTYPES.forEach(([t, lab]) => { const it = ids.filter(fi => D.feat[fi][0] === t); if (!it.length) return;
    const li = it.map(fi => { const f = D.feat[fi]; return `<li><button type="button" data-fly="${fi}">${esc(f[1])}</button><em>${esc(f[2] || '')}${tagFn ? tagFn(fi) : ''}</em></li>`; }).join('');
    b += it.length > 8 ? `<details${t === 'Vista' ? '' : ' open'}><summary>${lab} (${it.length})</summary><ul class="flist">${li}</ul></details>` : `<p style="margin:8px 0 0">${lab} (${it.length})</p><ul class="flist">${li}</ul>`; });
  return b; }
function structHTML(items, note){ if (!items.length) return '';
  let b = '<details><summary>Trail structures (estimated)</summary>';
  SGROUPS.forEach(([, g]) => { const it = items.filter(x => x[0] === g); if (!it.length) return; const tot = it.reduce((a, x) => a + x[2], 0);
    b += `<p style="margin:8px 0 2px">${g}: about ${fmt(tot, 0)}</p><div class="keys nosw">` + it.map(x => `<div><span>${esc(x[1])}</span><span>${fmt(x[2], 0)}</span></div>`).join('') + '</div>'; });
  return b + `<p class="none" style="font-size:13.5px;margin-top:6px">${note}</p></details>`; }
const STRUCT_NOTE = 'Trail structures are counted by maintainer section. Each section’s counts are spread over the cells it crosses by their share of its trail miles, so these are estimates. Boardwalk, retaining walls, turnpike and other items measured in feet are not included.';
function featSection(lv, c){ if (!D.themes.feat || !D.themes.feat[lv]) return '';
  const v = f => val('feat', f, lv, c), ids = v('LIST') || [], side = v('SIDE') || [], ml = v('ML') || [], rd = v('ROADS') || [];
  let b = `<div class="sec" style="--hue:${HUE.feat}"><h3>Facilities and landscapes</h3>`;
  b += `<div class="facts"><div><b>${miTxt(v('AT_MI'))}</b>of the A.T.</div><div><b>${fmt(v('N_FAC') || 0, 0)}</b>${v('N_FAC') === 1 ? 'facility' : 'facilities'}</div><div><b>${fmt(v('N_VISTA') || 0, 0)}</b>${v('N_VISTA') === 1 ? 'vista' : 'vistas'}</div></div>`;
  if (!ids.length && !side.length && !ml.length && !v('AT_MI')) b += '<p class="none">No trail features recorded in this cell.</p>';
  b += featLists(ids);
  if (side.length) b += `<details><summary>Side trails (${side.length}), ${miTxt(v('SIDE_MI'))}</summary><ul class="flist">${side.map(x => `<li><span>${esc(x[0])}</span><em>${miTxt(x[1])}</em></li>`).join('')}</ul></details>`;
  if (ml.length) b += `<details><summary>Maintained landscapes (${ml.length}), ${fmt(v('ML_AC'), 0)} acres</summary><ul class="flist">${ml.map(x => `<li><span>${esc(x[0])}${x[1] ? ' <em>' + esc(x[1]) + '</em>' : ''}</span><em>${fmt(x[2], x[2] < 10 ? 1 : 0)} ac</em></li>`).join('')}</ul></details>`;
  if (rd.length) b += `<p style="margin:8px 0 0">Administrative roads</p><ul class="flist">${rd.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul>`;
  b += structHTML(v('ST') || [], STRUCT_NOTE);
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">${FEATDONE ? `${FEATGOT.map(x => FTYPES.find(t => t[0] === x[0])[1].toLowerCase()).join(', ')} live from the A.T. facilities map service (the same as the map layers), loaded ${FEATAT.toLocaleString('en-US', {month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit'})}; other features from the A.T. facilities inventory.` : 'From the A.T. facilities inventory (official and additional features); live counts load shortly.'} Select a name to zoom to it.</p>`;
  return b + '</div>'; }
function featBox(lv, cells){ if (!D.themes.feat || !D.themes.feat[lv]) return '';
  const sum = f => cells.reduce((a, c) => a + (val('feat', f, lv, c) || 0), 0), ids = [], side = new Map(), ml = new Map(), st = new Map();
  cells.forEach(c => { (val('feat','LIST',lv,c) || []).forEach(fi => ids.push(fi));
    (val('feat','SIDE',lv,c) || []).forEach(x => side.set(x[0], (side.get(x[0]) || 0) + x[1]));
    (val('feat','ML',lv,c) || []).forEach(x => ml.set(x[0], (ml.get(x[0]) || 0) + x[2]));
    (val('feat','ST',lv,c) || []).forEach(x => { const k = x[0] + '|' + x[1]; st.set(k, (st.get(k) || 0) + x[2]); }); });
  ids.sort((a, b) => D.feat[a][1].localeCompare(D.feat[b][1]));
  let b = `<div class="sec" style="--hue:${HUE.feat}"><h3>Facilities and landscapes</h3>`;
  b += `<div class="facts"><div><b>${miTxt(sum('AT_MI'))}</b>of the A.T.</div><div><b>${fmt(sum('N_FAC'), 0)}</b>facilities</div><div><b>${fmt(sum('N_VISTA'), 0)}</b>vistas</div></div>`;
  b += '<div class="keys nosw" style="margin-top:6px">' + FTYPES.map(([t, lab]) => { const n = sum('N_' + t.toUpperCase()); return n ? `<div><span>${lab}</span><span>${fmt(n, 0)}</span></div>` : ''; }).join('') +
    `<div><span>Side trails</span><span>${miTxt(sum('SIDE_MI'))}</span></div><div><span>Maintained landscapes</span><span>${fmt(sum('ML_AC'), 0)} acres</span></div></div>`;
  if (ids.length) b += `<details><summary>Every feature in the selection (${ids.length})</summary>${featLists(ids)}</details>`;
  if (side.size) b += `<details><summary>Side trails (${side.size})</summary><ul class="flist">${[...side].sort((a, b) => b[1] - a[1]).map(x => `<li><span>${esc(x[0])}</span><em>${miTxt(x[1])}</em></li>`).join('')}</ul></details>`;
  if (ml.size) b += `<details><summary>Maintained landscapes (${ml.size})</summary><ul class="flist">${[...ml].sort((a, b) => b[1] - a[1]).map(x => `<li><span>${esc(x[0])}</span><em>${fmt(x[1], x[1] < 10 ? 1 : 0)} ac</em></li>`).join('')}</ul></details>`;
  b += structHTML([...st].map(([k, n]) => { const p = k.split('|'); return [p[0], p[1], Math.round(n)]; }).filter(x => x[2] > 0), STRUCT_NOTE);
  return b + '</div>'; }
/* a feature name zooms the map to it */
document.getElementById('pbody').addEventListener('click', e => { const b = e.target.closest('button[data-fly]'); if (!b) return; const f = D.feat[+b.dataset.fly];
  map.setView([f[3], f[4]], Math.max(map.getZoom(), 15)); flyMark.setLatLng([f[3], f[4]]).addTo(map); setTimeout(() => flyMark.remove(), 4000); });
const flyMark = L.circleMarker([0, 0], {radius:11, color:'#FFC233', weight:3, fill:false, interactive:false});
/* Soils section of the details panel for one cell */
const ptsOf = (p, w) => { const d = (+w) % 1 ? 1 : 0; return `${fmt(Math.min(p, w), d)} / ${fmt(w, d)}`; };
const soilRow = (label, x) => `<div><span>${label}</span><span>${x}</span></div>`;
const soilScore = x => x == null ? 'not rated' : fmt(x, 2);
function soilSection(lv, c){ if (!D.themes.soil) return '';
  const v = f => val('soil', f, lv, c), k = f => cat(f, v(f)), t = (x, u) => x == null ? '–' : fmt(x, 0) + (u || '');
  let b = `<div class="sec" style="--hue:${HUE.soil}"><h3>Soils</h3>`;
  if (!has('soil', lv, c)) return b + '<p class="none">No soil survey data for this cell.</p></div>';
  const vi = v('VULN');
  b += vi != null
    ? `<div class="facts"><div><b>${fmt(vi, 2)}</b>trail vulnerability, ${vulnClass(vi).toLowerCase()}</div><div><b>${soilPct(v('VULN_HIGH'))}</b>of soils rated high</div><div><b>${soilPct(v('PATHS_VLIM'))}</b>very limited for paths</div></div>`
    : '<p class="none">The trail ratings are not available for these soils. This is common where the survey is incomplete or rock outcrop dominates.</p>';
  b += '<div class="keys nosw" style="margin-top:8px">' + soilRow('At least one rating at its worst', soilPct(v('WORST1'))) + '</div>';
  b += `<p style="margin-top:8px">NRCS rating scores, 0 to 1, higher is more limiting (average ${soilScore(v('NRCS_IDX'))}):</p><div class="keys nosw">` +
    soilRow('Erosion hazard, unsurfaced trails', soilScore(v('EROS_HR'))) + soilRow('Paths and trails', soilScore(v('PATHS_HR'))) + soilRow('Rutting hazard', soilScore(v('RUT_HR'))) + '</div>';
  b += '<div class="keys nosw" style="margin-top:6px">' + soilRow('Severe rutting hazard', soilPct(v('RUT_SEV'))) + soilRow('Slopes over 25%', soilPct(v('STEEP'))) +
    soilRow('Average slope', t(v('SLOPE'), '%')) + soilRow('Highly erodible (K over 0.32)', soilPct(v('K_HIGH'))) + soilRow('Already eroded', soilPct(v('ERODED'))) +
    soilRow('Shallow to bedrock (under 50 cm)', soilPct(v('SHALLOW_ROCK'))) + soilRow('High frost action', soilPct(v('FROST_HIGH'))) + soilRow('Subject to flooding', soilPct(v('FLOOD'))) + '</div>';
  const sr = v('SOIL_SERIES') != null ? `${esc(k('SOIL_SERIES'))} (${fmt(v('DOM_SERIES_PCT'), 0)}%)` : '–', mun = v('DOM_MAPUNIT') || k('SOIL_MAPUNIT'), mu = mun ? `${esc(mun)} (${fmt(v('DOM_MAPUNIT_PCT'), 0)}%)` : '–';
  b += '<details><summary>Soil type</summary><div class="keys nosw">' + soilRow('Main soil series', sr) + (v('TOP_SERIES') ? soilRow('Largest series', esc(v('TOP_SERIES'))) : '') +
    soilRow('Soil series in the cell', t(v('N_SERIES'))) + soilRow('Surface texture', esc(k('SOIL_TEXTURE') || '–')) + soilRow('Soil order', esc(k('SOIL_ORDER') || '–')) +
    soilRow('Drainage', esc(k('SOIL_DRAIN') || '–')) + soilRow('Hydrologic group', esc(k('SOIL_HSG') || '–')) + soilRow('Ecological site', esc(k('SOIL_ECOSITE') || '–')) + '</div>' +
    `<p class="none" style="font-size:13.5px;margin-top:6px">Main map unit: ${mu}</p></details>`;
  b += '<details><summary>Restoration</summary><div class="keys nosw">' + soilRow('Hydric (wet) soils', soilPct(v('HYDRIC'))) + soilRow('Poorly drained', soilPct(v('POOR_DRAIN'))) +
    soilRow('Droughty', soilPct(v('DROUGHTY'))) + soilRow('Depth to water table', t(v('WTDEP'), ' cm')) + soilRow('Depth to bedrock', t(v('ROCKDEP'), ' cm')) +
    soilRow('Surface pH', v('PH') == null ? '–' : fmt(v('PH'), 1)) + soilRow('Organic matter', v('OM') == null ? '–' : fmt(v('OM'), 1) + '%') + '</div></details>';
  b += '<details><summary>Agriculture</summary><div class="keys nosw">' + soilRow('Prime farmland', soilPct(v('PRIME'))) + soilRow('Prime if drained or irrigated', soilPct(v('PRIME_COND'))) +
    soilRow('Farmland of statewide importance', soilPct(v('STATEWIDE'))) + soilRow('Main farmland class', esc(k('SOIL_FARM') || '–')) +
    soilRow('Land capability class 1 to 2', soilPct(v('LCC12'))) + soilRow('Land capability class 1 to 4', soilPct(v('LCC14'))) +
    soilRow('Crop productivity index (NCCPI)', v('NCCPI') == null ? '–' : fmt(v('NCCPI'), 2)) + '</div></details>';
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">From the NRCS soil survey (gSSURGO), area-weighted over the cell; soil data covers ${soilPct(v('SOIL_COV'))} of it. The index rates the soil, not the trail: tread grade, drainage structures and use are not included. A screening aid at survey scale.</p>`;
  return b + '</div>'; }
/* Recent iNaturalist observations, fetched live for the selected cell or cells (inat-lookup.js above).
   Species on the page's invasive, priority invasive and forest pest lists get a badge. */
let INATFLAGS = null;
const INAT_MAX_SPAN = 1; /* degrees: the API returns only the newest records in the bounding box, so a wide selection would find almost none inside its cells */
/* The list is folded by default and fetched only when it can be seen: opened, inside an open iNaturalist section,
   and not in the phone's short summary. Once opened it stays open for the next cell. inatCheck() runs whenever one of those changes. */
let inatCheck = () => {};
const visCheck = () => inatCheck();
/* ---------- iNaturalist Records: the quarterly download summarized for a cell or a selection, with the live lookup below ----------
   Groups are counted from research-grade records in the GBIF download (build_inat_ebird.py): records (_OBS) and species (_SPP).
   The live lookup is fetched only when it can be seen: its section open, and not in the phone's short summary. */
var RECG = [['Plants','PLANT'],['Insects','INSECT'],['Birds','BIRD'],['Fungi','FUNGI'],['Spiders and kin','ARACHNID'],['Mammals','MAMMAL'],
  ['Amphibians','AMPHIB'],['Reptiles','REPTILE'],['Snails and other mollusks','MOLLUSK']];
function recPct(lv, c, k){ const n = val('inat','N_OBS',lv,c), g = val('inat', k + '_OBS', lv, c); return n && g != null ? 100 * g / n : null; }
function recP(x){ return x == null ? '' : x > 0 && x < 1 ? '<1%' : fmt(x, 0) + '%'; }
/* rows: [label, records or null, species or null]; n: all records */
function recGroups(rows, n, spLab){ const hasObs = rows.some(r => r[1] != null);
  if (hasObs){ const sum = rows.reduce((s, r) => s + (r[1] || 0), 0); if (n > sum) rows = rows.concat([['Everything else', n - sum, null]]); }
  rows = rows.filter(r => (hasObs ? r[1] : r[2]) > 0).sort((a, b) => (hasObs ? b[1] - a[1] : b[2] - a[2]));
  if (!rows.length) return '';
  const mx = Math.max(...rows.map(r => hasObs ? r[1] : r[2]));
  return `<p style="margin-top:8px">${hasObs ? 'What the records are of, as a share of all records' + (spLab ? ' (species in grey)' : '') : 'Species recorded, by group'}:</p>` +
    rows.map(r => { const x = hasObs ? r[1] : r[2], sp = spLab && hasObs && r[2] ? ` <em style="color:var(--muted);font-style:normal;font-size:12.5px">${fmt(r[2], 0)} spp.</em>` : '';
      return `<div class="guild rg"><div>${esc(r[0])}${sp}</div><div><span style="width:${100 * x / mx}%"></span></div><div>${hasObs ? recP(n ? 100 * x / n : 0) : fmt(x, 0)}</div></div>`; }).join('') +
    (hasObs ? '' : '<p class="none" style="font-size:13.5px;margin-top:6px">Shares of records come with the next quarterly download.</p>'); }
/* priority invasive (EDRR list, APPA priority or forest pest) and invasive flags by species, from every cell's lists */
let RECFLAG = null;
function recFlags(){ const t = D.themes.inat; if (RECFLAG && RECFLAG.t === t) return RECFLAG; const pri = new Set(), inv = new Set();
  Object.values(t || {}).forEach(L => { [['EDRR_LIST', pri], ['PEST_LIST', pri], ['INVASIVE_LIST', inv]].forEach(([f, set]) => (L.f[f] || []).forEach(a => (a || []).forEach(i => set.add(i)))); });
  Object.values(D.themes.edd || {}).forEach(L => { [['EDD_EDRR_LIST', pri], ['EDD_PEST_LIST', pri], ['EDD_INV_LIST', inv]].forEach(([f, set]) => (L.f[f] || []).forEach(a => (a || []).forEach(i => set.add(i)))); });
  return RECFLAG = {t, pri, inv}; }
function recItem(i){ const F = recFlags(), p = F.pri.has(i); let h = sppItem(i, p, true); if (!p && F.inv.has(i)) h = h.replace(/(<\/a>)/, '$1<span class="tag">invasive</span>'); return h; }
var LIVEBODY = '<h4 class="livehd">Live lookup</h4><p class="none" style="font-size:13.5px">The most recent observations here, fetched from iNaturalist now, including ones not yet research grade. They are separate from the counts above.</p><div id="inatrec"><div id="inatlive" style="margin-top:6px"></div></div>';
function recOpen(){ return `<div class="sec" style="--hue:${HUE.live};--tint:36%"><h3>iNaturalist Records</h3>`; }
function recSection(lv, c){ const v = f => val('inat', f, lv, c); let b = recOpen();
  if (has('inat', lv, c)){ const n = v('N_OBS') || 0, rc = v('N_OBS_RECENT'), top = v('TOP10_SPECIES') || [], tn = v('TOP10_COUNTS') || [];
    b += `<div class="facts"><div><b>${fmt(n, 0)}</b>${n === 1 ? 'record' : 'records'}</div><div><b>${fmt(v('N_SPP') || 0, 0)}</b>species</div><div><b>${fmt(v('N_OBSERVERS') || 0, 0)}</b>${v('N_OBSERVERS') === 1 ? 'observer' : 'observers'}</div></div>`;
    b += `<div class="facts"><div><b>${rc == null ? '–' : fmt(rc, 0)}</b>${rc === 1 ? 'record' : 'records'} in the last 3 years</div></div>`;
    b += `<p style="margin-top:6px"><span class="badge">${esc(cat('DATA_STATUS', v('DATA_STATUS')) || '')}</span> Research-grade records, quarterly download (${esc(D.run)}). Latest record ${esc(v('LAST_OBS') || 'unknown')}.</p>`;
    { const k = cover('inat', lv, c); if (k != null) b += `<p class="none" style="font-size:13.5px">Records fall in ${k} of this cell's ${HEXIN[lv]} square miles.</p>`; }
    b += recGroups(RECG.map(([lab, k]) => [lab, v(k + '_OBS'), v(k + '_SPP')]), n, true);
    { const nn = v('N_NONNATIVE_PLANT_SPP'), ns = v('PLANT_SPP'); if (nn != null && ns) b += `<p class="none" style="font-size:13.5px;margin-top:6px">Native plants: ${recP(100 * (ns - nn) / ns)} of ${fmt(ns, 0)} plant species${nn ? ` (${fmt(nn, 0)} introduced)` : ''}.</p>`; }
    if (top.length) b += `<details><summary>Most recorded species</summary><ul class="spp">${top.map((i, k) => tn[k] != null ? recItem(i).replace('</li>', `<span class="tag">${fmt(tn[k], 0)} ${tn[k] === 1 ? 'record' : 'records'}</span></li>`) : recItem(i)).join('')}</ul></details>`;
  } else b += '<p class="none">No research-grade iNaturalist records in this cell in the quarterly download.</p>';
  return b + LIVEBODY + '</div>'; }
function recBox(lv, cells){ let b = recOpen(); const cs = D.themes.inat && D.themes.inat[lv] ? cells.filter(c => has('inat', lv, c)) : [], N = cells.length;
  if (cs.length){ const sum = f => cs.reduce((s, c) => s + (val('inat', f, lv, c) || 0), 0), any = f => cs.some(c => val('inat', f, lv, c) != null);
    const n = sum('N_OBS'), mxs = Math.max(...cs.map(c => val('inat','N_SPP',lv,c) || 0));
    b += `<div class="facts"><div><b>${fmt(n, 0)}</b>records</div><div><b>${any('N_OBS_RECENT') ? fmt(sum('N_OBS_RECENT'), 0) : '–'}</b>in the last 3 years</div><div><b>${cs.length}</b>of ${N} cells with records</div></div>`;
    b += `<p class="none" style="font-size:13.5px">Research-grade records, quarterly download (${esc(D.run)}). Records are added up. Species and observers can't be added across cells; the richest cell has ${fmt(mxs, 0)} species.</p>`;
    b += recGroups(RECG.map(([lab, k]) => [lab, any(k + '_OBS') ? sum(k + '_OBS') : null, null]), n, false);
    { /* Combined top ten, collapsible. With record counts in the data (TOP10_COUNTS) the counts are added across cells.
         Without them, each cell's ranking is merged: 10 points for a first place down to 1 for a tenth. */
      const hasN = !!(D.themes.inat[lv].f.TOP10_COUNTS), sc = new Map();
      cs.forEach(c => { const ids = val('inat','TOP10_SPECIES',lv,c) || [], ns = hasN ? (val('inat','TOP10_COUNTS',lv,c) || []) : [];
        ids.forEach((i, r) => { const e = sc.get(i) || [0, 0]; e[0] += hasN ? (ns[r] || 0) : Math.max(1, 10 - r); e[1]++; sc.set(i, e); }); });
      const top = [...sc].sort((a,b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || D.spp[a[0]].localeCompare(D.spp[b[0]])).slice(0, 10);
      const tag = x => recItem(x[0]).replace('</li>', `<span class="tag">${hasN ? fmt(x[1][0], 0) + (x[1][0] === 1 ? ' record, ' : ' records, ') : ''}${nCells(x[1][1])}</span></li>`);
      if (top.length) b += `<details class="t10" ${S.t10 === false ? '' : 'open'}><summary>Top ten species across the selection</summary><ol class="spp top10">${top.map(tag).join('')}</ol><p class="none" style="font-size:13.5px;margin-top:6px">` +
        (hasN ? 'Record counts are added across the selected cells. A species is counted only in cells where it is among the ten most recorded, so its true total can be higher.'
              : 'Ranked from each cell\'s own top ten: first place in a cell counts most, tenth least. The number beside each species is how many selected cells list it.') + '</p></details>'; }
  } else b += '<p class="none">No research-grade iNaturalist records in the selected cells in the quarterly download.</p>';
  return b + LIVEBODY + '</div>'; }
/* invasive species for one cell: the interpreted quarterly summary */
function invSection(lv, c){ const v = (th, f) => val(th, f, lv, c); let b = `<div class="sec" style="--hue:${HUE.inat}"><h3>Invasive species</h3>`;
  if (hasInv(lv, c)){ const inv = invL('INVASIVE_LIST', lv, c) || [], ed = new Set(invL('EDRR_LIST', lv, c) || []), pest = invL('PEST_LIST', lv, c) || [], T = invSrc(lv, [c]);
    const nInv = invCount(lv, c), nPri = priCount(lv, c), sh = invShare(lv, c), big = n => n ? fmt(n, 0) : 'None';
    b += `<div class="facts"><div><b>${big(nInv)}</b>invasive species</div><div><b>${big(nPri)}</b>priority invasives</div><div><b>${sh ? fmt(sh, sh < 10 ? 1 : 0) + '%' : 'None'}</b>of iNat records</div></div>`;
    b += `<p class="none" style="font-size:13.5px">Invasive plants and forest pests are counted together, from iNaturalist and EDDMapS. Species reported in EDDMapS are flagged.</p>`;
    b += invPlantsHTML(inv.map(i => [i, null]), ed, lv, [c]);
    b += pest.length ? `<p style="margin-top:8px">${pest.length} forest ${pest.length === 1 ? 'pest' : 'pests'}:</p><ul class="spp">${pest.map(i => srcItem(i, T, false)).join('')}</ul>` : '<p class="none" style="margin-top:8px">No forest pests reported.</p>';
    b += has('inat', lv, c) ? `<p style="margin-top:10px"><span class="badge">${esc(cat('DATA_STATUS', v('inat','DATA_STATUS')) || '')}</span> Quarterly summary (${esc(D.run)}), from ${fmt(v('inat','N_OBS'),0)} iNaturalist ${v('inat','N_OBS') === 1 ? 'record' : 'records'}.</p>` : '<p class="none" style="margin-top:10px">No iNaturalist records in this cell in the quarterly summary.</p>';
    b += eddNote(lv, [c]) + eddDetail(lv, [c]);
  } else b += `<p class="none">No iNaturalist${D.themes.edd && D.themes.edd[lv] ? ' or EDDMapS' : ''} records in this cell in the quarterly summary.</p>`;
  return b + '</div>'; }
/* birds for one cell */
function visBox(lv, cells){ const many = cells.length > 1; let b = `<div class="sec" style="--hue:${HUE.eff}"><h3>Citizen science observers</h3>`;
  if (!D.themes.vis || !D.themes.vis[lv]) return b + '<p class="none">The visitation summaries have not been built yet. They are added the next time the iNaturalist workflow runs.</p></div>';
  const P = visPool(lv, cells); if (!P.n) return b + `<p class="none">No observer-days in ${many ? 'the selected cells' : 'this cell'}.</p></div>`;
  const yr = P.yr;
  b += `<div class="facts"><div><b>${fmt(Math.round(yr), 0)}</b>observer-days a year</div><div><b>${fmt(P.obsr, 0)}</b>${many ? 'observers (by cell)' : 'observers'}</div><div><b>${P.peak != null ? CATCOL.VIS_PEAK[P.peak][0].slice(0, 3) : '–'}</b>peak month</div></div>`;
  b += `<div class="facts"><div><b>${P.pi + P.pe ? fmt((P.ri + P.re) / (P.pi + P.pe), 1) : '–'}</b>records per observer-day</div></div>`;

  b += `<p class="none" style="font-size:13.5px">${fmt(P.src[0], 0)} iNaturalist and ${fmt(P.src[1], 0)} eBird observers, ${fmt(P.src[2], 0)} EDDMapS report-days${many ? ', added up cell by cell' : ''}. Observer-days per year average the latest three years with eBird data. An index of naturalist and birder activity, not a count of visitors.</p>`;
  return b + '</div>'; }
const visSection = (lv, c) => visBox(lv, [c]);
function birdSection(lv, c){ const v = (th, f) => val(th, f, lv, c); let b = `<div class="sec" style="--hue:${HUE.ebird}"><h3>Birds</h3>`;
  if (has('ebird', lv, c)){ const G = BIRD_GROUPS.map(g => [g.label, v('ebird', g.spp) || 0, v('ebird', g.list) || [], g.spp]); const mx = Math.max(1, ...G.map(g => g[1])); const soc = v('ebird','SOC_LIST') || [];
    b += `<div class="facts"><div><b>${fmt(v('ebird','N_SPP'),0)}</b>species</div><div><b>${fmt(v('ebird','N_CHECKLISTS'),0)}</b>checklists</div><div><b>${fmt(v('ebird','N_BCC_SPP'),0)}</b>of conservation concern</div></div>`;
    b += `<p><span class="badge">${esc(cat('DATA_STATUS', v('ebird','DATA_STATUS')) || '')}</span> Latest checklist ${esc(v('ebird','LAST_OBS') || 'unknown')}</p>`;
    { const k = cover('ebird', lv, c); if (k != null) b += `<p class="none" style="font-size:13.5px">Checklists fall in ${k} of this cell's ${HEXIN[lv]} square miles.</p>`; }
    b += '<p style="margin-top:8px">Species by habitat group. Open a group marked with an arrow to see its species.</p>' + G.filter(g => g[1] > 0).map(g => { const bar = `<div>${g[0]}</div><div><span style="width:${100*g[1]/mx}%"></span></div><div>${g[1]}</div>`;
      return g[2] && g[2].length ? `<details class="gd"${S.m.f === g[3] ? ' open' : ''}><summary class="guild">${bar}</summary><ul class="spp">${g[2].map(i => sppItem(i)).join('')}</ul></details>` : `<div class="guild">${bar}</div>`; }).join('');
    if (soc.length) b += `<details><summary>${soc.length} species on watch lists</summary><ul class="spp">${soc.map(i => sppItem(i)).join('')}</ul><p class="none" style="font-size:13.5px">BCC is the USFWS Birds of Conservation Concern list. PIF is Partners in Flight.</p></details>`;
  } else b += '<p class="none">No eBird checklists in this cell yet.</p>';
  return b + '</div>'; }
var HUCONLY = 'Vegetation, land administrators, unique species, facilities and restoration are mapped only for the A.T. corridor.';
function inatLive(rings, id){ const d = $('#inatrec'); if (!d) return; let done = false;
  inatCheck = () => { if (!done && d.isConnected && d.getClientRects().length){ done = true; inatFetch(rings, id); } };
  setTimeout(() => inatCheck()); /* after select() has finished laying out the panel (on phones it then shrinks to the summary) */ }
function inatFetch(rings, id){ const el = $('#inatlive'); if (!el || !window.ATiNat) return;
  const la = rings.flat().map(p => p[0]), lo = rings.flat().map(p => p[1]);
  if (Math.max(...la) - Math.min(...la) > INAT_MAX_SPAN || Math.max(...lo) - Math.min(...lo) > INAT_MAX_SPAN){
    el.innerHTML = '<p class="none" style="font-size:13.5px">Select a smaller area, or a single cell, to see live iNaturalist observations.</p>'; return; }
  ATiNat.lookup({type:'MultiPolygon', coordinates:rings.map(r => [r.map(p => [p[1], p[0]])])}, el, {id, flags:inatFlags()}); }
/* lowercase scientific name -> badge, from the page's invasive, forest pest and priority invasive lists */
function inatFlags(){ if (!INATFLAGS){ INATFLAGS = {};
    [['INVASIVE_LIST','Invasive'],['PEST_LIST','Forest pest'],['EDRR_LIST','Priority invasive']].forEach(([f, label]) =>
      [D.themes.inat, D.themes.edd].forEach(T => Object.values(T || {}).forEach(t => (t.f[f] || t.f[EDDF[f]] || []).forEach(a => a.forEach(i => { INATFLAGS[sppName(i).sci.toLowerCase()] = label; }))))); }
  return INATFLAGS; }
/* ---------- priority species ----------
   Species where every record matters. The quarterly summary only lists them in cells where they rank among the ten
   most-recorded iNaturalist species, so their records are fetched live from the iNaturalist project (once per visit)
   and placed in the grid's cells here. To add a species, add a line with its common and scientific names. The iNaturalist
   taxon is looked up by scientific name (exact match only); a taxon number from the species' iNaturalist page skips that step. */
const PRIORITY = [
  {common:'American black bear', sci:'Ursus americanus', taxon:41638},
  {common:'Northern bobwhite', sci:'Colinus virginianus'},
  {common:'Wavyleaf basketgrass', sci:'Oplismenus undulatifolius'},
  {common:'Beech leaf disease nematode', sci:'Litylenchus crenatae'}
];
/* the iNaturalist taxon for a scientific name; an exact name match only, so a near miss never loads the wrong species */
async function prioTaxon(p){ if (p.taxon) return p.taxon;
  const r = await fetch('https://api.inaturalist.org/v1/taxa?per_page=30&q=' + encodeURIComponent(p.sci)); if (!r.ok) throw new Error('HTTP ' + r.status);
  const rs = (await r.json()).results || [], nm = p.sci.toLowerCase();
  const t = rs.find(x => (x.name || '').toLowerCase() === nm) || rs.find(x => (x.matched_term || '').toLowerCase() === nm);  /* exact name, else a synonym iNaturalist matched */
  if (!t) throw new Error('No iNaturalist taxon named ' + p.sci); return p.taxon = t.id; }
const PRIO = {};   // full loads, by scientific name in lower case: {st:'loading'|'done'|'error', n, total, obscured, placed, counts:{hex,cog,wheel: Map cell -> records}, pts}
const prioState = p => PRIO[p.sci.toLowerCase()];
function prioStatus(p){ const st = prioState(p), where = 'iNaturalist project';
  if (!st || st.st === 'loading') return `Priority species. ${st && st.cached ? 'Checking for new research-grade records since your last visit' : 'Loading research-grade records from the ' + where}…` + (st && st.total ? ` ${fmt(st.n,0)} of ${fmt(st.total,0)}` : '') + (st && st.placed ? `, ${fmt(st.placed,0)} on the map so far` : '');
  if (st.st === 'error'){ const e = FIDX && FIDX.get(p.sci.toLowerCase()), rest = e && e.sumComplete ? ' Showing the quarterly summary.' : ' These are partial results.';
    return (st.notFound ? `Priority species. No iNaturalist taxon is named ${p.sci}, so no live records were loaded.` : 'Priority species. The live records could not be loaded just now.') + rest; }
  return `Priority species, live from the ${where}: ${fmt(st.placed,0)} research-grade ${st.placed === 1 ? 'record' : 'records'} placed in the grid` + (st.obscured ? `, ${fmt(st.obscured,0)} with obscured locations left out` : '') + '.'; }
/* One page of research-grade records. The newer API returns only the fields asked for, which keeps each page small;
   the older one is the fallback. iNaturalist asks for about one request a second, which paging one after another keeps to. */
const PRIOFIELDS = '(id:!t,quality_grade:!t,obscured:!t,geoprivacy:!t,taxon_geoprivacy:!t,geojson:all)';
let PRIO_V2 = true;
async function prioPage(params){ const q = (ATiNat.config.project ? 'project_id=' + encodeURIComponent(ATiNat.config.project) + '&' : '') + 'quality_grade=research&order_by=id&order=asc&per_page=200&' + params;
  if (PRIO_V2){ try { const r = await fetch('https://api.inaturalist.org/v2/observations?' + q + '&fields=' + encodeURIComponent(PRIOFIELDS)); if (!r.ok) throw 0;
      const j = await r.json(); if ((j.results || []).some(o => !o.geojson && !o.obscured)) throw 0; return j; } catch (e){ PRIO_V2 = false; } }
  const r = await fetch('https://api.inaturalist.org/v1/observations?' + q); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
/* a record's [lat, lon], or null when it is not research grade or its location is obscured (counted in tally.obscured) */
function prioKeep(o, tally){ if (o.quality_grade && o.quality_grade !== 'research') return null;
  if (o.obscured || ['obscured','private'].includes(o.geoprivacy) || ['obscured','private'].includes(o.taxon_geoprivacy)){ tally.obscured++; return null; }
  const c = o.geojson && o.geojson.coordinates; return c ? [Math.round(+c[1] * 1e5) / 1e5, Math.round(+c[0] * 1e5) / 1e5] : null; }
/* A full load is saved in this browser. A later visit fetches only records newer than the saved ones; after 30 days the
   saved copy is dropped and loaded again, so deleted or regraded records do not linger. */
const PRIO_KEEP = 30 * 864e5, prioKey = p => 'atgrid-prio-v1:' + (ATiNat.config.project || '') + ':' + p.sci.toLowerCase();
function prioSaved(p){ try { const x = JSON.parse(localStorage.getItem(prioKey(p))); if (x && Array.isArray(x.pts) && Date.now() - x.at < PRIO_KEEP) return x; } catch (e) {} return null; }
function prioSave(p, x){ try { localStorage.setItem(prioKey(p), JSON.stringify(x)); } catch (e) {} }
/* Every research-grade record of a species along the trail, for a search. Records are placed and shown as pages arrive. */
function prioFetch(p, retry){ const k = p.sci.toLowerCase(); let st = PRIO[k]; if (st && st.promise) return st.promise;
  if (st && st.st === 'error' && !retry) return Promise.reject(new Error('not loaded'));
  st = PRIO[k] = {st:'loading', n:0, total:null, obscured:0, placed:0, counts:{hex:new Map(), cog:new Map(), wheel:new Map()}, pts:[]};
  st.promise = (async () => { const taxon = await prioTaxon(p), saved = prioSaved(p); let above = 0;
    if (saved){ st.cached = true; st.n = saved.n; st.obscured = saved.obscured; st.pts = saved.pts; above = saved.maxId; prioPlace(saved.pts, st); }
    prioRefresh(p);
    for (let page = 0; page < 200; page++){
      const j = await prioPage(`taxon_id=${taxon}&id_above=${above}`), res = j.results || [];
      if (page === 0) st.total = st.n + (j.total_results || 0);
      const pts = res.map(o => prioKeep(o, st)).filter(Boolean); prioPlace(pts, st); pts.forEach(x => st.pts.push(x));
      st.n += res.length; if (res.length) above = res[res.length - 1].id;
      if (res.length < 200) break;
      prioRefresh(p, page % 3 !== 2); }   /* the status every page; the map and lists every third page */
    st.st = 'done'; prioSave(p, {at: saved ? saved.at : Date.now(), maxId: above, n: st.n, obscured: st.obscured, pts: st.pts}); prioRefresh(p); return st; })()
    .catch(e => { st.st = 'error'; st.notFound = /No iNaturalist taxon/.test(e.message); st.promise = null; prioRefresh(p); throw e; });
  return st.promise; }
/* Each record goes to the cell of each size that contains it: the nearest few cell centers are tested against the cell outline. */
const RINGS = {};
const inRingLL = (la, lo, r) => { let inside = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][0] > la) !== (r[j][0] > la) && lo < (r[j][1] - r[i][1]) * (la - r[i][0]) / (r[j][0] - r[i][0]) + r[i][1]) inside = !inside; return inside; };
const ringOf = (lv, c) => { const R = RINGS[lv] = RINGS[lv] || []; return R[c] = R[c] || ring(lv, c); };
function prioPlace(pts, st){
  for (const lv of SIZES){ const L_ = D.levels[lv], n = L_.id.length;
    for (const [la, lo] of pts){ const k = Math.cos(la * Math.PI / 180), near = [];
      for (let c = 0; c < n; c++){ const dy = L_.c[c][0] - la, dx = (L_.c[c][1] - lo) * k, d = dx*dx + dy*dy;
        if (near.length < 3 || d < near[2][0]){ near.push([d, c]); near.sort((a, b) => a[0] - b[0]); if (near.length > 3) near.pop(); } }
      for (const [, c] of near) if (inRingLL(la, lo, ringOf(lv, c))){ st.counts[lv].set(c, (st.counts[lv].get(c) || 0) + 1); if (lv === 'wheel') st.placed++; break; } } } }
/* Bring a search entry up to date: loaded cells are added to those the summary already knew (also while still loading). */
function prioApply(e){ const st = prioState(e.prio); if (!st) return;
  SIZES.forEach(lv => st.counts[lv].forEach((n, c) => e.cells[lv].add(c))); if (st.st === 'done') e.complete = true; }
function prioRefresh(p, progressOnly){ const e = FIDX && FIDX.get(p.sci.toLowerCase());
  if (progressOnly){ const s = document.querySelector('.findbar span'); if (S.m.find === e && s) s.textContent = prioStatus(p); return; }
  if (e) prioApply(e);
  if (S.m.find === e) redraw(); }
/* records of a species in one cell once its full load is done; null before that */
function prioCount(p, lv, c){ const st = prioState(p); return st && st.st === 'done' ? st.counts[lv].get(c) || 0 : null; }
/* panel sections follow the order of the questions; each question opens its own sections (survey effort has none of its own) */
const QSEC = {geo:['geo'], wx:['wx','dym'], tvul:['tvul'], fcond:['fcond','fhr','tfall'], cult:['cult'], rest:['rest'], veg:['veg'], rec:['live'], inv:['inat'], bird:['ebird'], mig:['ebird'], pri:['nrpz'], soil:['soil'], wet:['wet'], feat:['feat'], hist:['hist'], eff:['vis'], land:['lands'], phen:['phen'], pest:['phen']};
/* which question each popup section and export table belongs to; its place in the list of questions orders them, its color colors them */
const SECQ = {'Restoration targets':'rest', 'Invasive species':'inv', 'Priority invasives':'pinv', 'iNaturalist Records':'rec', 'Forest pests':'pest', 'Flowering':'phen',
  'Plants of cultural significance':'cult', 'Birds':'bird', 'Unique species':'pri', 'Vegetation':'veg', 'Geology':'geo', 'Soils':'soil', 'Wetlands':'wet',
  'Facilities and landscapes':'feat', 'Historic resources':'hist', 'Citizen science observers':'eff', 'Land administrators':'land', 'Weather and climate':'wx', 'Trail vulnerability':'tvul', 'Tree fall vulnerability':'fcond', 'Forest health risk':'fcond', 'Forest condition':'fcond', 'Climate change since 1980':'wx'};
const qRank = id => { const i = Q.findIndex(q => q.id === id); return i < 0 ? 98 : i; };
const secRank = title => title === 'Cell by cell' ? -1 : SECQ[title] ? qRank(SECQ[title]) : 99;
const secHue = title => { const q = Q.find(x => x.id === SECQ[title]); return q ? q.hue : null; };
/* export tables (CSV "table" column and Excel sheets) by question */
function expQ(t){ t = String(t);
  if (/^(About|Cell summary|Cells)/.test(t)) return null;
  if (/^Restoration/.test(t)) return 'rest'; if (/^Invasive plant/.test(t)) return 'inv'; if (/^Priority invasive/.test(t)) return 'pinv'; if (/^iNaturalist/.test(t)) return 'rec';
  if (/^Forest pest/.test(t)) return 'pest'; if (/^Flowering/.test(t)) return 'phen'; if (/cultural significance/.test(t)) return 'cult'; if (/^Bird/.test(t)) return 'bird';
  if (/^Priority species/.test(t)) return 'pri'; if (/^Vegetation/.test(t)) return 'veg'; if (/^(Geology|Bedrock|Geologic)/.test(t)) return 'geo'; if (/^Soils/.test(t)) return 'soil';
  if (/^Wetlands/.test(t)) return 'wet'; if (/^Facilit/.test(t)) return 'feat'; if (/^Historic/.test(t)) return 'hist'; if (/^Land admin/.test(t)) return 'land'; return 'zz'; }
const expRank = t => { if (/^About/.test(String(t))) return -2; const q = expQ(t); return q === null ? -1 : q === 'zz' ? 99 : qRank(q); };
/* Cells columns: the base columns, then each question's columns in the order of the questions */
const COLQ = [[/^(veg_|nlcd_)/, 'veg'], [/^inat_(invasive|priority)/, 'inv'], [/^inat_forest_pests/, 'pest'], [/^inat_/, 'rec'], [/^ebird_/, 'bird'], [/^unique_species/, 'pri'],
  [/^feat_/, 'feat'], [/^land_/, 'land'], [/^cultural_/, 'cult'], [/^visit_/, 'eff'], [/^(trail_vuln|trail_miles|trail_grade|trail_over|trail_side|trail_slope|trail_fall|trail_tree|trail_topo)/, 'tvul'], [/^wx_/, 'wx'], [/^forest_pest_risk/, 'pest']];
function expOrder(d){ d.cells = d.cells.map(r => { const ks = Object.keys(r), base = [], rest = [];
    ks.forEach((k, i) => { const m = COLQ.find(e => e[0].test(k)); if (m) rest.push([qRank(m[1]), i, k]); else base.push(k); });
    rest.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const o = {}; base.concat(rest.map(x => x[2])).forEach(k => o[k] = r[k]); return o; });
  d.species = d.species.map((r, i) => [expRank(r.group), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  return d; }
function finishProfile(html){ $('#pbody').innerHTML = html;
  {
    const secs = [...document.querySelectorAll('#pbody .sec')]; if (secs.length > 1){ const par = secs[0].parentNode, anchor = document.createComment('secs'); par.insertBefore(anchor, secs[0]);
      const rank = el => secRank((el.querySelector('h3') || {}).textContent);
      secs.map((el, i) => [rank(el), i, el]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([, , el]) => par.insertBefore(el, anchor)); anchor.remove(); } }
  { const d = document.querySelector('#pbody details.t10'); if (d) d.addEventListener('toggle', () => { S.t10 = d.open; }); }
  const SECKEY = {'Forest health risk':'fhr', 'Vegetation':'veg', 'Invasive species':'inat', 'Plants of cultural significance':'cult', 'Geology':'geo', 'Weather and climate':'wx', 'Trail vulnerability':'tvul', 'Tree fall vulnerability':'tfall', 'Forest condition':'fcond', 'Climate change since 1980':'dym', 'iNaturalist Records':'live', 'Birds':'ebird', 'Citizen science observers':'vis', 'Unique species':'nrpz', 'Soils':'soil', 'Wetlands':'wet', 'Facilities and landscapes':'feat', 'Restoration targets':'rest', 'Flowering':'phen', 'Forest pests':'phen', 'Priority invasives':'phen', 'Cell by cell':'cells', 'Historic resources':'hist', 'Land administrators':'lands'};
  document.querySelectorAll('#pbody .sec').forEach((sec, k) => { const h = sec.querySelector('h3'), key = SECKEY[h.textContent] || h.textContent, hue = secHue(h.textContent); if (hue) sec.style.setProperty('--hue', hue);
    const open = key in S.secOpen ? S.secOpen[key] : S.m.find ? key === S.m.th : (QSEC[S.q.id] || []).includes(key);
    const body = document.createElement('div'); body.className = 'secbody'; body.id = 'secbody' + k; body.hidden = !open;
    while (h.nextSibling) body.appendChild(h.nextSibling);
    sec.appendChild(body);
    h.innerHTML = `<button type="button" class="sectog" aria-expanded="${open}" aria-controls="${body.id}"><span>${esc(h.textContent)}</span><i aria-hidden="true"></i></button>`;
    h.firstChild.onclick = () => { const now = body.hidden; body.hidden = !now; S.secOpen[key] = now; store.set('secs', S.secOpen); h.firstChild.setAttribute('aria-expanded', now); visCheck(); }; }); $('#pbody').scrollTop = 0; $('#profile').classList.add('open');
  /* bring the open section into view (the flowering section sits last) */
  { const pb = $('#pbody'), o = pb.querySelector('.sectog[aria-expanded=true]'); if (o){ const d = o.getBoundingClientRect().top - pb.getBoundingClientRect().top; if (d > pb.clientHeight * .5) pb.scrollTop = d - 8; } } }

/* ---------- export of the selection shown in the popup ---------- */
const EXPORTBTNS = '<button type="button" class="exp" id="pextxt" title="Download a plain-language summary of the selected cells as a text file">Describe as text</button><button type="button" class="exp" id="pexcsv" title="Download everything in this panel as a CSV file">Export CSV</button><button type="button" class="exp" id="pexxls" title="Download everything in this panel as an Excel workbook">Export Excel</button><p class="pexmsg" id="pexmsg" role="status"></p>';
/* Describe as text: for each question, its headline measures for the selection, in words, with where the selection ranks
   among all cells of the same size. One cell gives its value; several give their range and middle value. The rare species
   rating is included only when it has been unlocked on this page, as in the exports. */
const DESC = [['rest', ['grass', 'forest']], ['tvul', ['score', 'grade', 'defrel']], ['feat', ['atmi', 'shel', 'camp', 'park', 'vist', 'side']],
  ['land', ['mgrs', 'appa']], ['veg', ['type', 'cover', 'types']], ['soil', ['vuln', 'high', 'hydric']], ['wet', ['type', 'acres']],
  ['inv', ['edrr', 'spp', 'pct', 'pest']], ['fcond', ['loss', 'fhr', 'tfall']], ['bird', ['bcc', 'spp']], ['rec', ['obs', 'spp']], ['eff', ['od', 'peak']],
  ['geo', ['lith', 'age']], ['wx', ['ppt', 'heavy', 'p25']], ['hist', ['hany', 'hnr']], ['cult', ['spp']], ['pri', ['tier']]];
const DESCR = new Map(), DESCSUM = new Set(['feat.atmi', 'feat.shel', 'feat.camp', 'feat.park', 'feat.vist', 'feat.side', 'wet.acres', 'hist.hany', 'hist.hnr', 'inv.pest', 'rec.obs']);
/* a range written once: "41 to 78 of 100", "1 to 3 vistas" */
const descRange = (a, b) => { const re = /^([<>~]?[-\d.,]+)(.*)$/, x = a.match(re), y = b.match(re); if (x && y && (x[2] === y[2] || x[2] + 's' === y[2] || x[2] + 'es' === y[2])) return x[1] + ' to ' + b; return a + ' to ' + b; };
function descRank(m, lv, v, qid){ const k = qid + '.' + m.id + '.' + lv; let a = DESCR.get(k);
  if (!a){ a = []; const n = D.levels[lv].id.length; for (let c = 0; c < n; c++){ const x = m.get(lv, c); if (typeof x === 'number' && isFinite(x)) a.push(x); } a.sort((p, q) => p - q); DESCR.set(k, a); }
  if (a.length < 20 || a[0] === a[a.length - 1]) return null; let lo = 0, hi = a.length; while (lo < hi){ const md = (lo + hi) >> 1; if (a[md] < v) lo = md + 1; else hi = md; }
  return Math.round(100 * lo / a.length); }
function descMeasure(m, lv, cells, qid){ const vs = cells.map(c => m.get(lv, c)).filter(x => typeof x === 'number' && isFinite(x)); if (!vs.length) return null;
  const lab = m.label.replace(/\s*\(estimated\)/, ' (estimated)'), lc = lab.charAt(0).toLowerCase() + lab.slice(1);
  if (m.kind === 'cat'){ const cnt = new Map(); vs.forEach(x => cnt.set(x, (cnt.get(x) || 0) + 1)); const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
    const nm = x => show(m, x); if (top.length === 1 || cells.length === 1) return `${lc}: ${nm(top[0][0])}`;
    return `${lc}: mostly ${nm(top[0][0])} (${top[0][1]} of ${vs.length} cells)${top[1] ? `, then ${nm(top[1][0])}` : ''}`; }
  vs.sort((a, b) => a - b);
  if (cells.length > 1 && DESCSUM.has(qid + '.' + m.id)){ const t = vs.reduce((a, b) => a + b, 0), tt = Math.round(t * 10) / 10; return `${lc}: ${show(m, tt)} in all${vs.length < cells.length ? ` (in ${vs.length} of the ${cells.length} cells)` : ''}`; }
  const mid = vs[Math.floor((vs.length - 1) / 2)], r = descRank(m, lv, mid, qid), some = cells.length > 1 && vs.length < cells.length ? `${vs.length} of the ${cells.length} cells have a value` : '';
  const where = r == null ? '' : r >= 80 ? `, among the highest fifth of ${LV[lv].name} cells` : r <= 20 ? `, among the lowest fifth of ${LV[lv].name} cells` : `, higher than about ${r}% of ${LV[lv].name} cells`;
  if (vs.length === 1 || vs[0] === vs[vs.length - 1]) return `${lc}: ${show(m, vs[0])}${where}${some ? ` (${some})` : ''}`;
  return `${lc}: ${descRange(show(m, vs[0]), show(m, vs[vs.length - 1]))} across the cells (middle value ${show(m, mid)}${where}${some ? '; ' + some : ''})`; }
function describeText(){ const lv = S.box ? S.box.lv : S.cellLv, cells = S.box ? S.box.cells.slice() : [S.cell], L_ = D.levels[lv]; if (lv == null || !cells.length || cells[0] == null) return '';
  cells.sort((a, b) => L_.mi[a] - L_.mi[b]); const N = cells.length, mi0 = L_.mi[cells[0]], mi1 = L_.mi[cells[N - 1]];
  const uniq = a => [...new Set(a.filter(Boolean))], list = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const clubs = uniq(cells.map(c => cat('club', L_.club[c]))), regs = uniq(cells.map(c => regionOf(L_.mi[c])));
  const out = [], wrap = s => s.replace(/(?![^\n]{1,100}$)([^\n]{1,100})\s/g, '$1\n');
  out.push('A.T. Resource Grid: summary of ' + (N === 1 ? `one ${LV[lv].name} cell (${L_.id[cells[0]]})` : `${N} ${LV[lv].name} cells`));
  out.push(`Generated ${localDay()} from grid.trailassessment.org`, '');
  out.push(wrap(`${N === 1 ? 'This cell is' : 'These cells are'} ${N === 1 || mi0 === mi1 ? `near A.T. mile ${fmt(mi0, 0)}` : `between A.T. miles ${fmt(mi0, 0)} and ${fmt(mi1, 0)}`}${regs.length ? `, in the ${list(regs)} ${regs.length === 1 ? 'region' : 'regions'}` : ''}${clubs.length ? `, maintained by ${list(clubs)}` : ''}.`), '');
  DESC.forEach(([qid, ids]) => { const q = Q.find(x => x.id === qid); if (!q) return; if (qid === 'pri' && !JERRY) return;
    const parts = ids.map(id => q.m.find(x => x.id === id)).filter(Boolean).map(m => descMeasure(m, lv, cells, qid)).filter(Boolean);
    if (qid === 'tvul' && typeof SEGS !== 'undefined' && SEGS && SEGS.segs){ const cnt = [0, 0, 0, 0]; let n = 0; cells.forEach(c => segsIn(lv, c).forEach(i => { const k = tsrOf(i); if (k >= 0){ cnt[k]++; n++; } }));
      if (n) parts.push('Trail Sustainability Rating of the ' + fmt(n, 0) + ' trail segments of about 500 feet: ' + [0, 1, 2, 3].filter(k => cnt[k]).map(k => `${Math.round(100 * cnt[k] / n)}% ${TSR[k].t.toLowerCase()}`).join(', ')); }
    if (!parts.length) return;
    out.push(q.title.toUpperCase()); out.push(wrap(parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('. ') + '.'), ''); });
  out.push(wrap('These are screening summaries from public data sets; see About the data on the site for sources, dates and limits. They are not a substitute for field review.'));
  return out.join('\n').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '') + '\n'; }
async function describeRun(){ const msg = $('#pexmsg'); if (msg) msg.textContent = 'Writing the summary…';
  try { await liveEnsure().catch(() => {}); const t = describeText(); if (!t){ if (msg) msg.textContent = 'Select a cell first.'; return; }
    const n = S.box ? S.box.cells.length : 1;
    download(`AT_resource_grid_summary_${n}_${n === 1 ? 'cell' : 'cells'}_${localDay()}.txt`, new Blob([t.replace(/\n/g, '\r\n')], {type:'text/plain;charset=utf-8'}));
    if (msg) msg.textContent = 'Summary downloaded.'; } catch (e){ if (msg) msg.textContent = 'Could not write the summary.'; } }
/* ---------- guided tours ---------- */
const TOURS = {
  grassland: {title:'Grassland restoration along the A.T.',
   /* the other parks with Eastern Grasslands Initiative projects, one star per park (at its most central project site) */
   egi:[{n: 'Antietam National Battlefield', at: [39.47913, -77.74569]}, {n: 'Big South Fork National River and Recreation Area', at: [36.62722, -84.52723]}, {n: 'Booker T. Washington National Monument', at: [37.11976, -79.72938]}, {n: 'Catoctin Mountain Park', at: [39.64530, -77.47467]}, {n: 'Cedar Creek and Belle Grove National Historical Park', at: [39.01118, -78.30200]}, {n: 'Chattahoochee River National Recreation Area', at: [34.03346, -84.14011]}, {n: 'Chesapeake and Ohio Canal National Historical Park', at: [39.53847, -78.65244]}, {n: 'Congaree National Park', at: [33.83238, -80.81651]}, {n: 'Delaware Water Gap National Recreation Area', at: [41.15309, -74.87340]}, {n: 'Flight 93 National Memorial', at: [40.05480, -78.90145]}, {n: 'Fort Necessity National Battlefield', at: [39.81521, -79.59029]}, {n: 'Friendship Hill National Historic Site', at: [39.77669, -79.92797]}, {n: 'Fredericksburg and Spotsylvania National Military Park', at: [38.22546, -77.59777]}, {n: 'Gateway National Recreation Area', at: [40.59174, -73.89065]}, {n: 'Gettysburg National Military Park', at: [39.81219, -77.23777]}, {n: 'George Washington Birthplace National Monument', at: [38.19533, -76.93029]}, {n: 'Great Smoky Mountains National Park', at: [35.59348, -83.83085]}, {n: 'Harpers Ferry National Historical Park', at: [39.32491, -77.75995]}, {n: 'Little River Canyon National Preserve', at: [34.39737, -85.60840]}, {n: 'Marsh-Billings-Rockefeller National Historical Park', at: [43.63387, -72.53727]}, {n: 'Mammoth Cave National Park', at: [37.19133, -86.08971]}, {n: 'Manassas National Battlefield Park', at: [38.82464, -77.53544]}, {n: 'Minute Man National Historical Park', at: [42.46018, -71.32266]}, {n: 'Monocacy National Battlefield', at: [39.36847, -77.38700]}, {n: 'National Capital Parks-East', at: [38.80193, -77.01466]}, {n: 'Natchez Trace Parkway', at: [34.27624, -88.74480]}, {n: 'New River Gorge National Park and Preserve', at: [37.82665, -81.06536]}, {n: 'Petersburg National Battlefield', at: [37.19796, -77.45045]}, {n: 'Richmond National Battlefield Park', at: [37.41869, -77.25264]}, {n: 'Rock Creek Park', at: [38.95169, -77.05056]}, {n: 'Saint-Gaudens National Historical Park', at: [43.50075, -72.37084]}, {n: 'Saratoga National Historical Park', at: [42.98731, -73.64067]}, {n: 'Shenandoah National Park', at: [38.51493, -78.43689]}, {n: 'Stones River National Battlefield', at: [35.87142, -86.43602]}, {n: 'Valley Forge National Historical Park', at: [40.09873, -75.44462]}, {n: 'Weir Farm National Historical Park', at: [41.25568, -73.45613]}, {n: 'Wolf Trap National Park for the Performing Arts', at: [38.93717, -77.26632]}],
   sites:[{n:'Chambers/Urie field', at:[40.17508, -77.11936], ph:{f:'chambers-urie', c:'Chambers/Urie field, Cumberland Valley, Pennsylvania', a:'A grassy field with scattered tufts of dry grass, edged by trees, with a stone farmhouse in the distance under a blue sky'}},
     {n:'Cove Mountain Grasslands', at:[40.31883, -77.07872], ph:{f:'cove-mountain', c:'Cove Mountain Grasslands, Pennsylvania', a:'A broad green field in early spring under a cloudy sky, with leafless woods and a long forested ridge behind it'}},
     {n:'Reno Monument', at:[39.47128, -77.61650], ph:{f:'foxs-gap', c:'17th Michigan Field at Fox’s Gap, near the Reno Monument, Maryland', a:'A mowed meadow of short grasses and young plants ringed by tall trees under a blue sky'}},
     {n:'Dahlgren Chapel', at:[39.48442, -77.61833], ph:{f:'dahlgren', c:'Meadow below Dahlgren Chapel, Turner’s Gap, Maryland', a:'A sloping grass meadow below a stone chapel with a bell tower, edged by woods'}},
     {n:'Shays’ Rebellion site', at:[42.14697, -73.38067], ph:{f:'shays-rebellion', c:'Seeding native grasses, sedges and wildflowers at the Shays’ Rebellion site, Massachusetts, November 2026', a:'A tractor pulling a seed drill across a field in late fall, with tall dry grasses to one side and a mountain beyond'}}],
   steps:[
    {t:'Open land on a mountain trail', q:'rest', m:'grass', lv:'wheel', view:'trail', img:{f:'at-field-sunset', c:'The A.T. crossing an open field at sunset', a:'A post with a white blaze beside a mowed path through a grassy field, with a tall pine, bare trees and low mountains under an orange and gray sunset sky'},
     x:'The A.T. is a mountain footpath, but it also crosses farms, meadows and grassy balds. About 5,000 acres of open land are maintained along the corridor, including 986 acres on 31 farms under agricultural permits. Darker cells score higher for grassland restoration; stars mark active projects.'},
    {t:'Where the potential is highest', q:'rest', m:'grass', lv:'wheel', pick:{top:8}, img:{f:'dashboard-grassland-example', c:'The dashboard’s grassland scores for 1 sq mi cells along the A.T. through the Cumberland Valley, Pennsylvania: darker red cells score higher', a:'A map of hexagon cells colored from pale green to dark red along the white line of the Appalachian Trail, with a legend of grassland scores', by:'Map: A.T. Resource Grid'},
     x:'These {n} cells score highest for grassland restoration, from {range}. They’re in the {regionlist}, where the trail leaves the ridges for valleys and farm country. Open fields, suitable soils and nearby grassland species overlap here, making them strong candidates for future projects.'},
    {t:'Shays’ Rebellion site, Massachusetts', q:'rest', m:'grass', lv:'hex', pick:{near:[42.14697, -73.38067], km:.01}, sites:[4], zoom:14,
     x:'At the site of the last battle of Shays’ Rebellion (1787), in the Housatonic Valley, six acres of former corn and soybean fields on A.T. lands were seeded in November 2026 with 47 grasses, sedges and wildflowers native to Berkshire County. Grassland score here: {range}.'},
    {t:'The Cumberland Valley, Pennsylvania', q:'rest', m:'grass', lv:'hex', pick:{near:[40.24, -77.12], km:11}, sites:[0, 1],
     x:'Between South Mountain and Blue Mountain, the trail crosses the working farmland of the Cumberland Valley, home to about 80% of the A.T.’s agricultural permits. Farmers keep the fields open under permit, and some are being restored to native grasses, sedges and wildflowers. Grassland scores here: {range}.'},
    {t:'Chambers/Urie field', q:'rest', m:'grass', lv:'hex', pick:{near:[40.17508, -77.11936], km:.01}, sites:[0], ph:[0], zoom:14, img:{f:'chambers-urie-cemetery', c:'The Chambers/Urie cemetery, inside the restoration field', a:'Weathered nineteenth-century headstones inside an iron fence and low stone wall, with trees and a green field beyond'},
     x:'This A.T. farm field in the Cumberland Valley holds the historic Chambers/Urie cemetery. Converting it to native grasses, sedges and wildflowers keeps the open setting that has surrounded the cemetery for generations, while restoring habitat for grassland birds and pollinators. Grassland score here: {range}.'},
    {t:'Cove Mountain Grasslands', q:'rest', m:'grass', lv:'hex', pick:{near:[40.31883, -77.07872], km:.01}, sites:[1], zoom:14,
     x:'On A.T. lands near The Nature Conservancy’s Hamer Woodlands at Cove Mountain Preserve, a former farm field is being planted with native grasses, sedges and wildflowers. A local farmer will cut it late for mushroom compost, so it stays undisturbed while bobolinks, meadowlarks and grasshopper sparrows nest. Grassland score here: {range}.'},
    {t:'Why it matters for birds', q:'bird', m:'gr', img:{f:'bobolink', c:'Bobolink, a grassland bird that nests in hayfields and meadows', a:'A male bobolink, black with a buff nape and white back, perched on a thin stem above tall grass', by:''}, lv:'hex', pick:{near:[40.24, -77.12], km:11}, sites:[0, 1],
     x:'Grassland birds are among North America’s fastest-declining birds: since 1970 their numbers in the U.S. and Canada have fallen 53 percent, more than 700 million birds. Managed fields can still support them. Up to {max} grassland bird species have been recorded in a single square mile here. {gbtop}'},
    {t:'Keeping fields open, and native', q:'inv', m:'edrr', img:{f:'milkweed-meadow', c:'Butterfly milkweed in a restored meadow', a:'Orange butterfly milkweed flowers in a meadow of grasses and wildflowers, with an NPS ranger and others walking through it'}, lv:'hex', pick:{near:[40.24, -77.12], km:11}, sites:[0, 1],
     x:'Old fields are where invasive shrubs and grasses take hold first, and grassland birds drop off even when a small share of a field fills in with shrubs. Restoration pairs invasive control with native seeding and the right mowing or burning schedule. Up to {max} priority invasive species have been reported in a single square mile here.'},
    {t:'South Mountain, Maryland', q:'rest', m:'grass', lv:'hex', pick:{near:[39.478, -77.6174], km:2.2}, sites:[2, 3], zoom:13,
     x:'Two active projects sit on the 1862 Battle of South Mountain battlefield: the 17th Michigan Field near the Reno Monument at Fox’s Gap, and the meadows at Dahlgren Chapel near Turner’s Gap. Native grasses, sedges and wildflowers bring back open ground in historic settings. Grassland scores here: {range}.'},
    {t:'Open land, open views', q:'feat', m:'vist', lv:'hex', pick:{near:[40.24, -77.12], km:11}, sites:[1], ph:[1],
     x:'Open fields keep the views open. The National Trails System Act of 1968 protects the A.T.’s scenic, historic, natural and cultural qualities, and fields like those below Cove Mountain open long views across the valley. The visual resource inventory records {total} vistas in these Cumberland Valley cells.'},
    {t:'Part of a larger effort', q:'rest', m:'grass', lv:'wheel', view:[[33.4, -89.2], [44.0, -70.9]], egi:1, key:'Small stars mark the other parks with Eastern Grasslands Initiative projects; tap one for its name.', img:{f:'grassland-site-visit', c:'NPS staff and partners on a grassland restoration site visit', a:'A group of people in field clothes standing in a wide meadow of grasses and white wildflowers under a cloudy sky, with wooded hills beyond'},
     x:'The A.T. work is part of the Eastern Grasslands Initiative, a National Park Service effort to restore native grasslands across eastern parks. In 2026, its first year of treatment, restoration began in more than 30 parks, from the center of the Gettysburg battlefield to Valley Forge’s Grand Parade.'},
    {t:'Explore on your own', q:'rest', m:'grass', lv:'auto', view:'trail', img:{f:'meadow-path', c:'A footpath through a native grass meadow', a:'A narrow dirt footpath through a mowed strip between tall native grasses, under a big cloudy sky'},
     x:'Click any cell to see its grassland score and what drives it: nearby grassland species, priority invasives, soils and wetland proximity. Rare species are summarized by cell only, and exact locations are never shown. Scores are a screening tool, not a substitute for field surveys or compliance review.'}]}
};
const TOUR = {id:null, k:0};
let tourSites = null;
function tourSitesDraw(T, st){ if (!tourSites) tourSites = L.layerGroup().addTo(map); tourSites.clearLayers(); (T.sites || []).forEach((x, i) => {
  const on = (st.sites || []).includes(i), mk = L.marker(x.at, {icon:L.divIcon({className:'tsite' + (on ? ' on' : ''), html:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>', iconSize:[22, 22], iconAnchor:[11, 11]}), keyboard:false, zIndexOffset:900});
  mk.bindTooltip(esc(x.n), {permanent:on, direction:'top', offset:[0, -10], className:'tsitetip'}); if (x.ph) mk.on('click', () => photoBox(x.ph)); tourSites.addLayer(mk); });
  if (st.egi) (T.egi || []).forEach(x => { const mk = L.marker(x.at, {icon:L.divIcon({className:'tsite egi', html:'<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>', iconSize:[15, 15], iconAnchor:[7.5, 7.5]}), keyboard:false, zIndexOffset:800, title:x.n});
    mk.bindTooltip(esc(x.n), {direction:'top', offset:[0, -7], className:'tsitetip'}); tourSites.addLayer(mk); }); }
function tourCells(st){ const lv = st.lv === 'auto' ? dispLevel() : st.lv, L_ = D.levels[lv], n = L_.id.length, p = st.pick; if (!p) return [lv, []];
  const q = Q.find(x => x.id === st.q), m = q && q.m.find(x => x.id === st.m);
  if (p.top){ const a = []; for (let c = 0; c < n; c++){ const v = m.get(lv, c); if (typeof v === 'number') a.push([v, c]); } a.sort((x, y) => y[0] - x[0]); return [lv, a.slice(0, p.top).map(x => x[1])]; }
  const [la, lo] = p.near, out = []; let best = -1, bd = 1e9; for (let c = 0; c < n; c++){ const r = ring(lv, c); let a0 = 0, o0 = 0; r.forEach(q => { a0 += q[0]; o0 += q[1]; }); a0 /= r.length; o0 /= r.length;   /* the cell's center, not its first vertex */
    const dy = (a0 - la) * 111, dx = (o0 - lo) * 111 * Math.cos(la * Math.PI / 180), d = Math.hypot(dx, dy); if (d <= p.km) out.push(c); if (d < bd){ bd = d; best = c; } }
  return [lv, out.length ? out : best >= 0 && bd < 8 ? [best] : []]; }
function tourText(st, lv, cells){ const q = Q.find(x => x.id === st.q), m = q && q.m.find(x => x.id === st.m), L_ = D.levels[lv];
  const vs = m ? cells.map(c => m.get(lv, c)).filter(v => typeof v === 'number').sort((a, b) => a - b) : [];
  const lo = vs.length && vs[0] === 0 && vs[vs.length - 1] > 0 ? '0' : vs.length ? show(m, vs[0]) : '';
  const range = !vs.length ? 'not recorded' : vs[0] === vs[vs.length - 1] ? show(m, vs[0]) : descRange(lo, show(m, vs[vs.length - 1]));
  const regs = [...new Set(cells.map(c => regionOf(L_.mi[c])))], list = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const rng = range.replace(/ of 100$/, ' out of 100');
  return esc(st.x).replace('{gbtop}', esc(tourBirdsTop())).replace('{regionlist}', esc(list(regs))).replace('{n}', cells.length).replace('{max}', vs.length ? esc(show(m, vs[vs.length - 1])).replace(/^(\d[\d,.]*)\s.*$/, '$1') : '0').replace('{total}', fmt(vs.reduce((a, b) => a + b, 0), 0)).replace('{range}', esc(rng)).replace('{regions}', esc(list(regs)) + (regs.length === 1 ? ' region' : ' regions')); }
/* the grassland birds reported in the most priority cells (the step 'Where the potential is highest' picks them) */
function tourBirdsTop(){ const T = TOURS.grassland, st = T && T.steps.find(x => x.pick && x.pick.top); if (!st) return ''; const [lv, cells] = tourCells(st), n = cells.length, M = new Map();
  cells.forEach(c => new Set(val('ebird', 'GRASS_LIST', lv, c) || []).forEach(i => M.set(i, (M.get(i) || 0) + 1))); if (!M.size) return '';
  const nm = i => sppName(i).common.toLowerCase().replace(/\b(american|eastern|western|northern|henslow’s|henslow's)\b/g, w => w === 'eastern' || w === 'western' || w === 'northern' ? w : w[0].toUpperCase() + w.slice(1));
  const by = new Map(); M.forEach((k, i) => { if (!by.has(k)) by.set(k, []); by.get(k).push(nm(i)); }); const ks = [...by.keys()].sort((a, b) => b - a);
  const list = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1], g1 = by.get(ks[0]).sort(), g2 = ks[1] ? by.get(ks[1]).sort() : null;
  let t = `Across the ${n} priority cells, the most commonly reported grassland ${g1.length === 1 ? 'bird is' : 'birds are'} ${list(g1)}, ${g1.length === 1 ? 'found' : 'each found'} in ${ks[0] === n ? 'all ' + n : ks[0] + ' of ' + n} cells`;
  if (g2) t += `, followed by ${list(g2)} in ${ks[1]} of ${n}`; return t + '.'; }
function tourGo(k){ const T = TOURS[TOUR.id]; if (!T) return;  TOUR.k = Math.max(0, Math.min(T.steps.length - 1, k)); const st = T.steps[TOUR.k];
  const q = Q.find(x => x.id === st.q); if (q){ S.q = q; S.m = q.m.find(x => x.id === st.m) || q.m[0]; } S.level = st.lv; BRK.clear(); const [lv, cells] = tourCells(st); if (!cells.length) clearSel(); redraw();   /* a new selection replaces the old one without clearing first, so phones don't jump */
  const ph = isPhone(); if (ph){ TOUR.userScrolled = false; tourMobile(true); }
  if (cells.length){ selectMany(lv, cells, null, 'Tour stop: ' + st.t); S.box.tour = true; profile(); }
  tourSitesDraw(TOURS[TOUR.id], st); tourDraw(lv, cells);
  if (ph) map.invalidateSize();
  let bd = null; if (cells.length){ bd = L.latLngBounds([]); cells.forEach(c => ring(lv, c).forEach(p => bd.extend(p))); bd = bd.pad(st.pick.top ? .05 : .6); }
  else if (st.view === 'trail') bd = trailLine.getBounds(); else if (Array.isArray(st.view)) bd = L.latLngBounds(st.view);
  if (ph){ map.stop(); if (st.zoom && cells.length) map.setView(st.pick.near, st.zoom, {animate:false}); else if (bd) map.fitBounds(bd, {animate:false, maxZoom:12}); }
  else { /* a wide map view sits to the right of the tour panel so nothing hides behind it */
    let pl = 0; if (Array.isArray(st.view) && !cells.length){ const tr = $('#tour'), mw = $('#mapwrap'); if (tr && mw){ const r1 = tr.getBoundingClientRect(), r0 = mw.getBoundingClientRect(); pl = Math.max(0, Math.min(r1.right - r0.left + 12, r0.width * .55)); } }
    if (bd) map.flyToBounds(bd, {duration:1.2, maxZoom:12, paddingTopLeft:[pl, 0]}); if (st.zoom && cells.length) setTimeout(() => { if (TOUR.id) map.flyTo(st.pick.near, st.zoom, {duration:.8}); }, 1300); }
  if (ph) tourScroll(); }
function tourDraw(lv, cells){ const T = TOURS[TOUR.id], st = T.steps[TOUR.k], N = T.steps.length; let d = $('#tour');
  if (!d){ d = document.createElement('div'); d.id = 'tour'; d.className = 'tour'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Guided tour'); L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d); }
  if (isPhone()){ if (d.previousElementSibling !== $('#mapwrap')) $('#mapwrap').after(d); } else if (d.parentNode !== $('#mapwrap')) $('#mapwrap').appendChild(d);
  d.innerHTML = `<button class="tx" type="button" aria-label="End the tour">×</button><div class="tk"><span class="tkt">Tour · ${esc(T.title)} · </span>${TOUR.k + 1} of ${N}</div><h3>${esc(st.t)}</h3><div class="tbody">${tourPhotos(T, st)}<p>${tourText(st, lv, cells)}</p>${st.key ? `<div class="tkey">${esc(st.key)}</div>` : ''}</div>
    <div class="tnav"><div class="dots">${T.steps.map((_, i) => `<i${i === TOUR.k ? ' class="on"' : ''}></i>`).join('')}</div><button type="button" data-t="-1"${TOUR.k ? '' : ' disabled'}>Back</button><button type="button" class="pri" data-t="1">${TOUR.k === N - 1 ? 'Finish' : 'Next'}</button></div>
    ${TOUR.k === 0 ? '<div class="tnote">Demo tour. Use the arrow keys or the buttons; the map stays live, so you can click around at any step.</div>' : ''}`;
  tourPlace(); { const P = tourPics(T, st); d.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => photoBox(P[+b.dataset.pk])); }
  d.querySelector('.tx').onclick = tourEnd; d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const s = +b.dataset.t; if (s > 0 && TOUR.k === N - 1) tourEnd(); else tourGo(TOUR.k + s); }); }
const PHDIR = 'images/';
/* the photos of the sites a step is about: one fills the width, two sit side by side; a site stop shows only its own photo */
function tourPics(T, st){ const own = st.img ? [].concat(st.img) : [], ix = (st.ph || (st.q === 'rest' && !own.length ? st.sites : null) || []).filter(i => T.sites[i] && T.sites[i].ph);
  const all = ix.map(i => T.sites[i].ph).concat(own); return all.length > 2 ? all.slice(0, 2) : all; }
function tourPhotos(T, st){ const P = tourPics(T, st); if (!P.length) return '';
  return `<div class="tph n${P.length}">${P.map((p, k) => `<button type="button" data-pk="${k}" aria-label="Enlarge photo: ${esc(p.c)}"><img src="${PHDIR + p.f}-sm.webp" alt="${esc(p.a)}" loading="lazy"></button>`).join('')}</div>`; }
function photoBox(p){ let o = $('#phbox'); if (o) o.remove(); o = document.createElement('div'); o.id = 'phbox'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', p.c);
  o.innerHTML = `<figure><img src="${PHDIR + p.f}.webp" alt="${esc(p.a)}"><figcaption>${esc(p.c)}${p.by === '' ? '' : `<span>${p.by && /^(Image|Map)/.test(p.by) ? esc(p.by) : 'Photo: ' + esc(p.by || 'Casey Reese')}</span>`}</figcaption></figure><button type="button" aria-label="Close photo">×</button>`;
  const close = () => { o.remove(); document.removeEventListener('keydown', esc1, true); }, esc1 = e => { if (e.key === 'Escape'){ e.stopPropagation(); close(); } };
  o.onclick = e => { if (e.target === o || e.target.tagName === 'BUTTON') close(); }; document.addEventListener('keydown', esc1, true); document.body.appendChild(o); o.querySelector('button').focus(); }
/* the tour panel sits at the left of the map, level with the Guiding Questions and below the map controls; the controls' drop-downs (basemap, map layers) open over it */
function tourPlace(){ const d = $('#tour'), w = $('#mapwrap'); if (!d || !w || isPhone()) return; const top0 = w.getBoundingClientRect().top; let b = 0;
  ['#ctlrow1', '#ctlrow2', '.leaflet-control-zoom', '#lvbar'].forEach(sel => { const e = document.querySelector(sel); if (!e || e.offsetParent === null) return;
    const kids = sel[0] === '#' ? [...e.children] : [e]; kids.forEach(k => { if (k.offsetParent === null || k.id === 'layerspanel') return; const r = k.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom); }); });
  /* beside the side panel, the panel's top lines up with the start of the Guiding Questions (where the panel turns dark blue) */
  const g = document.querySelector('.qsblk'), gr = g && g.offsetParent !== null ? g.getBoundingClientRect() : null, wr = w.getBoundingClientRect();
  const side = gr && gr.right <= wr.left + 4 && gr.top > wr.top ? gr.top - top0 : 0;
  const t = Math.max(10, Math.round(b - top0 + 8), Math.round(side)); d.style.top = t + 'px'; d.style.maxHeight = `calc(100% - ${t + 12}px)`; }
addEventListener('resize', tourPlace);
/* phones: while a tour runs the map takes the top of the screen and the tour sits under it, the two together one screen tall */
function tourMobile(on){ document.body.classList.toggle('touring', !!on); if (on) tourSize();
  /* while touring, anything above the map that changes height afterwards (lists, charts, legends filling in) would push the map
     down the page; on phones without scroll anchoring (Safari) that shows as a jump, so the map is put back at the top each time,
     unless the person has scrolled the page themselves */
  if (on && !TOUR.ro && window.ResizeObserver){ TOUR.ro = new ResizeObserver(() => { if (TOUR.id && isPhone() && !TOUR.userScrolled) tourScroll(); }); TOUR.ro.observe(document.body);
    const mine = () => { TOUR.userScrolled = true; }; addEventListener('touchmove', mine, {passive:true}); addEventListener('wheel', mine, {passive:true}); TOUR.offUser = () => { removeEventListener('touchmove', mine); removeEventListener('wheel', mine); }; }
  if (!on && TOUR.ro){ TOUR.ro.disconnect(); TOUR.ro = null; if (TOUR.offUser) TOUR.offUser(); } }
/* sized from the visible screen height (phone browser bars included), so map plus tour fill the screen exactly */
function tourSize(){ const H = window.visualViewport ? visualViewport.height : innerHeight, m = Math.max(260, Math.round(H * .62)); document.body.style.setProperty('--tmh', m + 'px'); $('#mapwrap').style.height = m + 'px'; document.body.style.setProperty('--tph', Math.max(190, Math.round(H - m)) + 'px'); }
addEventListener('resize', () => { if (document.body.classList.contains('touring')) tourSize(); });
function tourScroll(){ const w = $('#mapwrap'); if (!w) return; const y = w.getBoundingClientRect().top + scrollY; if (Math.abs(scrollY - y) > 2) scrollTo({top:y, behavior:'auto'}); }
function tourStart(id){ if (HOWK >= 0) howEnd(); if (S.side.qs){ S.side.qs = false; store.set('side2', S.side); } if (!TOURS[id]) return; if (typeof goatEvent === 'function') goatEvent('tour-' + id); if (TOUR.leg == null){ TOUR.leg = S.legend; S.legend = false; } TOUR.id = id; tourGo(0); }   /* the legend folds up while the tour panel is open */
function tourEnd(){ TOUR.id = null; const d = $('#tour'); if (d) d.remove(); if (document.body.classList.contains('touring')){ tourMobile(false); lockW = 0; lockMapHeight(); map.invalidateSize(); } if (tourSites){ tourSites.remove(); tourSites = null; } if (TOUR.leg != null){ S.legend = TOUR.leg; TOUR.leg = null; legend(); } try { const h = new URLSearchParams(location.hash.slice(1)); if (h.has('tour')){ h.delete('tour'); history.replaceState(null, '', '#' + h.toString()); } } catch (x) {} }
document.addEventListener('keydown', e => { if (!TOUR.id || /input|select|textarea/i.test((e.target.tagName || ''))) return;
  if (e.key === 'ArrowRight') tourGo(TOUR.k + 1); else if (e.key === 'ArrowLeft') tourGo(TOUR.k - 1); else if (e.key === 'Escape') tourEnd(); });
/* the Tour chip sits inside the question it belongs to; it starts the tour without switching the question first */
const QTOUR = {rest:'grassland'};
document.addEventListener('click', e => { const t = e.target.closest('.qtour'); if (!t) return; e.preventDefault(); e.stopPropagation(); tourStart(t.dataset.tour); }, true);
document.addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('.qtour'); if (!t || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); e.stopPropagation(); tourStart(t.dataset.tour); }, true);
setTimeout(() => { if (S.pendingTour) tourStart(S.pendingTour); S.pendingTour = null; }, 1200);
const GOAT = 'atgrid';   /* GoatCounter site code, e.g. 'atgrid' for atgrid.goatcounter.com */
if (GOAT && !/^(localhost|127\.)/.test(location.hostname)){ const s = document.createElement('script'); s.async = true; s.src = 'https://gc.zgo.at/count.js'; s.dataset.goatcounter = 'https://' + GOAT + '.goatcounter.com/count'; document.head.appendChild(s); }
/* events: which questions, tours and exports people use (counted as paths under /event/, no personal data) */
function goatEvent(name){ try { if (GOAT && window.goatcounter && window.goatcounter.count) window.goatcounter.count({path:'event/' + name, title:name, event:true}); } catch (x) {} }
document.addEventListener('click', e => { const b = e.target.closest('[data-q], #pexcsv, #pexxls, #pextxt'); if (!b) return;
  goatEvent(b.dataset.q ? 'question-' + b.dataset.q : 'export-' + b.id.slice(3)); });
function exportWire(){ { const t = $('#pextxt'); if (t) t.onclick = describeRun; } const a = $('#pexcsv'), b = $('#pexxls'); if (a) a.onclick = () => exportRun('csv'); if (b) b.onclick = () => exportRun('xlsx'); }
const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const liveKey = () => S.box ? (S.ext === 'huc' ? 'huc:' : '') + S.box.lv + ':' + S.box.cells.join(',') : D.levels[S.cellLv].id[S.cell];
function liveEnsure(){ if (!window.ATiNat || ATiNat.cached(liveKey())) return Promise.resolve();
  const lv = S.box ? S.box.lv : S.cellLv, cells = S.box ? S.box.cells : [S.cell], rings = cells.map(c => ring(lv, c)), pts = rings.flat();
  const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
  if (Math.max(...la) - Math.min(...la) > INAT_MAX_SPAN || Math.max(...lo) - Math.min(...lo) > INAT_MAX_SPAN) return Promise.resolve();
  const el = $('#inatlive') || document.createElement('div');
  return Promise.race([ATiNat.lookup({type:'MultiPolygon', coordinates:rings.map(r => [r.map(p => [p[1], p[0]])])}, el, {id:liveKey(), flags:inatFlags()}), new Promise(r => setTimeout(r, 15000))]); }
/* Map layers for the export. Point layers: one query over the selection's extent, each point placed in the cell it falls in.
   Line and area layers (side trails, administrative areas): one query per cell (six at once), every feature touching it.
   Kept per selection. Line and area layers are skipped for selections over LAYERMAX cells. */
const LAYERS = {}, LAYERMAX = 150, LAYERSKIP = /^(OBJECTID|FID|GlobalID|Shape|Shape__Area|Shape__Length|SHAPE_.*|created_.*|last_edited_.*)$/i;
async function layersEnsure(){ const key = liveKey(); if (LAYERS[key] || S.ext === 'huc') return LAYERS[key];
  const lv = S.box ? S.box.lv : S.cellLv, cells = S.box ? S.box.cells : [S.cell], rings = cells.map(c => ring(lv, c)), ll = rings.flat(), res = {};
  const env = {xmin:Math.min(...ll.map(p => p[1])), ymin:Math.min(...ll.map(p => p[0])), xmax:Math.max(...ll.map(p => p[1])), ymax:Math.max(...ll.map(p => p[0])), spatialReference:{wkid:4326}};
  const ask = async (l, geom, gtype, geo) => { const u = l.url + '/query?' + new URLSearchParams({where:'1=1', geometry:JSON.stringify(geom), geometryType:gtype, inSR:4326, spatialRel:'esriSpatialRelIntersects', outFields:'*', returnGeometry:geo, outSR:4326, resultRecordCount:2000, f:'json'});
    const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'service error'); return j.features || []; };
  await Promise.all(LIVE.filter(l => !l.local).map(async l => { try { const meta = await arcMeta(l), F = (meta.fields || []).filter(f => !LAYERSKIP.test(f.name)), by = new Map();
      if (l.type === 'pt'){ (await ask(l, env, 'esriGeometryEnvelope', true)).forEach(f => { const g = f.geometry; if (!g) return; const k = rings.findIndex(r => inRingLL(g.y, g.x, r)); if (k < 0) return;
          const c = cells[k]; if (!by.has(c)) by.set(c, []); by.get(c).push(Object.assign({}, f.attributes, {__lat:+g.y.toFixed(5), __lon:+g.x.toFixed(5)})); }); }
      else { if (cells.length > LAYERMAX){ res[l.id] = {skipped:cells.length}; return; }
        for (let i = 0; i < cells.length; i += 6) await Promise.all(cells.slice(i, i + 6).map(async (c, k) => { const fs = await ask(l, {rings:[rings[i + k].map(p => [p[1], p[0]])], spatialReference:{wkid:4326}}, 'esriGeometryPolygon', false); if (fs.length) by.set(c, fs.map(f => f.attributes || {})); })); }
      res[l.id] = {fields:F, byCell:by}; } catch (e){ res[l.id] = {error:e.message}; } }));
  return LAYERS[key] = res; }
function exportData(){ const lv = S.box ? S.box.lv : S.cellLv, cells = S.box ? S.box.cells : [S.cell], L_ = D.levels[lv];
  const v = (th, f, c) => val(th, f, lv, c);
  const out = {cells:[], restoration:[], soils:[], wetlands:[], geology:[], geoUnits:[], geoMaps:[], cult:[], species:[], veg:[], land:[], features:[], live:[], phen:[], phenRec:[], pest:[], pestRec:[], pinv:[], pinvRec:[], layers:[], about:[]};
  { const R = LAYERS[liveKey()] || {}; out.layerState = S.ext === 'huc' ? '' : LAYERS[liveKey()] ? 'loaded' : 'missing';
    LIVE.forEach(l => { if (l.local){ const A = hAgg(lv), rows = [];
        if (A) cells.slice().sort((a, b) => L_.mi[a] - L_.mi[b]).forEach(c => (A.list.get(c) || []).map(i => HIST.items[i]).filter(x => x.t === (l.hist || 'cem')).forEach(x => rows.push(x.t === 'nr' ? {grid_id:L_.id[c], trail_mile:L_.mi[c], Name:x.nm, Type:x.a.type || '', Listed:x.a.listed || '',
          National_Historic_Landmark:x.a.nhl ? 'yes' : '', City:x.a.city || '', State:x.a.state || '', npgallery_url:x.a.refnum ? 'https://npgallery.nps.gov/AssetDetail/NRIS/' + x.a.refnum : '', latitude:x.la, longitude:x.lo} : {grid_id:L_.id[c], trail_mile:L_.mi[c], Name:x.nm,
          Denomination:x.a.denomination || '', Operator:x.a.operator || '', Land:HIST.lands ? (x.ld ? (LANDMAP.get(x.ld) || [0, x.ld])[1] : 'Outside administrative areas') : '', find_a_grave_url:histFagUrl(x),
          openstreetmap_url:x.a.osm ? 'https://www.openstreetmap.org/' + x.a.osm : '', latitude:x.la, longitude:x.lo})));
        out.layers.push({id:l.id, name:l.name, type:l.type, rows, state:A ? 'loaded' : 'missing'}); return; }
      const T = R[l.id], rows = [];
      if (T && T.byCell) cells.slice().sort((a, b) => L_.mi[a] - L_.mi[b]).forEach(c => (T.byCell.get(c) || []).forEach(a => { const r = {grid_id:L_.id[c], trail_mile:L_.mi[c]};
        T.fields.forEach(f => { let x = a[f.name]; if (x != null && f.type === 'esriFieldTypeDate') x = new Date(x).toISOString().slice(0, 10); r[f.alias || f.name] = x == null ? '' : x; });
        if (a.__lat != null){ r.latitude = a.__lat; r.longitude = a.__lon; } rows.push(r); }));
      out.layers.push({id:l.id, name:l.name, type:l.type, rows, state:!T ? 'missing' : T.skipped ? 'skipped' : T.error ? 'error' : 'loaded'}); }); }
  cells.slice().sort((a,b) => L_.mi[a] - L_.mi[b]).forEach(c => { const id = L_.id[c], base = {grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c], trail_club:cat('club', L_.club[c]) || '', region:regionOf(L_.mi[c])};
    let plv = lv, pc = c; if (!D.themes.nrpz[lv]){ const p = parentOf(lv, c); if (p){ plv = p[0]; pc = p[1]; } }
    const tier = JERRY && D.themes.nrpz[plv] ? val('nrpz','review_tie',plv,pc) : null, te = tier == null ? null : CATCOL.review_tie.find(x => x[0] === D.cats.review_tie[tier]);
    /* n: a value, blank when missing. k: a category field, written as its name */
    const n = (th, f) => { const x = v(th, f, c); return x == null ? '' : x; }, k = (th, f) => { const x = v(th, f, c); return x == null || !D.cats[f] ? '' : D.cats[f][x]; };
    out.cells.push(Object.assign({}, base, {
      veg_acres_mapped:n('veg','VEG_AREA'), veg_pct_of_cell_mapped:n('veg','PCT_MAPPED'), veg_types:n('veg','N_TYPES'), veg_main_type:k('veg','DOM_TYPE'), nlcd_main_cover:k('veg','L2_DOM'),
      inat_records:n('inat','N_OBS'), inat_species:n('inat','N_SPP'), inat_observers:n('inat','N_OBSERVERS'), inat_invasive_species:blank(invCount(lv, c)), inat_invasive_plants:n('inat','N_INV_SPP'), inat_forest_pests:hasInv(lv, c) ? (invL('PEST_LIST',lv,c) || []).length : '', inat_priority_invasives:blank(priCount(lv, c)), inat_invasive_pct_of_records:blank(invShare(lv, c)), inat_forest_pest_records:n('inat','N_PEST_OBS'), eddmaps_reports:n('edd','N_EDD_OBS'), eddmaps_reports_also_on_inat:n('edd','N_EDD_DUP'), eddmaps_reports_treated:n('edd','N_EDD_TREATED'), eddmaps_newest_report:n('edd','EDD_LAST'), inat_data_status:k('inat','DATA_STATUS'), inat_summary_newest_record:n('inat','LAST_OBS'), inat_records_last_3_years:n('inat','N_OBS_RECENT'), inat_nonnative_species:n('inat','N_NONNATIVE_SPP'), inat_nonnative_plant_species:n('inat','N_NONNATIVE_PLANT_SPP'),
      ...Object.fromEntries(RECG.flatMap(([lab, g]) => { const k = lab.toLowerCase().replace(/[^a-z]+/g, '_'); return [['inat_' + k + '_records', n('inat', g + '_OBS')], ['inat_' + k + '_species', n('inat', g + '_SPP')]]; })),
      ebird_checklists:n('ebird','N_CHECKLISTS'), ebird_records:n('ebird','N_RECORDS'), ebird_species:n('ebird','N_SPP'), ebird_observers:n('ebird','N_OBSERVERS'), ebird_birds_of_conservation_concern:n('ebird','N_BCC_SPP'), ebird_data_status:k('ebird','DATA_STATUS'), ebird_latest_checklist:n('ebird','LAST_OBS'),
      unique_species_rating:te ? (te[2] || te[0]) : '', unique_species_rating_cell_size:te ? LV[plv].name : '',
      feat_at_miles:n('feat','AT_MI'), feat_facilities:n('feat','N_FAC'), feat_shelters:n('feat','N_SHELTER'), feat_campsites:n('feat','N_CAMPSITE'), feat_privies:n('feat','N_PRIVY'),
      feat_parking_areas:n('feat','N_PARKING'), feat_bridges:n('feat','N_BRIDGE'), feat_vistas:n('feat','N_VISTA'), feat_side_trail_miles:n('feat','SIDE_MI'), feat_maintained_landscape_acres:n('feat','ML_AC'),
      feat_drainage_structures_est:n('feat','S_DRAIN'), feat_steps_and_climbs_est:n('feat','S_STEPS'), feat_signs_est:n('feat','S_SIGNS'), feat_barriers_est:n('feat','S_BARR'),
      land_administrators:n('lands','N_MGR'), land_pct_of_cell_mapped:n('lands','PCT_LAND'),
      cultural_plant_species:blank(cultCount(lv, c)), cultural_plant_records:cultReady(lv) ? n('inat','N_CULT_OBS') : '',
      visit_observer_days_per_year:(x => x == null ? '' : Math.round(x * 10) / 10)(visRecent(lv, c)), visit_average_years:visFull() - 2 + '-' + visFull(), visit_unique_observers:n('vis','VIS_OBSR'), visit_peak_month:v('vis','VIS_PEAK',c) ? CATCOL.VIS_PEAK[v('vis','VIS_PEAK',c) - 1][0] : '', visit_records_per_observer_day:n('vis','VIS_RPD'),
      trail_vulnerability_score:blank(tvScore(lv, c)), trail_tree_fall_vulnerability:blank(wfScore(lv, c)), recorded_treadway_problems:n('defic','DF_N'), recorded_erosion_problems:n('defic','DF_EROS'), recorded_drainage_problems:n('defic','DF_DRAIN'), recorded_other_treadway_problems:n('defic','DF_OTHER'), recorded_site_corridor_problems:n('defic','DF_SITE'), recorded_serious_critical_problems:n('defic','DF_SEV'), recorded_problems_per_mile:n('defic','DF_RATE'), trail_steepest_grade_p90_pct:n('seg','SG_G90'), trail_steepest_side_slope_p90_pct:n('seg','SG_S90'), trail_most_direct_alignment_p10_deg:n('seg','SG_A10'), trail_share_top_fifth_segment_risk_pct:n('seg','SG_HI'), trail_share_wet_prone_segments_pct:n('seg','SG_WET'), trail_segments:n('seg','SG_N'), recorded_problems_vs_club_section_avg:n('defic','DF_REL'), trail_topo_exposed_pct:n('topo','TOPO_EXP'), ...Object.fromEntries(tvParts(lv, c)[1].map(p => ['trail_vuln_pts_' + p[0], p[2] == null ? '' : Math.round(p[2] * 10) / 10])),
      trail_miles_measured:n('slope','TS_MI'), trail_grade_avg_pct:n('slope','TS_GRADE'), trail_over_10pct_grade_pct:n('slope','TS_G10'), trail_over_20pct_grade_pct:n('slope','TS_G20'),
      trail_side_slope_avg_pct:n('slope','TS_SIDE'), trail_slope_alignment_avg_deg:n('slope','TS_SAA'), trail_fall_line_pct:n('slope','TS_FALL'),
      forest_pest_risk_pct_of_treed:n('fhr','FHR_PCT'), forest_pest_risk_acres:n('fhr','FHR_AC'), forest_pest_risk_treed_acres:n('fhr','FHR_TAC'),
      canopy_loss_pct_of_forest:n('dist','DL_PCT'), canopy_loss_acres:n('dist','DL_AC'), canopy_loss_forest_acres_assessed:n('dist','DL_FAC'), canopy_loss_latest_month:v('dist','DL_LAST',c) != null ? dlMonName(v('dist','DL_LAST',c)) : '',
      canopy_height_ft_gedi:v('gedi','FS_H',c) != null ? Math.round(ftOf(v('gedi','FS_H',c))) : '', biomass_tons_per_acre_gedi:v('gedi','FS_AGB',c) != null ? Math.round(tpaOf(v('gedi','FS_AGB',c))) : '', gedi_footprints:n('gedi','FS_HN'),
      green_up_date:v('lsp','LSP_GU',c) != null ? doyName(v('lsp','LSP_GU',c)) : '', leaf_off_date:v('lsp','LSP_DO',c) != null ? doyName(v('lsp','LSP_DO',c)) : '', growing_season_days:n('lsp','LSP_GS'),
      green_up_shift_days_since_2001_05:(x => x == null ? '' : x)(rawv('lsp','LSP_GUD',lv,c)),
      change_january_low_f:(x => x == null ? '' : x)(rawv('dym','DM_TMIN1_D',lv,c)), change_july_high_f:(x => x == null ? '' : x)(rawv('dym','DM_TMAX7_D',lv,c)), change_heavy_rain_days:(x => x == null ? '' : x)(rawv('dym','DM_HEAVY_D',lv,c)),
      change_frost_free_days:(x => x == null ? '' : x)(rawv('dym','DM_FROST_D',lv,c)), change_april_snowpack_in:(x => x == null ? '' : x)(rawv('dym','DM_SWE_D',lv,c)),
      wx_precip_in_per_year:n('wx','WX_PPT'), wx_wettest_month:v('wx','WX_WETM',c) != null ? MONTHS_LONG[v('wx','WX_WETM',c)] : '', wx_mean_temp_f:n('wx','WX_TMEAN'), wx_july_high_f:n('wx','WX_TMAX7'), wx_january_low_f:n('wx','WX_TMIN1'),
      wx_frost_free_days:n('wx','WX_FROSTFREE'), wx_heavy_rain_days_per_year:n('wx','WX_HEAVY'), wx_25yr_24hr_storm_in:n('wx','WX_P25'), wx_wind_mph_gridmet:n('wx','WX_WIND'), wx_windy_days_per_year_gridmet:n('wx','WX_WINDY'),
      wx_damaging_wind_events:n('wx','WX_EV_WIND'), wx_winter_storm_events:n('wx','WX_EV_WINTER'), wx_storm_event_years:wxYears() ? wxYears().join('-') : '',
      ...Object.fromEntries(MONTHS_LONG.flatMap((mo, i) => { const p = v('wx','WX_PPT_M',c), t = v('wx','WX_TMEAN_M',c); return [['wx_precip_in_' + mo.slice(0, 3).toLowerCase(), p ? p[i] : ''], ['wx_mean_temp_f_' + mo.slice(0, 3).toLowerCase(), t ? t[i] : '']]; })) }));
    if (has('soil', lv, c)) out.soils.push({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c],
      trail_vulnerability_index:n('soil','VULN'), trail_vulnerability_class:blank(vulnClass(v('soil','VULN',c))), pct_rated_high_vulnerability:n('soil','VULN_HIGH'),
      pct_at_least_one_rating_worst:n('soil','WORST1'), nrcs_score_average:n('soil','NRCS_IDX'), nrcs_erosion_hazard_unsurfaced_trails:n('soil','EROS_HR'),
      nrcs_paths_and_trails:n('soil','PATHS_HR'), nrcs_rutting_hazard:n('soil','RUT_HR'), pct_very_limited_paths_trails:n('soil','PATHS_VLIM'), pct_severe_rutting:n('soil','RUT_SEV'),
      pct_slopes_over_25:n('soil','STEEP'), avg_slope_pct:n('soil','SLOPE'), pct_highly_erodible_k_over_0_32:n('soil','K_HIGH'), pct_already_eroded:n('soil','ERODED'),
      pct_shallow_bedrock_under_50cm:n('soil','SHALLOW_ROCK'), pct_high_frost_action:n('soil','FROST_HIGH'), pct_subject_to_flooding:n('soil','FLOOD'),
      main_series:k('soil','SOIL_SERIES'), main_series_pct:n('soil','DOM_SERIES_PCT'), largest_series:n('soil','TOP_SERIES'), series_in_cell:n('soil','N_SERIES'),
      surface_texture:k('soil','SOIL_TEXTURE'), soil_order:k('soil','SOIL_ORDER'), drainage:k('soil','SOIL_DRAIN'), hydrologic_group:k('soil','SOIL_HSG'), ecological_site:k('soil','SOIL_ECOSITE'),
      main_map_unit:n('soil','DOM_MAPUNIT') || k('soil','SOIL_MAPUNIT'), main_map_unit_pct:n('soil','DOM_MAPUNIT_PCT'),
      pct_hydric:n('soil','HYDRIC'), pct_poorly_drained:n('soil','POOR_DRAIN'), pct_droughty:n('soil','DROUGHTY'), depth_to_water_table_cm:n('soil','WTDEP'), depth_to_bedrock_cm:n('soil','ROCKDEP'),
      surface_ph:n('soil','PH'), organic_matter_pct:n('soil','OM'),
      pct_prime_farmland:n('soil','PRIME'), pct_prime_if_drained_or_irrigated:n('soil','PRIME_COND'), pct_farmland_statewide_importance:n('soil','STATEWIDE'), main_farmland_class:k('soil','SOIL_FARM'),
      pct_land_capability_1_to_2:n('soil','LCC12'), pct_land_capability_1_to_4:n('soil','LCC14'), crop_productivity_nccpi:n('soil','NCCPI'), pct_of_cell_with_soil_data:n('soil','SOIL_COV') });
    if (has('veg', lv, c)){ const r = {grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c]};
      for (const kind of ['grass', 'forest']){ const [s, parts, wet] = restParts(kind, lv, c), pre = kind === 'grass' ? 'grassland_' : 'forest_';
        const [, , , mult, , hp] = restParts(kind, lv, c);
        r[pre + 'score'] = blank(s); parts.forEach(([k, lab, pts]) => { r[pre + k + '_points'] = Math.round(pts * 10) / 10; }); r[pre + 'wetland_points'] = s == null ? '' : -Math.round(wet * 10) / 10;
        r[pre + 'habitat_points'] = s == null ? '' : Math.round(hp * 10) / 10; r[pre + (S.appa ? 'share_appa' : 'share_not_private')] = s == null ? '' : Math.round(mult * 100) / 100; }
      { const sh = restLand(lv, c)[1]; LANDCLASS.forEach(([k]) => { r['land_pct_' + (k === 'priv' ? 'private' : k)] = Math.round(sh[k] || 0); }); }
      out.restoration.push(r); }
    if (has('wet', lv, c)) out.wetlands.push({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c],
      wetland_acres:n('wet','WET_AC'), pct_of_cell_wetland:n('wet','WET_PCT'), wetlands_in_cell:n('wet','N_WET'), main_type:k('wet','WET_DOM'), main_type_pct_of_wetland:n('wet','DOM_PCT'),
      forested_shrub_wetland_ac:n('wet','T_FFS'), emergent_wetland_ac:n('wet','T_FEM'), pond_ac:n('wet','T_POND'), lake_ac:n('wet','T_LAKE'), riverine_ac:n('wet','T_RIV'),
      estuarine_marine_ac:n('wet','T_EST'), other_ac:n('wet','T_OTH'), vegetated_wetland_ac:n('wet','VEGW_AC'), open_water_ac:n('wet','WATER_AC'), possibly_sensitive_ac:n('wet','SENS_AC'),
      class_forested_ac:n('wet','C_FO'), class_scrub_shrub_ac:n('wet','C_SS'), class_emergent_ac:n('wet','C_EM'), class_aquatic_bed_ac:n('wet','C_AB'), class_unconsolidated_bottom_ac:n('wet','C_UB'),
      class_unconsolidated_shore_ac:n('wet','C_US'), class_streambed_ac:n('wet','C_SB'), class_rock_bottom_ac:n('wet','C_RB'), class_rocky_shore_ac:n('wet','C_RS'),
      at_lands_ac:n('wet','LANDS_AC'), wetland_on_at_lands_ac:n('wet','L_WET_AC'), main_type_on_at_lands:k('wet','WET_LDOM'), wetlands_on_at_lands:n('wet','L_N_WET'), possibly_sensitive_on_at_lands_ac:n('wet','L_SENS_AC') });
    if (GEOT && D.themes.geo && D.themes.geo[lv] && has('geo', lv, c)){ const pl = v('geo','PCT_LITH',c), lith = {};
      CATCOL.GEO_LITH.forEach((e, k) => { let x = ''; if (pl){ x = 0; for (let j = 0; j < pl.length; j += 2) if (pl[j] === k) x = pl[j + 1]; } lith['bedrock_pct_' + e[0].replace(/ \(.*\)/, '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/_$/, '')] = x; });
      const nw = v('geo','MAP_NEWEST',c), gm = v('geo','MAPS',c) || [];
      out.geology.push(Object.assign({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c],
        main_bedrock_type:k('geo','GEO_LITH'), main_unit_age:k('geo','GEO_AGE'), pct_carbonate:n('geo','PCT_CARB'), pct_mafic_ultramafic:n('geo','PCT_MAFIC'), bedrock_map_units:n('geo','N_UNITS')}, lith, {
        most_detailed_geologic_map:k('geo','MAP_BEST'), pct_mapped_1_24000_or_more_detailed:n('geo','PCT_DETAIL'), surficial_geologic_map:k('geo','SURF'), digital_gis_data:k('geo','GIS_BEST'),
        newest_geologic_map_year:nw == null ? '' : nw, geologic_maps:n('geo','N_MAPS'), maps_in_progress:n('geo','N_INPROG') }));
      const un = v('geo','UNITS',c) || []; for (let j = 0; j < un.length; j += 2){ const u = GEOT.units[un[j]]; if (!u) continue;
        out.geoUnits.push({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c], unit:u[0], map_label:u[1] && u[1] !== u[0] ? u[1] : '', pct_of_cell:un[j + 1], age:u[2] || '', bedrock_type:(CATCOL.GEO_LITH[u[3]] || [''])[0], major_rock_types:u[5] || '', state:u[8] || ''}); }
      gm.map(i => GEOT.maps[i]).filter(Boolean).sort((a, b) => a[3] - b[3] || b[2] - a[2]).forEach(m => out.geoMaps.push({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c],
        map_title:m[1], year:m[2], scale:'1:' + Number(m[3]).toLocaleString('en-US'), map_type:m[4], gis_data:m[5] === 'yes' ? 'yes' : '', reference:m[6] || '', url:m[7] || '', notes:m[8] || ''})); }
    { const cl = cultL(lv, c); if (cl) cl.map(i => [i, cultOf(i)]).filter(x => x[1]).sort((a, b) => (a[1][1] || a[1][0]).localeCompare(b[1][1] || b[1][0])).forEach(([i, e]) =>
      out.cult.push({grid_id:id, cell_size:LV[lv].name, trail_mile:L_.mi[c], common_name:e[1] || sppName(i).common || '', scientific_name:sppName(i).sci, status:e[5] || '', source:e[7] || '', source_link:e[8] || ''})); }
    (v('feat','LIST',c) || []).forEach(fi => { const f = D.feat[fi]; out.features.push({grid_id:id, trail_mile:L_.mi[c], feature_type:f[0], name:f[1], detail:f[2], latitude:f[3], longitude:f[4]}); });
    (v('feat','SIDE',c) || []).forEach(x => out.features.push({grid_id:id, trail_mile:L_.mi[c], feature_type:'Side trail', name:x[0], detail:fmt(x[1], 2) + ' mi in this cell', latitude:'', longitude:''}));
    (v('feat','ML',c) || []).forEach(x => out.features.push({grid_id:id, trail_mile:L_.mi[c], feature_type:'Maintained landscape', name:x[0], detail:[x[1], fmt(x[2], 1) + ' acres in this cell'].filter(Boolean).join(', '), latitude:'', longitude:''}));
    const sp = (group, detail, list, edset) => (list || []).forEach(i => { const p = sppName(i); out.species.push({grid_id:id, trail_mile:L_.mi[c], group, habitat_group_or_list:detail, common_name:p.common, scientific_name:p.sci, lists:[p.tag, edset && edset.has(i) ? 'priority invasive' : ''].filter(Boolean).join('; ')}); });
    const ed = new Set(invL('EDRR_LIST', lv, c) || []), T = invSrc(lv, [c]), srcOf = i => T.e.has(i) ? (T.n.has(i) ? 'iNaturalist; EDDMapS' : 'EDDMapS') : 'iNaturalist';
    const n0 = out.species.length; (invL('INVASIVE_LIST', lv, c) || []).forEach(i => sp('Invasive plant', srcOf(i), [i], ed)); (invL('PEST_LIST', lv, c) || []).forEach(i => sp('Forest pest', srcOf(i), [i], new Set([i])));
    { const det = eddDet(lv, [c]), bySci = new Map([...det].map(([i, e]) => [sppName(i).sci, e])); out.species.slice(n0).forEach(r => { const e = bySci.get(r.scientific_name); if (!e) return;
      Object.assign(r, {eddmaps_reports:e.n, eddmaps_infested_acres:e.hasAc ? Math.round(e.ac * 1000) / 1000 : '', eddmaps_latest_abundance:e.ab ? e.ab + (e.ay ? ` (${e.ay})` : '') : ''}); }); } /* forest pests count as priority invasives */ sp('iNaturalist most recorded', 'Top ten in the cell', v('inat','TOP10_SPECIES',c)); sp('Plant of cultural significance', 'Cultural plants list (cultural_plants.csv)', v('inat','CULT_LIST',c));
    BIRD_GROUPS.forEach(g => sp('Bird', g.full, v('ebird', g.list, c))); sp('Bird on a watch list', 'eBird', v('ebird','SOC_LIST',c));
    PRIORITY.forEach(p => { const n = prioCount(p, lv, c);
      if (n) out.species.push({grid_id:id, trail_mile:L_.mi[c], group:'Priority species', habitat_group_or_list:`Live from the iNaturalist project, ${n} research-grade ${n === 1 ? 'record' : 'records'}`, common_name:p.common, scientific_name:p.sci, lists:''}); });
    const cp = v('veg','COMP',c) || [], ac = v('veg','VEG_AREA',c) || 0; for (let k = 0; k < cp.length; k += 2) out.veg.push({grid_id:id, trail_mile:L_.mi[c], vegetation_type:D.cats.DOM_TYPE[cp[k]], pct_of_mapped_acres:cp[k+1], acres:Math.round(ac * cp[k+1]) / 100});
    const mg = v('lands','MGRS',c) || []; for (let k = 0; k < mg.length; k += 2) out.land.push({grid_id:id, trail_mile:L_.mi[c], administrator:D.cats.MGR[mg[k]], pct_of_mapped_land:mg[k+1]}); });
  { const lr = ATiNat.cached(liveKey());
    (lr ? lr.items.slice(0, ATiNat.config.show) : []).forEach(o => { const t = o.taxon || {}, sci = t.name || 'Unidentified', xy = o.geojson.coordinates, la = +xy[1], lo = +xy[0];
      const c = cells.find(c => inRingLL(la, lo, ring(lv, c))), fl = INATFLAGS && INATFLAGS[sci.toLowerCase()];
      out.live.push({grid_id:c == null ? '' : L_.id[c], trail_mile:c == null ? '' : L_.mi[c], observed_on:o.observed_on || '', common_name:t.preferred_common_name || '', scientific_name:sci,
        list:fl || '', quality_grade:o.quality_grade || '', observer:(o.user && o.user.login) || '', latitude:+la.toFixed(5), longitude:+lo.toFixed(5), inaturalist_url:o.uri || ''}); });
    out.liveState = lr ? 'loaded' : 'missing'; }
  /* flowering: each species already loaded (from the flowering question), its records in the selected cells and each cell's dates */
  { const loaded = PHSP.filter(sp => PHD[sp.key] && PHD[sp.key].st === 'done'), rings = cells.map(c => ring(lv, c)), ll = rings.flat();
    const la0 = Math.min(...ll.map(p => p[0])), la1 = Math.max(...ll.map(p => p[0])), lo0 = Math.min(...ll.map(p => p[1])), lo1 = Math.max(...ll.map(p => p[1]));
    const STG = {1:'flowering', 3:'in bud', 5:'record'}, dt = (y, d) => { const t = new Date(y, 0, d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
    loaded.forEach(sp => { const by = new Map();
      PHD[sp.key].pts.forEach(([d, y, st, la, lo, id]) => { if (!STG[st] || sp.pest && y < PHY0 || la < la0 || la > la1 || lo < lo0 || lo > lo1) return; const k = cells.findIndex((c, i) => inRingLL(la, lo, rings[i])); if (k < 0) return;
        const c = cells[k]; (sp.set === 'pinv' ? out.pinvRec : sp.pest ? out.pestRec : out.phenRec).push({grid_id:L_.id[c], trail_mile:L_.mi[c], species:sp.common, scientific_name:sp.sci, ...(sp.pest ? {} : {stage:STG[st]}), observed_on:dt(y, d), latitude:la, longitude:lo, inaturalist_url:id ? 'https://www.inaturalist.org/observations/' + id : '', ...(sp.pest ? {source:'iNaturalist', eddmaps_url:''} : {})});
        if (!by.has(c)) by.set(c, {fl:[], bud:0, all:0, first:null, last:null}); const e = by.get(c); e.all++; if (e.first == null || y < e.first) e.first = y; if (e.last == null || y > e.last) e.last = y; if (st === 1 || st === 5) e.fl.push(d); else if (st === 3) e.bud++; });
      (sp.pest ? PHD[sp.key].edd || [] : []).forEach(([d, y, la, lo, id]) => { if (y < PHY0 || la < la0 || la > la1 || lo < lo0 || lo > lo1) return; const k = cells.findIndex((c, i) => inRingLL(la, lo, rings[i])); if (k < 0) return; const c = cells[k];
        (sp.set === 'pinv' ? out.pinvRec : out.pestRec).push({grid_id:L_.id[c], trail_mile:L_.mi[c], species:sp.common, scientific_name:sp.sci, observed_on:dt(y, d), latitude:la, longitude:lo, inaturalist_url:'', source:'EDDMapS', eddmaps_url:'https://www.eddmaps.org/distribution/point.cfm?id=' + id});
        if (!by.has(c)) by.set(c, {fl:[], bud:0, all:0, first:null, last:null}); const e = by.get(c); e.edd = (e.edd || 0) + 1; if (e.first == null || y < e.first) e.first = y; if (e.last == null || y > e.last) e.last = y; });
      if (sp.pest){ [...by].sort((a, b) => L_.mi[a[0]] - L_.mi[b[0]]).forEach(([c, e]) => (sp.set === 'pinv' ? out.pinv : out.pest).push({grid_id:L_.id[c], cell_size:LV[lv].name, trail_mile:L_.mi[c], species:sp.common, scientific_name:sp.sci,
          research_grade_records:e.all, eddmaps_reports:e.edd || 0, first_year_recorded:e.first, latest_year_recorded:e.last})); return; }
      [...by].sort((a, b) => L_.mi[a[0]] - L_.mi[b[0]]).forEach(([c, e]) => { const a = e.fl.sort((p, q) => p - q), ok = a.length >= PHMIN, okL = a.length >= PHMINLEN, isP = sp.kind === 'plant';
        out.phen.push({grid_id:L_.id[c], cell_size:LV[lv].name, trail_mile:L_.mi[c], species:sp.common, scientific_name:sp.sci, [isP ? 'flowering_records' : 'records']:a.length, ...(isP ? {in_bud_records:e.bud} : {}),
          first_flowering_date:isP && ok ? doyDate(phPct(a, .1)) : '', peak_flowering_date:isP && ok ? doyDate(phMed(a)) : '', last_flowering_date:isP && ok ? doyDate(phPct(a, .9)) : '',
          flowering_season_weeks:isP && okL ? Math.max(1, Math.round((phPct(a, .9) - phPct(a, .1)) / 7)) : '', first_year_recorded:e.first}); }); });
    out.phenLoaded = loaded.filter(sp => !sp.pest).map(sp => sp.common); out.pestLoaded = loaded.filter(sp => sp.set === 'pest').map(sp => sp.common); out.pinvLoaded = loaded.filter(sp => sp.set === 'pinv').map(sp => sp.common); }
  { const A = hAgg(lv); out.hist = []; out.histState = A ? 'loaded' : 'missing';
    if (A) cells.slice().sort((a, b) => L_.mi[a] - L_.mi[b]).forEach(c => (A.list.get(c) || []).forEach(i => { const x = HIST.items[i];
      out.hist.push(Object.assign({grid_id:L_.id[c], trail_mile:L_.mi[c], kind:{nr:'National Register', cem:'Cemetery'}[x.t], name:x.nm, latitude:x.la, longitude:x.lo}, HIST.lands ? {land_class:x.ld ? (LANDMAP.get(x.ld) || [0, x.ld])[1] : 'Outside administrative areas', land_admin:x.adm || '', land_tract:x.tract || ''} : {},
        Object.fromEntries(Object.entries(x.a).map(([k, v]) => [k, v === true ? 'yes' : v === false ? '' : v])),
        x.t === 'nr' && x.a.refnum ? {npgallery_url:'https://npgallery.nps.gov/AssetDetail/NRIS/' + x.a.refnum} : {}, x.a.osm ? {openstreetmap_url:'https://www.openstreetmap.org/' + x.a.osm} : {}, x.t === 'cem' ? {find_a_grave_url:histFagUrl(x)} : {})); })); }
  if (S.ext === 'huc'){ out.cells = out.cells.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !/^(veg|nlcd|unique|land|feat)_/.test(k)))); out.species = out.species.filter(r => r.group !== 'Priority species'); out.veg = []; out.land = []; out.features = []; out.layers = []; out.restoration = []; }
  const ab = (k, x) => out.about.push({item:k, value:x});
  ab('Source', 'A.T. Resource Grid dashboard'); ab('Exported', localDay()); ab('iNaturalist and eBird data run', D.run);
  ab('Extent', S.ext === 'huc' ? 'HUC10 watershed: every grid cell in the HUC10 shell. ' + HUCONLY + ' They are left out.' : 'A.T. corridor grid cells');
  ab('Cells exported', cells.length); ab('Cell size', LV[lv].name); ab('Section of trail', secName()); ab('Measure on screen', S.m.label);
  ab('Selection', S.box ? (S.box.within ? `Every ${LV[S.box.lv].name} cell inside the ${LV[S.box.within[0]].name} cell ${D.levels[S.box.within[0]].id[S.box.within[1]]}`
    : S.box.label ? (S.box.tour ? S.box.label : 'Every cell with ' + S.box.label) : 'Cells inside a box drawn on the map') : 'One cell clicked on the map');
  ab('Note', 'Each row is a grid cell summary, not a field record. A blank value means no data for that layer in the cell.');
  ab('Note', 'Species lists: birds, invasive plants and forest pests are complete for each cell. Other iNaturalist species are only the ten most recorded.');
  ab('Note', 'Land administrator shares are of the mapped land in the cell. Generalized to the grid; not a boundary determination.');
  ab('Note', 'Unique species ratings are held at 7 and 49 sq mi; 1 sq mi cells carry the rating of the 7 sq mi cell they sit in.');
  ab('Note', 'Facilities and landscapes: A.T. facilities inventory, official and additional features. Structure counts (drainage, steps, signs, barriers) are estimates, spread from maintainer sections by trail miles.');
  ab('Historic resources', out.histState === 'loaded' ? `${out.hist.length} National Register properties and OpenStreetMap cemeteries in the selected cells (NPS, OpenStreetMap; cemeteries each as mapped). Scale: ${histAdmText()}. find_a_grave_url is the cemetery's Find a Grave page when its ID is recorded in OpenStreetMap or Wikidata, otherwise a web search of findagrave.com for the name and state. Loaded ${new Date(HIST.at).toLocaleDateString('en-US')}.`
    : 'Not included: not loaded yet. Open “Where are the historic resources?” once, then export.');
  ab('Priority invasives', out.pinvLoaded && out.pinvLoaded.length ? `Priority invasive plants loaded in this browser: ${out.pinvLoaded.join(', ')}. All research-grade iNaturalist records in the project; observations still needing ID are not included; obscured locations left out. Records follow hikers; a cell without records means nothing reported, not absence.`
    : 'Not included: none loaded yet. Open “Where are invasive plants showing up?”, choose Priority invasives and pick each species to include, then export.');
  ab('Forest pests', out.pestLoaded && out.pestLoaded.length ? `Pests loaded in this browser: ${out.pestLoaded.join(', ')}. All research-grade iNaturalist records in the project, any life stage; observations still needing ID are not included; obscured locations left out. Records follow hikers; a cell without records means nothing reported, not absence.`
    : 'Not included: no pests loaded yet. Open “Where are forest pests showing up?” and pick each pest to include, then export.');
  ab('Flowering', out.phenLoaded && out.phenLoaded.length ? `Species loaded in this browser: ${out.phenLoaded.join(', ')}. Research-grade iNaturalist records with a flower buds or flowers annotation; obscured locations left out. Dates pool all years: first = earliest 10% of flowering records, peak = median, last = latest 10%; 5 or more records for dates, 8 for season length. Records follow hikers, so they show when people saw it.`
    : 'Not included: no species loaded yet. Open “When does it flower here?” and pick each species to include, then export.');
  if (out.layerState) out.layers.forEach(L2 => ab('Map layer: ' + L2.name, L2.id === 'osmcem' || L2.id === 'nrhp' ? (L2.state === 'loaded' ? `${L2.rows.length} ${L2.id === 'nrhp' ? 'National Register ' + (L2.rows.length === 1 ? 'property' : 'properties') : 'OpenStreetMap ' + (L2.rows.length === 1 ? 'cemetery' : 'cemeteries')} from ${HISTFILE} (built ${new Date(HIST.at).toLocaleDateString('en-US')}), scale: ${histAdmText()}. The same records are in the Historic resources sheet.` : 'Not included: open “Where are the historic resources?” once, then export.') : L2.state === 'loaded' ? `${L2.rows.length} ${L2.rows.length === 1 ? 'feature' : 'features'}, all attributes, fetched ${localDay()} from the map layer service. ${L2.type === 'pt' ? 'Each point is listed in the cell it falls in.' : 'Every feature touching a cell is listed under it, so one that crosses several cells appears in each; acres and lengths are for the whole feature.'}`
      : L2.state === 'skipped' ? `Not included: the selection has more than ${LAYERMAX} cells. Select fewer cells to include this layer.` : 'Not included: the map layer service could not be reached.'));
  if (out.liveState) ab('iNaturalist live lookup', out.liveState === 'loaded' ? `${out.live.length} most recent observations with open locations, fetched ${localDay()} from the iNaturalist project. A snapshot, not a complete count; not part of any other number in this export.`
    : 'Not included: iNaturalist could not be reached, or the selection is too wide for a live lookup.');
  ab('Note', 'Restoration scores (0 to 100) are worked out from the other layers. Grasslands: ' + restNote('grass') + ' Forests: ' + restNote('forest') + ' Herbicide use (wetland deduction) was ' + (S.herb ? 'on' : 'off') + ' for this export. Lands: ' + (S.appa ? 'APPA lands only (other lands left out).' : 'all lands except private.') + ' Private land is left out: habitat points are multiplied by the share of the corridor land in the cell that is not private; all other administrators count the same. Counts and acres are scored by rank among cells of the same size; only A.T. corridor lands count: habitat acres and wetlands are those on corridor lands, and a cell needs at least one acre of open habitat or forest there to be scored.');
  ab('Note', 'Wetlands: USFWS National Wetlands Inventory, acres in the whole cell. Possibly sensitive = NWI codes suggesting bogs or fens, seeps, aquatic beds, beaver-influenced areas or possible vernal pools; a flag for field checks. NWI misses many small, forested and seasonal wetlands; not a delineation.');
  ab('Note', 'Geology: bedrock from the USGS State Geologic Map Compilation (Horton and others, 2017), compiled from state maps at 1:50,000 to 1:1,000,000; bedrock_pct_ columns are shares of the mapped area in the cell, blank where only the main type is kept (1 sq mi cells in the HUC10 shell). Geologic maps: NPS Geologic Resources Inventory map footprints (approximate); a map is listed when it covers at least 10% of the cell.');
  ab('Note', 'Plants of cultural significance: research-grade iNaturalist records (quarterly summary) matched to ' + CULTD.length + ' plants documented for Eastern Woodlands nations, with the source for each. Ginseng, goldenseal, ramps and lady’s slippers are listed only for 49 sq mi cells. No records does not mean a plant is absent.');
  ab('Note', 'Soils: NRCS gSSURGO, area-weighted over each cell. Trail vulnerability index 0 to 1: three NRCS trail ratings, each scored in even steps from best class (0) to worst (1), averaged. Low under 0.33, High over 0.67. Blank where the soils are not rated.');
  return out; }
function download(name, blob){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function loadXLSX(){ return window.XLSX ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
async function exportRun(kind){ const msg0 = $('#pexmsg'); if (msg0 && S.ext !== 'huc' && !ATiNat.cached(liveKey())) msg0.textContent = 'Fetching the latest iNaturalist observations...';
  await liveEnsure().catch(() => {});
  if (msg0) msg0.textContent = 'Fetching map layers…'; await layersEnsure().catch(() => {});
  const msg = $('#pexmsg'), d = expOrder(exportData()), n = d.cells.length, stamp = localDay(), name = `AT_resource_grid_${n}_${n === 1 ? 'cell' : 'cells'}_${stamp}`;
  const say = x => { if (msg) msg.textContent = x; };
  if (kind === 'csv'){ /* one long table so a single file holds everything */
    const q = x => { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const rows = [['grid_id','trail_mile','table','item','scientific_name','detail','value','unit']];
    d.about.forEach(a => rows.push(['', '', 'About this export', a.item, '', '', a.value, '']));
    d.cells.forEach(c => Object.keys(c).forEach(k => { if (k !== 'grid_id' && k !== 'trail_mile' && c[k] !== '') rows.push([c.grid_id, c.trail_mile, 'Cell summary', k, '', '', c[k], '']); }));
    d.restoration.forEach(s => Object.keys(s).forEach(k => { if (!['grid_id','trail_mile','cell_size'].includes(k) && s[k] !== '') rows.push([s.grid_id, s.trail_mile, 'Restoration', k, '', '', s[k], k.endsWith('score') ? 'of 100' : 'points']); }));
    d.soils.forEach(s => Object.keys(s).forEach(k => { if (!['grid_id','trail_mile','cell_size'].includes(k) && s[k] !== '') rows.push([s.grid_id, s.trail_mile, 'Soils', k, '', '', s[k], '']); }));
    d.wetlands.forEach(s => Object.keys(s).forEach(k => { if (!['grid_id','trail_mile','cell_size'].includes(k) && s[k] !== '') rows.push([s.grid_id, s.trail_mile, 'Wetlands', k, '', '', s[k], k.endsWith('_ac') || k.endsWith('_acres') ? 'acres' : '']); }));
    d.geology.forEach(s => Object.keys(s).forEach(k => { if (!['grid_id','trail_mile','cell_size'].includes(k) && s[k] !== '') rows.push([s.grid_id, s.trail_mile, 'Geology', k, '', '', s[k], k.startsWith('pct_') || k.startsWith('bedrock_pct_') ? '%' : '']); }));
    d.geoUnits.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Bedrock unit', r.unit, '', [r.map_label, r.age, r.bedrock_type, r.major_rock_types, r.state].filter(Boolean).join('; '), r.pct_of_cell, '% of cell']));
    d.geoMaps.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Geologic map', r.map_title, '', [r.year, r.scale, r.map_type, r.gis_data ? 'GIS data' : '', r.reference, r.notes].filter(Boolean).join('; '), r.url, '']));
    d.cult.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Plant of cultural significance', r.common_name, r.scientific_name, [r.status !== 'Native' ? r.status : '', r.source].filter(Boolean).join('; '), r.source_link, '']));
    d.veg.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Vegetation type', r.vegetation_type, '', r.acres + ' acres', r.pct_of_mapped_acres, '% of mapped acres']));
    d.species.forEach(r => rows.push([r.grid_id, r.trail_mile, r.group, r.common_name, r.scientific_name, [r.habitat_group_or_list, r.lists, r.eddmaps_reports != null ? `EDDMapS: ${r.eddmaps_reports} reports` + (r.eddmaps_infested_acres !== '' ? `, ${r.eddmaps_infested_acres} infested acres` : '') + (r.eddmaps_latest_abundance ? `, latest abundance ${r.eddmaps_latest_abundance}` : '') : ''].filter(Boolean).join('; '), '', '']));
    d.layers.forEach(L2 => L2.rows.forEach((r, i) => { const id = r.Name || r.NAME || r.Tract || r.TRACT1 || ''; Object.keys(r).forEach(k => { if (!['grid_id','trail_mile'].includes(k) && r[k] !== '') rows.push([r.grid_id, r.trail_mile, 'Map layer: ' + L2.name, k, '', `feature ${i + 1}${id ? ' (' + id + ')' : ''}`, r[k], '']); }); }));
    d.land.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Land administrator', r.administrator, '', '', r.pct_of_mapped_land, '% of mapped land']));
    d.features.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Facility or landscape: ' + r.feature_type, r.name, '', r.detail, r.latitude === '' ? '' : r.latitude + ', ' + r.longitude, r.latitude === '' ? '' : 'lat, lon']));
    (d.hist || []).forEach(r => rows.push([r.grid_id, r.trail_mile, 'Historic resource: ' + r.kind, r.name, '', Object.entries(r).filter(([k, v]) => !['grid_id','trail_mile','kind','name','latitude','longitude'].includes(k) && v !== '').map(([k, v]) => k + ': ' + v).join('; '), r.latitude + ', ' + r.longitude, 'lat, lon']));
    d.phen.forEach(s => Object.keys(s).forEach(k => { if (!['grid_id','trail_mile','cell_size','species','scientific_name'].includes(k) && s[k] !== '') rows.push([s.grid_id, s.trail_mile, 'Flowering', s.species + ': ' + k, s.scientific_name, '', s[k], '']); }));
    (d.pinv || []).forEach(s => rows.push([s.grid_id, s.trail_mile, 'Priority invasive', s.species, s.scientific_name, `first recorded ${s.first_year_recorded}, latest ${s.latest_year_recorded}` + (s.eddmaps_reports ? `, plus ${s.eddmaps_reports} EDDMapS ${s.eddmaps_reports === 1 ? 'report' : 'reports'}` : ''), s.research_grade_records, 'research-grade records']));
    (d.pinvRec || []).forEach(r => rows.push([r.grid_id, r.trail_mile, 'Priority invasive record', r.species, r.scientific_name, [r.observed_on, r.source, r.inaturalist_url || r.eddmaps_url].filter(Boolean).join('; '), r.latitude + ', ' + r.longitude, 'lat, lon']));
    (d.pest || []).forEach(s => rows.push([s.grid_id, s.trail_mile, 'Forest pest', s.species, s.scientific_name, `first recorded ${s.first_year_recorded}, latest ${s.latest_year_recorded}` + (s.eddmaps_reports ? `, plus ${s.eddmaps_reports} EDDMapS ${s.eddmaps_reports === 1 ? 'report' : 'reports'}` : ''), s.research_grade_records, 'research-grade records']));
    (d.pestRec || []).forEach(r => rows.push([r.grid_id, r.trail_mile, 'Forest pest record', r.species, r.scientific_name, [r.observed_on, r.source, r.inaturalist_url || r.eddmaps_url].filter(Boolean).join('; '), r.latitude + ', ' + r.longitude, 'lat, lon']));
    d.phenRec.forEach(r => rows.push([r.grid_id, r.trail_mile, 'Flowering record', r.species, r.scientific_name, [r.stage, r.observed_on, r.inaturalist_url].filter(Boolean).join('; '), r.latitude + ', ' + r.longitude, 'lat, lon']));
    d.live.forEach(r => rows.push([r.grid_id, r.trail_mile, 'iNaturalist live lookup', r.common_name || r.scientific_name, r.scientific_name, [r.observed_on, r.observer, r.quality_grade, r.list, r.inaturalist_url].filter(Boolean).join('; '), r.latitude + ', ' + r.longitude, 'lat, lon']));
    { const head = rows.shift(); const ord = rows.map((r, i) => [expRank(r[2]), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); rows.length = 0; rows.push(head, ...ord); }
    download(name + '.csv', new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
    say(`CSV downloaded: ${fmt(rows.length - 1, 0)} rows for ${nCells(n)}.`); return; }
  say('Preparing the Excel file...');
  loadXLSX().then(() => { const wb = XLSX.utils.book_new(); const add = (nm, arr) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(arr.length ? arr : [{note:'No rows for this selection'}]), nm);
    const sheets = [['Cells', d.cells], ['Restoration', d.restoration], ['Soils', d.soils], ['Wetlands', d.wetlands], ['Geology', d.geology], ['Bedrock units', d.geoUnits], ['Geologic maps', d.geoMaps], ['Species', d.species], ['Plants of cultural significance', d.cult], ['Vegetation types', d.veg], ['Land administrators', d.land], ['Facilities and landscapes', d.features], ['iNaturalist live lookup', d.live], ['Historic resources', d.hist || []], ['Priority invasives', d.pinv || []], ['Priority invasive records', d.pinvRec || []], ['Forest pests', d.pest || []], ['Forest pest records', d.pestRec || []], ['Flowering', d.phen], ['Flowering records', d.phenRec]];
    sheets.map((s, i) => [s[0] === 'Species' ? qRank('inv') + .5 : expRank(s[0]), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([, , s]) => add(s[0], s[1]));
    d.layers.forEach(L2 => add(L2.name.slice(0, 31), L2.rows)); add('About', d.about);
    const buf = XLSX.write(wb, {bookType:'xlsx', type:'array'}); download(name + '.xlsx', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    say(`Excel workbook downloaded: ${nCells(n)}, ${fmt(d.species.length, 0)} species rows.`);
  }).catch(() => say('The Excel export could not load its helper file. Check the internet connection, or use Export CSV, which needs no download.')); }

/* ---------- box selection: combined summary of the selected cells ---------- */
function visPool(lv, cells){ const P = {n:0, od:0, yr:0, obsr:0, src:[0, 0, 0], mon:Array(12).fill(0), hasMon:false, busy:0, busyDate:null, ld:0, ri:0, pi:0, re:0, pe:0, off:0};
  cells.forEach(c => { if (!has('vis', lv, c)) return; const v = f => val('vis', f, lv, c); P.n++; P.od += v('VIS_OD') || 0; P.yr += visRecent(lv, c) || 0; P.obsr += v('VIS_OBSR') || 0; P.ld += v('VIS_LD') || 0; P.off += v('VIS_OFFN') || 0;
    (v('VIS_SRC') || []).forEach((x, i) => P.src[i] += x || 0); const mo = visList(lv, c, 'VIS_OD_M'); if (mo){ P.hasMon = true; mo.forEach((x, i) => P.mon[i] += x || 0); }
    const b = v('VIS_BUSY') || 0; if (b > P.busy){ P.busy = b; const t = v('VIS_BUSY_TOP'); P.busyDate = t && t[0] && t[0][1] === b ? t[0][0] : null; }
    const r = v('VIS_RPD_SRC'); if (r){ P.ri += r[0]; P.pi += r[1]; P.re += r[2]; P.pe += r[3]; } });
  P.peak = P.hasMon && Math.max(...P.mon) > 0 ? P.mon.indexOf(Math.max(...P.mon)) : null; return P; }
const visDate = d => { if (!d) return ''; const s = String(d); return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}); };
function visBoxText(id, lv, cells){ const P = visPool(lv, cells), N = cells.length, sq = N * (HEXIN[lv] || 1); if (!P.n) return 'no observer-days in the selected cells';
  switch (id){
    case 'od': { const raw = S.visYr ? cells.reduce((s, c) => s + (visYearVal(lv, c, S.visYr) || 0), 0) : P.yr, ix = S.visAdj ? visIdx(raw / N, lv, S.visYr) : null;
      return `${fmt(Math.round(raw), 0)} observer-days ${S.visYr ? 'in ' + S.visYr : 'a year'} in total, ${fmt(raw / sq, 1)} per square mile` + (ix != null ? `; index ${fmt(ix, 0)} (100 = the average cell)` : ''); }
    case 'obsr': return `${fmt(P.obsr, 0)} observers added up cell by cell (someone active in several cells counts in each)`;
    case 'peak': return P.peak != null ? `${CATCOL.VIS_PEAK[P.peak][0]}, from the cells’ monthly totals together` : 'not known for these cells';
    case 'busy': return `${fmt(P.busy, 0)} observers on the busiest day in any one cell${P.busyDate ? ' (' + visDate(P.busyDate) + ')' : ''}`;
    case 'ld': return P.od ? `${fmt(100 * P.ld / P.od, 0)}% of all ${fmt(P.od, 0)} observer-days` : 'no observer-days';
    case 'rpd': return P.pi + P.pe ? `${fmt((P.ri + P.re) / (P.pi + P.pe), 1)} records per observer-day, all records over all observer-days` : 'no records';
    case 'off': return P.ri + P.re ? `${fmt(100 * P.off / (P.ri + P.re), 0)}% of all ${fmt(P.ri + P.re, 0)} records` : 'no records'; } return ''; }
function boxMeasure(m, lv, cells){ if (m.boxFn) return m.boxFn(lv, cells); const vals = []; cells.forEach(c => { const v = m.get(lv, c); if (v != null) vals.push(v); }); const N = cells.length;
  if (m.find) return `recorded in ${vals.length} of ${N} cells`;
  if (!vals.length) return 'no data in the selected cells';
  if (m.kind === 'cat'){ const cnt = new Map(); vals.forEach(v => cnt.set(v, (cnt.get(v) || 0) + 1)); const top = [...cnt].sort((a,b) => b[1] - a[1])[0]; return `mostly ${show(m, top[0])} (${top[1]} of ${vals.length} cells with data)`; }
  const sum = vals.reduce((a,b) => a + b, 0), mx = Math.max(...vals), noun = m.noun ? m.noun[1] : '';
  if (m.unit === '%') return `${fmt(sum / vals.length, 1)}% on average, up to ${fmt(mx, m.d)}%`;
  if (['acres','records','checklists'].includes(noun)) return `${fmt(sum, 0)} ${noun} in total`;
  return `${fmt(sum / vals.length, 1)} ${noun} per cell on average, up to ${fmt(mx, 0)}`.replace('  ', ' '); }
/* one row per selected cell (south to north), one column per measure of the question on show */
function cellTable(lv, cells){ const L_ = D.levels[lv], ms = S.q.m.filter(m => !m.hideFn || !m.hideFn()), rows = cells.slice().sort((a, b) => L_.mi[a] - L_.mi[b]), n = Math.min(300, rows.length);
  const cellv = (m, c) => { let v; try { v = m.get(lv, c); } catch (e) { v = null; } return v == null ? '–' : show(m, v); };
  return `<div class="sec" style="--hue:${S.q.hue}"><h3>Cell by cell</h3><p class="none" style="font-size:13.5px;margin:0 0 6px">${esc(S.q.title)} Each selected cell, south to north${rows.length > n ? `; the first ${n} of ${rows.length}` : ''}. Export adds every layer for every cell.</p>` +
    `<div class="ctab"><table><thead><tr><th>Mile</th><th>Grid ID</th>${ms.map(m => `<th>${esc(m.label)}</th>`).join('')}</tr></thead><tbody>` +
    rows.slice(0, n).map(c => `<tr><td>${fmt(L_.mi[c], 0)}</td><td>${esc(L_.id[c])}</td>${ms.map(m => `<td>${esc(cellv(m, c))}</td>`).join('')}</tr>`).join('') + '</tbody></table></div></div>'; }
function profileBox(){ const lv = S.box.lv, cells = S.box.cells, L_ = D.levels[lv], N = cells.length; setSppBox(cells.map(c => ring(lv, c)));
  const mis = cells.map(c => L_.mi[c]), lo = Math.min(...mis), hi = Math.max(...mis);
  const w = S.box.within, wName = w && `${LV[w[0]].name} cell near mile ${fmt(D.levels[w[0]].mi[w[1]], 0)}`;
  let h = `<h2>${nCells(N)} selected</h2><p>${w ? `Every ${LV[lv].name} cell inside the ${wName}` : `${S.box.picked ? 'Picked one by one. ' : ''}${S.box.label ? (S.box.tour ? esc(S.box.label) : 'Every cell with ' + esc(S.box.label)) + '. ' : ''}${LV[lv].name} cells, trail miles ${fmt(lo,0)} to ${fmt(hi,0)}`}</p>`;
  h += `<p class="peekval"><span>${esc(S.m.label)}:</span> <b>${esc(boxMeasure(S.m, lv, cells))}</b></p>`;
  const sr = w ? scaleRow(w, lv) : null;
  h += (sr ? sr[0] : '') + `<div class="pnav"><button type="button" id="pclearbox">Clear selection</button>${EXPORTBTNS}</div>`;
  $('#phead').innerHTML = h; if (sr) sr[1]($('#phead')); $('#pclearbox').onclick = clearSel; exportWire();
  const withTh = th => D.themes[th] && D.themes[th][lv] ? cells.filter(c => has(th, lv, c)) : [];
  const ctag = n => `<span class="tag">${nCells(n)}</span>`;
  const item = (i, n, ed) => sppItem(i, ed, ed !== undefined).replace('</li>', ctag(n) + '</li>');
  const union = (th, f, cs) => { const m = new Map(); cs.forEach(c => (val(th, f, lv, c) || []).forEach(i => m.set(i, (m.get(i) || 0) + 1))); return [...m].sort((a,b) => b[1] - a[1] || D.spp[a[0]].localeCompare(D.spp[b[0]])); };
  let b = `<p class="boxm"><span>${esc(S.m.label)}:</span> <b>${esc(boxMeasure(S.m, lv, cells))}</b></p><p class="none" style="font-size:13.5px;margin:6px 0 0">Combined from the ${nCells(N)}${S.box.label || w || S.box.picked ? '' : ' whose centers fall inside the box'}. Records and acres are added up. Species and types are counted once, however many cells they occur in.</p>`;

  const huc = S.ext === 'huc'; if (huc) b += `<p class="none" style="font-size:13.5px;margin:8px 0 0">${HUCONLY}</p>`;

  // vegetation
  if (!huc){ const cs = withTh('veg'); b += `<div class="sec" style="--hue:${HUE.veg}"><h3>Vegetation</h3>`;
    if (cs.length){ let ac = 0; const ty = new Map(), l2 = L2.map(() => 0);
      cs.forEach(c => { const a = val('veg','VEG_AREA',lv,c) || 0; ac += a; const cp = val('veg','COMP',lv,c) || []; for (let k = 0; k < cp.length; k += 2) ty.set(cp[k], (ty.get(cp[k]) || 0) + a * cp[k+1] / 100);
        L2.forEach((x, k) => l2[k] += a * (val('veg', x[0], lv, c) || 0) / 100); });
      const tl = [...ty].sort((a,b) => b[1] - a[1]).map(x => [D.cats.DOM_TYPE[x[0]], ac ? 100 * x[1] / ac : 0]);
      b += `<div class="facts"><div><b>${fmt(ac,0)}</b>acres mapped</div><div><b>${tl.length}</b>vegetation types</div><div><b>${cs.length}</b>of ${N} cells mapped</div></div>`;
      b += '<p>Vegetation types, by share of the mapped acres:</p>' + topSix(tl, vegRow, 'keys', 'more types');
      b += coverHTML(L2.map((x, k) => [x[1], ac ? 100 * l2[k] / ac : 0, x[2]]));
    } else b += '<p class="none">The vegetation map does not reach the selected cells.</p>';
    b += '</div>'; }

  // iNaturalist
  { const cs = withTh('inat'); b += `<div class="sec" style="--hue:${HUE.inat}"><h3>Invasive species</h3>`;
    const ci = cells.filter(c => hasInv(lv, c)), uInv = f => { const m = new Map(); ci.forEach(c => (invL(f, lv, c) || []).forEach(i => m.set(i, (m.get(i) || 0) + 1))); return [...m].sort((a,b) => b[1] - a[1] || D.spp[a[0]].localeCompare(D.spp[b[0]])); };
    if (ci.length){ const rec = cs.reduce((s,c) => s + (val('inat','N_OBS',lv,c) || 0), 0), inv = uInv('INVASIVE_LIST'), ed = new Set(uInv('EDRR_LIST').map(x => x[0])), pest = uInv('PEST_LIST'), T = invSrc(lv, ci);
      const nInvAll = new Set([...inv.map(x => x[0]), ...pest.map(x => x[0])]).size;
      b += `<div class="facts"><div><b>${nInvAll ? nInvAll : 'None'}</b>invasive species</div><div><b>${fmt(rec,0)}</b>iNat records</div><div><b>${ci.length}</b>of ${N} cells with records</div></div>`;
      b += `<p class="none" style="font-size:13.5px">Invasive plants and forest pests are counted together, from iNaturalist and EDDMapS (species reported in EDDMapS are flagged). Quarterly summary (${esc(D.run)}).</p>`;
      b += (inv.length ? '<p class="none" style="font-size:13.5px;margin-top:8px">With the number of selected cells each was found in.</p>' : '') + invPlantsHTML(inv, ed, lv, ci);
      b += pest.length ? `<p style="margin-top:8px">Forest pests reported:</p><ul class="spp">${pest.map(x => srcItem(x[0], T, true, `<span class="tag">${nCells(x[1])}</span>`)).join('')}</ul>` : '<p class="none" style="margin-top:8px">No forest pests reported.</p>';
      b += eddNote(lv, ci) + eddDetail(lv, ci);
    } else b += `<p class="none">No iNaturalist${D.themes.edd && D.themes.edd[lv] ? ' or EDDMapS' : ''} records in the selected cells in the quarterly summary.</p>`;
    b += '</div>'; b += recBox(lv, cells); } b += cultBox(lv, cells);

  // birds
  { const cs = withTh('ebird'); b += `<div class="sec" style="--hue:${HUE.ebird}"><h3>Birds</h3>`;
    if (cs.length){ const G = BIRD_GROUPS.map(g => [g.label, union('ebird', g.list, cs), g.spp]).filter(g => g[1].length);
      const soc = union('ebird','SOC_LIST',cs), key = i => D.spp[i].replace(/\s*\[.*\]$/, ''), all = new Set(); G.forEach(g => g[1].forEach(x => all.add(key(x[0])))); soc.forEach(x => all.add(key(x[0])));
      const ck = cs.reduce((s,c) => s + (val('ebird','N_CHECKLISTS',lv,c) || 0), 0), mx = Math.max(1, ...G.map(g => g[1].length));
      b += `<div class="facts"><div><b>${all.size}</b>species</div><div><b>${fmt(ck,0)}</b>checklists</div><div><b>${cs.length}</b>of ${N} cells with checklists</div></div>`;
      b += '<p style="margin-top:8px">Species by habitat group. Open a group to see its species and how many selected cells each was found in.</p>' + G.map(g => `<details class="gd"${S.m.f === g[2] ? ' open' : ''}><summary class="guild"><div>${g[0]}</div><div><span style="width:${100*g[1].length/mx}%"></span></div><div>${g[1].length}</div></summary><ul class="spp">${g[1].map(x => item(x[0], x[1])).join('')}</ul></details>`).join('');
      if (soc.length) b += `<details><summary>${soc.length} species on watch lists</summary><ul class="spp">${soc.map(x => item(x[0], x[1])).join('')}</ul><p class="none" style="font-size:13.5px">BCC is the USFWS Birds of Conservation Concern list. PIF is Partners in Flight.</p></details>`;
    } else b += '<p class="none">No eBird checklists in the selected cells.</p>';
    b += '</div>'; }

  // unique species
  if (!huc && JERRY){ b += `<div class="sec" style="--hue:${HUE.nrpz}"><h3>Unique species</h3>`; let plv = lv, pcs = cells, via = false;
    if (!D.themes.nrpz[lv]){ const s = new Set(); cells.forEach(c => { const p = parentOf(lv, c); if (p) s.add(p[1]); }); plv = 'cog'; pcs = [...s]; via = true; }
    const cnt = new Map(); pcs.forEach(c => { const v = val('nrpz','review_tie',plv,c); if (v != null) cnt.set(v, (cnt.get(v) || 0) + 1); });
    if (cnt.size){ b += '<div class="keys">' + CATCOL.review_tie.map(e => { const k = cnt.get(D.cats.review_tie.indexOf(e[0])) || 0; return k ? `<div><i style="background:${e[1]}"></i><span>${esc(e[2] || e[0])}</span><span>${nCells(k)}</span></div>` : ''; }).join('') + '</div>';
      if (via) b += '<p class="none">Counted for the 7 sq mi cells that the selected square miles sit in.</p>';
    } else b += '<p class="none">No rare species priority zone in the selected cells.</p>';
    b += '</div>'; }

  b += S.q.id === 'wet' ? wetBox(lv, cells) + soilBox(lv, cells) : soilBox(lv, cells) + wetBox(lv, cells);
  b += geoBox(lv, cells) + tvBox(lv, cells) + tfBox(lv, cells) + wxBox(lv, cells) + dymBox(lv, cells) + fhrBox(lv, cells) + fcBox(lv, cells) + visBox(lv, cells);
  if (!huc){ b += featBox(lv, cells); b = S.q.id === 'rest' ? restBox(lv, cells) + b : b + restBox(lv, cells); }

  // land administrators
  if (!huc && D.themes.lands){ const cs = withTh('lands'); b += `<div class="sec" style="--hue:${HUE.lands}"><h3>Land administrators</h3>`;
    if (cs.length){ const ac = new Map(), nn = new Map(); let tot = 0;
      cs.forEach(c => { const a = val('lands','LAND_AC',lv,c) || 0, raw = val('lands','MGRS',lv,c) || []; tot += a; for (let k = 0; k < raw.length; k += 2){ ac.set(raw[k], (ac.get(raw[k]) || 0) + a * raw[k+1] / 100); nn.set(raw[k], (nn.get(raw[k]) || 0) + 1); } });
      const mg = [...ac].sort((a,b) => b[1] - a[1]).map(x => [D.cats.MGR[x[0]], tot ? 100 * x[1] / tot : 0, nn.get(x[0])]);
      const row = x => `<div><span>${esc(x[0])} <em style="color:var(--muted);font-style:normal;font-size:13px">${nCells(x[2])}</em></span><span>${pctLt1(x[1])}</span></div>`;
      b += `<p>${mg.length} ${mg.length === 1 ? 'administrator has' : 'administrators have'} mapped land in the selected cells. Each share is of the mapped land in the selection, not of the whole area:</p>` + topSix(mg, row, 'keys nosw', 'more');
      b += '<p class="none" style="font-size:13.5px;margin-top:8px">Generalized to the cells from tract records. Not a boundary determination, and not a record of who administers any given spot.</p>';
    } else b += '<p class="none">No land records summarized for the selected cells.</p>';
    b += '</div>'; }
  b += phSection(lv, cells) + histSection(lv, cells) + cellTable(lv, cells);
  finishProfile(b); inatLive(cells.map(c => ring(lv, c)), liveKey()); }

/* Wetlands (USFWS National Wetlands Inventory): acres in the whole cell, by NWI type and Cowardin class, and on A.T. lands. */
const WETTYPES = [['T_FFS','Freshwater Forested/Shrub Wetland'],['T_FEM','Freshwater Emergent Wetland'],['T_POND','Freshwater Pond'],['T_LAKE','Lake'],
  ['T_RIV','Riverine'],['T_EST','Estuarine and Marine'],['T_OTH','Other']];
const WETCLASS = [['C_FO','Forested'],['C_SS','Scrub-shrub'],['C_EM','Emergent'],['C_AB','Aquatic bed'],['C_UB','Unconsolidated bottom (open water)'],
  ['C_US','Unconsolidated shore'],['C_SB','Streambed'],['C_RB','Rock bottom'],['C_RS','Rocky shore']];
const wetCol = lab => (CATCOL.WET_DOM.find(e => e[0] === lab) || CATCOL.WET_DOM.find(e => e[0].startsWith(lab)) || [0,'#B28653'])[1];
function wetKeys(get){ return '<div class="keys">' + WETTYPES.map(([f, lab]) => [lab, get(f)]).filter(x => x[1] > 0).sort((a,b) => b[1] - a[1])
  .map(([lab, a]) => `<div><i style="background:${wetCol(lab)}"></i><span>${esc(lab)}</span><span>${wetAc(a)}</span></div>`).join('') + '</div>'; }
const WETNOTE = '<p class="none" style="font-size:13.5px;margin-top:8px">From the USFWS National Wetlands Inventory, for the whole cell. NWI is mapped from aerial imagery and misses many small, forested and seasonally wet wetlands; hydric soils (under Soils) can point to more. A planning screen, not a delineation.</p>';
function wetSection(lv, c){ if (!D.themes.wet || !D.themes.wet[lv]) return '';
  const v = f => val('wet', f, lv, c); let b = `<div class="sec" style="--hue:${HUE.wet}"><h3>Wetlands</h3>`;
  if (!has('wet', lv, c)) return b + '<p class="none">No wetland data for this cell.</p></div>';
  if (!v('WET_AC')) return b + '<p class="none">No wetlands mapped in this cell.</p>' + WETNOTE + '</div>';
  b += `<div class="facts"><div><b>${wetAc(v('WET_AC'))}</b>of wetland</div><div><b>${v('WET_PCT') < 1 ? '<1%' : fmt(v('WET_PCT'), 0) + '%'}</b>of the cell</div><div><b>${fmt(v('N_WET'), 0)}</b>${v('N_WET') === 1 ? 'wetland' : 'wetlands'}</div></div>`;
  b += `<p style="margin-top:8px">Mostly ${esc(cat('WET_DOM', v('WET_DOM')) || '–')} (${fmt(v('DOM_PCT'), 0)}%). By type:</p>` + wetKeys(v);
  b += '<div class="keys nosw" style="margin-top:6px">' + soilRow('Vegetated wetland', wetAc(v('VEGW_AC'))) + soilRow('Open water', wetAc(v('WATER_AC'))) +
    soilRow('Possibly sensitive', wetAc(v('SENS_AC'))) + '</div>';
  const cls = WETCLASS.filter(([f]) => v(f) > 0);
  if (cls.length) b += '<details><summary>Cowardin class</summary><div class="keys nosw">' + cls.map(([f, lab]) => soilRow(lab, wetAc(v(f)))).join('') + '</div></details>';
  b += v('LANDS_AC') > 0
    ? `<p style="margin-top:8px">On A.T. lands (${wetAc(v('LANDS_AC'))} in this cell):</p><div class="keys nosw">` + soilRow('Wetland', wetAc(v('L_WET_AC'))) +
      (v('L_WET_AC') > 0 ? soilRow('Main type', esc(cat('WET_LDOM', v('WET_LDOM')) || '–')) + soilRow('Wetlands', fmt(v('L_N_WET'), 0)) + soilRow('Possibly sensitive', wetAc(v('L_SENS_AC'))) : '') + '</div>'
    : '<p class="none" style="font-size:13.5px;margin-top:8px">No A.T. lands mapped in this cell.</p>';
  return b + WETNOTE + '</div>'; }
function wetBox(lv, cells){ if (!D.themes.wet || !D.themes.wet[lv]) return '';
  const cs = cells.filter(c => has('wet', lv, c)), sum = f => cs.reduce((s, c) => s + (val('wet', f, lv, c) || 0), 0), withW = cs.filter(c => val('wet','WET_AC',lv,c) > 0);
  let b = `<div class="sec" style="--hue:${HUE.wet}"><h3>Wetlands</h3>`;
  if (!cs.length) return b + '<p class="none">No wetland data for the selected cells.</p></div>';
  if (!withW.length) return b + '<p class="none">No wetlands mapped in the selected cells.</p>' + WETNOTE + '</div>';
  const ac = sum('WET_AC'), ref = withW.find(c => val('wet','WET_PCT',lv,c) > 0), cellAc = ref ? val('wet','WET_AC',lv,ref) / val('wet','WET_PCT',lv,ref) * 100 : null;
  const pct = cellAc ? 100 * ac / (cellAc * cs.length) : null, nw = sum('N_WET');
  b += `<div class="facts"><div><b>${wetAc(ac)}</b>of wetland</div><div><b>${pct == null ? '–' : pct < 1 ? '<1%' : fmt(pct, 0) + '%'}</b>of the selected cells</div><div><b>${fmt(nw, 0)}</b>${nw === 1 ? 'wetland' : 'wetlands'}</div></div>`;
  b += `<p class="none" style="font-size:13.5px;margin-top:4px">${withW.length} of the ${nCells(cells.length)} have wetland mapped. Acres and counts are added across the cells; a wetland crossing a cell edge is counted in each cell.</p>`;
  const ty = WETTYPES.map(([f, lab]) => [lab, sum(f)]).sort((a, b) => b[1] - a[1]);
  b += `<p style="margin-top:8px">Mostly ${esc(ty[0][0])} (${fmt(ac ? 100 * ty[0][1] / ac : 0, 0)}%). By type:</p>` + wetKeys(sum);
  b += '<div class="keys nosw" style="margin-top:6px">' + soilRow('Vegetated wetland', wetAc(sum('VEGW_AC'))) + soilRow('Open water', wetAc(sum('WATER_AC'))) +
    soilRow('Possibly sensitive', wetAc(sum('SENS_AC'))) + '</div>';
  const cls = WETCLASS.filter(([f]) => sum(f) > 0);
  if (cls.length) b += '<details><summary>Cowardin class</summary><div class="keys nosw">' + cls.map(([f, lab]) => soilRow(lab, wetAc(sum(f)))).join('') + '</div></details>';
  const la = sum('LANDS_AC');
  if (la > 0){ const lw = sum('L_WET_AC'), ld = new Map(); cs.forEach(c => { const d = val('wet','WET_LDOM',lv,c), a = val('wet','L_WET_AC',lv,c) || 0; if (d != null && a > 0) ld.set(d, (ld.get(d) || 0) + a); });
    const top = [...ld].sort((a, b) => b[1] - a[1])[0];
    b += `<p style="margin-top:8px">On A.T. lands (${wetAc(la)} in the selected cells):</p><div class="keys nosw">` + soilRow('Wetland', wetAc(lw)) +
      (lw > 0 ? soilRow('Main type', esc(top ? cat('WET_LDOM', top[0]) || '–' : '–')) + soilRow('Wetlands', fmt(sum('L_N_WET'), 0)) + soilRow('Possibly sensitive', wetAc(sum('L_SENS_AC'))) : '') + '</div>';
  } else b += '<p class="none" style="font-size:13.5px;margin-top:8px">No A.T. lands mapped in the selected cells.</p>';
  return b + WETNOTE + '</div>'; }
function soilBox(lv, cells){ if (!D.themes.soil) return '';
  const N = cells.length, cs = D.themes.soil[lv] ? cells.filter(c => has('soil', lv, c)) : [], rated = cs.filter(c => val('soil','VULN',lv,c) != null);
  let b = `<div class="sec" style="--hue:${HUE.soil}"><h3>Soils</h3>`;
  if (!cs.length) return b + '<p class="none">No soil survey data for the selected cells.</p></div>';
  const avgOf = (f, from) => { const a = (from || cs).map(c => val('soil', f, lv, c)).filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const v = f => avgOf(f, ['VULN','VULN_HIGH','PATHS_VLIM','WORST1','NRCS_IDX','EROS_HR','PATHS_HR','RUT_HR','RUT_SEV'].includes(f) ? rated : null);
  const t = (x, u) => x == null ? '–' : fmt(x, 0) + (u || '');
  /* the most common value across the cells, with how many cells have it */
  const mode = (f, lab) => { const m = new Map(); cs.forEach(c => { const x = val('soil', f, lv, c); if (x != null && x !== '') m.set(x, (m.get(x) || 0) + 1); });
    const top = [...m].sort((a, b) => b[1] - a[1])[0]; if (!top) return '–'; const s = lab ? lab(top[0]) : cat(f, top[0]);
    return s ? `${esc(s)} <span style="color:var(--muted)">(${top[1]} of ${cs.length})</span>` : '–'; };
  const list = (f, lab) => { const m = new Map(); cs.forEach(c => { const x = val('soil', f, lv, c); if (x != null && x !== '') m.set(x, (m.get(x) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]).map(([x, n]) => [lab ? lab(x) : cat(f, x), n]).filter(x => x[0]); };
  const vi = v('VULN'), cnt = {Low:0, Moderate:0, High:0}; rated.forEach(c => cnt[vulnClass(val('soil','VULN',lv,c))]++);
  b += vi != null
    ? `<div class="facts"><div><b>${fmt(vi, 2)}</b>trail vulnerability, ${vulnClass(vi).toLowerCase()} on average</div><div><b>${soilPct(v('VULN_HIGH'))}</b>of soils rated high</div><div><b>${soilPct(v('PATHS_VLIM'))}</b>very limited for paths</div></div>`
    : '<p class="none">The trail ratings are not available for the soils in the selected cells.</p>';
  if (rated.length) b += `<p style="margin-top:8px">Cells by trail vulnerability (${rated.length} of ${N} rated):</p><div class="keys">` + CATCOL.VULN_DOM.slice().reverse().map(e => cnt[e[0]] ? `<div><i style="background:${e[1]}"></i><span>${e[0]}</span><span>${nCells(cnt[e[0]])}</span></div>` : '').join('') + '</div>';
  b += '<div class="keys nosw" style="margin-top:8px">' + soilRow('At least one rating at its worst', soilPct(v('WORST1'))) + '</div>';
  b += `<p style="margin-top:8px">NRCS rating scores, 0 to 1, higher is more limiting (average ${soilScore(v('NRCS_IDX'))}):</p><div class="keys nosw">` +
    soilRow('Erosion hazard, unsurfaced trails', soilScore(v('EROS_HR'))) + soilRow('Paths and trails', soilScore(v('PATHS_HR'))) + soilRow('Rutting hazard', soilScore(v('RUT_HR'))) + '</div>';
  b += '<div class="keys nosw" style="margin-top:6px">' + soilRow('Severe rutting hazard', soilPct(v('RUT_SEV'))) + soilRow('Slopes over 25%', soilPct(v('STEEP'))) +
    soilRow('Average slope', t(v('SLOPE'), '%')) + soilRow('Highly erodible (K over 0.32)', soilPct(v('K_HIGH'))) + soilRow('Already eroded', soilPct(v('ERODED'))) +
    soilRow('Shallow to bedrock (under 50 cm)', soilPct(v('SHALLOW_ROCK'))) + soilRow('High frost action', soilPct(v('FROST_HIGH'))) + soilRow('Subject to flooding', soilPct(v('FLOOD'))) + '</div>';
  const ser = list('SOIL_SERIES'), mus0 = list('DOM_MAPUNIT', x => x), mus = mus0.length ? mus0 : list('SOIL_MAPUNIT');
  const lst = (a, more) => a.length ? `<ul class="flist">${a.slice(0, 12).map(x => `<li><span>${esc(x[0])}</span><em>${nCells(x[1])}</em></li>`).join('')}</ul>` + (a.length > 12 ? `<p class="none" style="font-size:13.5px">and ${a.length - 12} ${more}</p>` : '') : '';
  b += '<details><summary>Soil type</summary><div class="keys nosw">' + soilRow('Most common main series', mode('SOIL_SERIES')) +
    soilRow('Soil series per cell, average', t(v('N_SERIES'))) + soilRow('Surface texture', mode('SOIL_TEXTURE')) + soilRow('Soil order', mode('SOIL_ORDER')) +
    soilRow('Drainage', mode('SOIL_DRAIN')) + soilRow('Hydrologic group', mode('SOIL_HSG')) + soilRow('Ecological site', mode('SOIL_ECOSITE')) + '</div>' +
    (ser.length ? '<p style="margin-top:8px">Main soil series of each cell:</p>' + lst(ser, 'more series') : '') +
    (mus.length ? '<p style="margin-top:8px">Main map unit of each cell:</p>' + lst(mus, 'more map units') : '') +
    '<p class="none" style="font-size:13.5px;margin-top:6px">Counts in brackets are how many of the cells with soil data share that value.</p></details>';
  b += '<details><summary>Restoration</summary><div class="keys nosw">' + soilRow('Hydric (wet) soils', soilPct(v('HYDRIC'))) + soilRow('Poorly drained', soilPct(v('POOR_DRAIN'))) +
    soilRow('Droughty', soilPct(v('DROUGHTY'))) + soilRow('Depth to water table', t(v('WTDEP'), ' cm')) + soilRow('Depth to bedrock', t(v('ROCKDEP'), ' cm')) +
    soilRow('Surface pH', v('PH') == null ? '–' : fmt(v('PH'), 1)) + soilRow('Organic matter', v('OM') == null ? '–' : fmt(v('OM'), 1) + '%') + '</div></details>';
  b += '<details><summary>Agriculture</summary><div class="keys nosw">' + soilRow('Prime farmland', soilPct(v('PRIME'))) + soilRow('Prime if drained or irrigated', soilPct(v('PRIME_COND'))) +
    soilRow('Farmland of statewide importance', soilPct(v('STATEWIDE'))) + soilRow('Most common farmland class', mode('SOIL_FARM')) +
    soilRow('Land capability class 1 to 2', soilPct(v('LCC12'))) + soilRow('Land capability class 1 to 4', soilPct(v('LCC14'))) +
    soilRow('Crop productivity index (NCCPI)', v('NCCPI') == null ? '–' : fmt(v('NCCPI'), 2)) + '</div></details>';
  b += `<p class="none" style="font-size:13.5px;margin-top:8px">From the NRCS soil survey (gSSURGO). Figures are averages of the ${nCells(cs.length)} with soil data, each cell counting equally; trail ratings use the ${nCells(rated.length)} with rated soils. Soil data covers ${soilPct(v('SOIL_COV'))} of the cells on average. The Cell by cell table lists each cell's values for the question you're on.</p>`;
  return b + '</div>'; }
/* drawing the box */
function drawMode(on){ S.drawing = on; $('#mapwrap').classList.toggle('drawing', on); $('#boxbtn').setAttribute('aria-pressed', on); $('#boxdraw').hidden = true;
  const hint = $('#maphint'); if (on){ map.dragging.disable(); tip.remove(); hint.textContent = 'Drag on the map to draw a box'; hint.classList.add('on'); }
  else { mapGestures(); hint.classList.remove('on'); setTimeout(() => { hint.textContent = 'Use two fingers to move the map'; }, 250); } }
$('#boxbtn').onclick = () => { if (S.picking) pickMode(false); drawMode(!S.drawing); };
/* Pick cells: each tap adds a cell to the selection or takes it out; one cell left is shown as a single cell */
function pickMode(on){ S.picking = on; $('#pickbtn').setAttribute('aria-pressed', on); if (on && S.drawing) drawMode(false);
  const hint = $('#maphint'); if (on){ hint.textContent = 'Tap cells to add or remove them'; hint.classList.add('on'); setTimeout(() => { if (S.picking) hint.classList.remove('on'); }, 1800); }
  else { hint.classList.remove('on'); setTimeout(() => { hint.textContent = 'Use two fingers to move the map'; }, 250); } }
$('#pickbtn').onclick = () => pickMode(!S.picking);
function pickToggle(lv, c){ let cells = S.box && S.box.lv === lv ? S.box.cells.slice() : S.cell != null && S.cellLv === lv ? [S.cell] : [];
  const k = cells.indexOf(c); if (k >= 0) cells.splice(k, 1); else cells.push(c);
  if (!cells.length){ clearSel(); return; } if (cells.length === 1){ select(lv, cells[0], false); return; }
  cells.sort((a, b) => D.levels[lv].mi[a] - D.levels[lv].mi[b]); selectMany(lv, cells, null, null, null, true); }
function toolsOpen(on){ S.tools = on; $('#toolsbody').hidden = !on; $('#toolstog').setAttribute('aria-expanded', on); }
$('#toolstog').onclick = () => toolsOpen(!S.tools);
toolsOpen(VW() > 860);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.drawing) drawMode(false); if (e.key === 'Escape' && S.picking) pickMode(false); });
{ const mc = map.getContainer(), bd = $('#boxdraw'); let st = null;
  const pt = e => { const r = $('#mapwrap').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  mc.addEventListener('pointerdown', e => { if (!S.drawing || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return; e.preventDefault(); e.stopPropagation();
    st = pt(e); try { mc.setPointerCapture(e.pointerId); } catch (x) {} bd.style.left = st[0] + 'px'; bd.style.top = st[1] + 'px'; bd.style.width = '0px'; bd.style.height = '0px'; bd.hidden = false; $('#maphint').classList.remove('on'); }, true);
  mc.addEventListener('pointermove', e => { if (!st || !e.isPrimary) return; e.preventDefault(); e.stopPropagation(); const p = pt(e);
    bd.style.left = Math.min(st[0], p[0]) + 'px'; bd.style.top = Math.min(st[1], p[1]) + 'px'; bd.style.width = Math.abs(p[0] - st[0]) + 'px'; bd.style.height = Math.abs(p[1] - st[1]) + 'px'; }, true);
  const end = e => { if (!st || !e.isPrimary) return; e.stopPropagation(); const p = pt(e), a = st; st = null; bd.hidden = true; try { mc.releasePointerCapture(e.pointerId); } catch (x) {}
    S.boxAt = Date.now(); if (e.type === 'pointercancel' || Math.abs(p[0] - a[0]) < 8 || Math.abs(p[1] - a[1]) < 8) return;
    const mr = mc.getBoundingClientRect(), wr = $('#mapwrap').getBoundingClientRect(), ox = wr.left - mr.left, oy = wr.top - mr.top;
    finishBox(L.latLngBounds(map.containerPointToLatLng([a[0] + ox, a[1] + oy]), map.containerPointToLatLng([p[0] + ox, p[1] + oy]))); };
  mc.addEventListener('pointerup', end, true); mc.addEventListener('pointercancel', end, true); }
function finishBox(bounds){ const lv = shown, L_ = D.levels[lv], cells = [];
  for (let c = 0; c < L_.id.length; c++) if (inSec(lv, c) && bounds.contains(L_.c[c])) cells.push(c);
  const hint = $('#maphint');
  if (!cells.length){ hint.textContent = 'No cells in that box. Try again.'; hint.classList.add('on'); return; }
  drawMode(false); selectMany(lv, cells, bounds, null); }
function selectMany(lv, cells, bounds, label, within, picked){ S.cell = null; pin.remove(); S.box = {lv, cells, label, within, picked}; $('#clearbtn').hidden = false;
  const rings = cells.map(c => [ring(lv, c)]); selOuter.setLatLngs(rings); selInner.setLatLngs(rings);
  if (bounds) boxRect.setBounds(bounds).addTo(map); else boxRect.remove();
  profile(); writeHash();
  if (isPhone()){ placeProfile(); sheet(S.sheetFull ? 'full' : 'peek'); if (!bounds && !(typeof TOUR !== 'undefined' && TOUR.id)){ $('#mapwrap').scrollIntoView({block:'start'}); showBar(); } } }

/* ---------- trail strip ---------- */
const BIN = 10; let NB = Math.ceil(D.totalMi / BIN);
let stripBins = [];
/* ---------- elevation profile behind the chart ----------
   Smoothed trail elevations every 10 miles, supplied by the National Park Service (ELEVSRC, miles on a 2,190-mile scale,
   fitted here to the dashboard's trail miles). Drawn as a smooth curve behind the bars. Landmark labels sit in a band above the
   chart so they never cover the bars; the most important are placed first and others are left out where they would overlap. */
const ELEVSRC = [[0,3099],[10,2954],[20,3116],[30,3456],[40,3374],[50,3411],[60,3637],[70,3277],[80,4052],[90,4660],[100,4557],[110,4198],[120,4577],[130,4281],[140,3071],[150,3718],[160,3197],[170,2812],[180,4329],[190,4717],[200,6643],[210,5409],[220,5490],[230,5253],[240,2961],[250,3402],[260,3977],[270,3130],[280,2175],[290,2961],[300,3958],[310,3742],[320,3936],[330,4517],[340,3363],[350,2589],[360,3981],[370,3967],[380,6285],[390,5149],[400,3643],[410,3212],[420,3483],[430,2551],[440,2870],[450,3788],[460,3583],[470,3051],[480,2542],[490,3207],[500,4856],[510,4831],[520,3652],[530,3133],[540,3412],[550,2936],[560,2941],[570,2981],[580,3906],[590,2916],[600,2985],[610,2767],[620,2456],[630,3595],[640,2916],[650,2762],[660,3226],[670,3509],[680,2878],[690,2928],[700,2234],[710,2208],[720,2292],[730,2237],[740,1734],[750,2142],[760,2379],[770,1818],[780,3500],[790,2399],[800,1743],[810,1975],[820,2639],[830,3628],[840,2956],[850,2651],[860,2966],[870,2110],[880,2482],[890,2712],[900,2913],[910,2670],[920,2990],[930,3366],[940,3442],[950,3178],[960,2713],[970,2962],[980,1840],[990,1501],[1000,1443],[1010,1001],[1020,1394],[1030,1041],[1040,761],[1050,1319],[1060,1619],[1070,1564],[1080,1354],[1090,1580],[1100,1869],[1110,1378],[1120,993],[1130,783],[1140,510],[1150,1026],[1160,902],[1170,1197],[1180,1353],[1190,987],[1200,1377],[1210,1502],[1220,1523],[1230,1120],[1240,1270],[1250,1501],[1260,1502],[1270,1294],[1280,1511],[1290,1494],[1300,1107],[1310,1197],[1320,1443],[1330,1340],[1340,1458],[1350,1126],[1360,739],[1370,1078],[1380,1134],[1390,1008],[1400,995],[1410,702],[1420,696],[1430,904],[1440,958],[1450,792],[1460,660],[1470,1029],[1480,1058],[1490,1041],[1500,1025],[1510,1009],[1520,992],[1530,976],[1540,1588],[1550,1449],[1560,1878],[1570,1767],[1580,1534],[1590,2648],[1600,1814],[1610,2392],[1620,2663],[1630,3086],[1640,2806],[1650,2239],[1660,2781],[1670,2214],[1680,1921],[1690,1548],[1700,3006],[1710,2030],[1720,2191],[1730,1395],[1740,1254],[1750,903],[1760,1202],[1770,1543],[1780,2383],[1790,1703],[1800,2585],[1810,2988],[1820,2814],[1830,4012],[1840,3643],[1850,2655],[1860,4591],[1870,6288],[1880,3470],[1890,3334],[1900,1773],[1910,2945],[1920,3266],[1930,2656],[1940,2166],[1950,2566],[1960,2559],[1970,2349],[1980,3005],[1990,2832],[2000,3005],[2010,2647],[2020,2156],[2030,1390],[2040,1035],[2050,1493],[2060,1453],[2070,911],[2080,1153],[2090,937],[2100,1970],[2110,1441],[2120,2503],[2130,1377],[2140,643],[2150,599],[2160,927],[2170,1103],[2180,700],[2190,5269]];
const ELEVK = () => D.totalMi / 2190;
let ELEV = null;
/* [file mile, name, kind (s summit, p place, f feature, r river), known feet or null, priority (lower first)] */
const ELEVMARKS = [[0,'Springer Mtn','s',3782,1],[2190,'Katahdin','s',5267,1],[200,'Clingmans Dome','s',6643,2],[1870,'Mt Washington','s',6288,2],
  [1025,'Harpers Ferry','p',null,3],[1408,'Hudson River','r',124,4],[380,'Roan High Knob','s',6285,5],[470,'Damascus','p',null,6],[920,'Shenandoah','f',null,7],
  [274,'Hot Springs','p',null,8],[1295,'Delaware Water Gap','f',null,8],[166,'Fontana Dam','p',null,9],[500,'Grayson Highlands','f',null,10],
  [1585,'Mt Greylock','s',3491,11],[1795,'Mt Moosilauke','s',4802,12],[720,'McAfee Knob','s',3197,12],[1150,'Susquehanna River','r',null,13],
  [2030,'Bigelow Mtn','s',4145,14],[788,'James River','r',null,14],[1750,'Hanover','p',null,15],[1915,'Mahoosuc Notch','f',null,16],[2090,'100-Mile Wilderness','f',null,17]];
const ELEVSTATES = [[78, 'GA', 'NC'], [469, 'TN', 'VA'], [1023, 'VA', 'MD'], [1064, 'MD', 'PA'], [1290, 'PA', 'NJ'], [1361, 'NJ', 'NY'],
  [1459, 'NY', 'CT'], [1510, 'CT', 'MA'], [1600, 'MA', 'VT'], [1744, 'VT', 'NH'], [1910, 'NH', 'ME']];
function elevLoad(){ const k = ELEVK(); ELEV = ELEVSRC.map(([m, f]) => [m * k, f]); strip(); }
const elevAt = mi => { if (!ELEV) return null; for (let i = 0; i < ELEV.length - 1; i++){ const [m0, f0] = ELEV[i], [m1, f1] = ELEV[i + 1]; if (mi <= m1) return f0 + (f1 - f0) * Math.max(0, (mi - m0) / (m1 - m0)); } return ELEV[ELEV.length - 1][1]; };
/* the profile as an SVG area behind the bars (0 to 7,000 ft); with labels set, the landmarks, state lines and scale on top */
/* label width in pixels, measured in the page font (the labels are 10px semibold) */
let ELEVCTX = null;
function elevTextW(t){ try { if (!ELEVCTX){ ELEVCTX = document.createElement('canvas').getContext('2d'); ELEVCTX.font = '600 10px ' + getComputedStyle(document.body).fontFamily; } return ELEVCTX.measureText(t).width; } catch (e){ return t.length * 5.6; } }
function elevSvg(pl, bw, top, base, W, pr, labels){ if (!ELEV) return ''; const pw = W - pl - pr, X = mi => pl + pw * mi / D.totalMi, Y = f => base - (base - top) * Math.min(1, Math.max(0, f) / 7000);
  if (labels === true){ let g = [2000, 4000, 6000].map(f => `<text x="${pl + 3}" y="${(Y(f) + 3).toFixed(1)}" style="font-size:7px" fill="#9FB2C8" stroke="#142235" stroke-width="2" paint-order="stroke">${fmt(f, 0)} ft</text>`).join('');
    const edges = [0, ...ELEVSTATES.map(s => s[0]), D.totalMi], names = [ELEVSTATES[0][1], ...ELEVSTATES.map(s => s[2])];
    ELEVSTATES.forEach(([mi]) => { const x = X(mi).toFixed(1); g += `<line x1="${x}" x2="${x}" y1="${top}" y2="${base}" stroke="#C9D6E3" stroke-opacity=".2" stroke-dasharray="2 3"/>`; });
    names.forEach((nm, i) => { const x0 = X(edges[i]), x1 = X(edges[i + 1]); if (x1 - x0 < 20) return;
      g += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${base - 3}" text-anchor="middle" style="font-size:9px" font-weight="600" fill="#C9D6E3" stroke="#142235" stroke-width="2.2" paint-order="stroke">${nm}</text>`; });
    if (top > 10){ const rows = [[], []], k = ELEVK(), placed = [];
      ELEVMARKS.filter(m => m[4] <= (pw > 1100 ? 14 : pw > 800 ? 10 : 6)).sort((a, b) => a[4] - b[4]).forEach(([fm, name, kind, ft]) => { const mi = fm * k, x = X(mi), txt = name + (ft ? ' ' + fmt(ft, 0) + '′' : ''), w = elevTextW(txt) + 8;
        const anc = x - w / 2 < pl ? 'start' : x + w / 2 > W - pr ? 'end' : 'middle', L0 = anc === 'start' ? x - 4 : anc === 'end' ? x - w + 4 : x - w / 2, R0 = L0 + w;
        const row = rows.findIndex(r => r.every(([a, b]) => R0 + 12 < a || L0 - 12 > b)); if (row < 0) return; rows[row].push([L0, R0]); placed.push([x, mi, kind, txt, anc, row]); });
      placed.forEach(([x, mi, kind, txt, anc, row]) => { const ty = row ? top - 4 : top - 14, py = Y(elevAt(mi)), xs = x.toFixed(1);
        g += (kind === 's' ? `<path d="M${(x - 3.2).toFixed(1)},${(py + 2).toFixed(1)} L${xs},${(py - 3.5).toFixed(1)} L${(x + 3.2).toFixed(1)},${(py + 2).toFixed(1)} Z" fill="#fff" stroke="#142235" stroke-width=".8"/>`
                          : `<circle cx="${xs}" cy="${py.toFixed(1)}" r="2.3" fill="${kind === 'r' ? '#8EC5F0' : '#fff'}" stroke="#142235" stroke-width=".8"/>`) +
          `<line x1="${xs}" x2="${xs}" y1="${ty + 2}" y2="${top}" stroke="#fff" stroke-opacity=".4"/>` +
          `<text x="${xs}" y="${ty}" text-anchor="${anc}" style="font-size:10px" font-weight="600" fill="#fff" stroke="#142235" stroke-width="2.4" paint-order="stroke">${esc(txt).replace(/ ([\d,]+′)$/, '<tspan style="font-size:8px" font-weight="500" fill="#C9D6E3"> $1</tspan>')}</text>`; }); }
    return g; }
  const P = ELEV.map(([mi, f]) => [X(mi), Y(f)]);
  let d = `M${pl},${base} L${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++){ const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${Math.min(base, p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${Math.min(base, p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`; }
  d += ` L${(W - pr).toFixed(1)},${P[P.length - 1][1].toFixed(1)} L${W - pr},${base} Z`;
  if (labels === 'line'){ const dl = 'M' + d.slice(d.indexOf(' L') + 2, d.lastIndexOf(' L'));
    return `<path d="${dl}" fill="none" stroke="#142235" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round" pointer-events="none"/><path d="${dl}" fill="none" stroke="#DCE6F0" stroke-width="1.3" stroke-linejoin="round" pointer-events="none"/>`; }
  let g = `<path d="${d}" fill="#9FB6CF" fill-opacity=".16" stroke="#C9D6E3" stroke-opacity=".6" stroke-width="1.2" stroke-linejoin="round"/>`;
  [2000, 4000, 6000].forEach(f => { g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(f).toFixed(1)}" y2="${Y(f).toFixed(1)}" stroke="#B9CBE0" stroke-opacity=".08"/>`; });
  return g; }
let stripLv = 'wheel';
function strip(){ const m = S.m, lv = stripLv = dispLevel(), L_ = D.levels[lv], svg = $('#stripsvg');
  const W = svg.clientWidth || 800, H = 136, pl = 4, pr = 4, top = ELEV && W > 568 ? 36 : 6, base = 92, pw = W - pl - pr, bw = pw / NB;
  const bins = Array.from({length:NB}, () => ({v:[], clubs:new Map()}));
  for (let c = 0; c < L_.id.length; c++){ const b = bins[Math.min(NB-1, Math.floor(L_.mi[c] / BIN))]; const v = m.get(lv, c);
    b.clubs.set(L_.club[c], (b.clubs.get(L_.club[c]) || 0) + 1); if (m.stripCnt) b.all = (b.all || 0) + m.stripCnt(lv, c, true); if (v != null){ b.v.push(v); if (m.stripCnt) b.cnt = (b.cnt || 0) + m.stripCnt(lv, c); } }
  let mx = 0;
  bins.forEach(b => { if (!b.v.length){ b.val = null; return; }
    if (m.kind === 'cat'){ const cnt = new Map(); b.v.forEach(x => cnt.set(x, (cnt.get(x) || 0) + 1)); b.val = [...cnt].sort((x,y) => y[1] - x[1])[0][0]; }
    else { b.val = b.v.reduce((s,x) => s + x, 0) / b.v.length; mx = Math.max(mx, b.val); }
    b.club = [...b.clubs].sort((x,y) => y[1] - x[1])[0][0]; });
  stripBins = bins; const cntMx = m.stripCnt ? Math.max(1, ...bins.map(b => b.all || 0)) : 0;
  /* the top of the chart: the full range for scores, the index and even percentages; for lopsided measures the 95th-percentile
     stretch, so a few extreme stretches don't flatten the rest (taller bars are drawn to the top and marked) */
  if (m.kind !== 'cat'){ const vs = bins.map(b => b.val).filter(v => v != null).sort((p, q) => p - q), sk = breaks(m, lv).kind;
    const p95 = vs.length ? vs[Math.min(vs.length - 1, Math.floor(.95 * vs.length))] : 0, p90 = vs.length ? vs[Math.min(vs.length - 1, Math.floor(.9 * vs.length))] : 0;
    if (sk === 'score') mx = 100; else if (sk === 'vuln') mx = 1;
    else if (mx > 2 * p90 && p95 > 0) mx = p95;
    else if (m.unit === '%') mx = 100;
    if (m.stripTop) mx = m.stripTop(lv); }
  const x = mi => pl + pw * mi / D.totalMi, rng = secRange();
  /* full bar height: up to the highest point of the elevation profile (its scale tops out at 7,000 ft) */
  const full = ELEV ? (base - top) * Math.min(1, Math.max(...ELEV.map(e => e[1])) / 7000) : base - top;
  let h = '';
  h += elevSvg(pl, bw, top, base, W, pr);
  if (rng) h += `<rect x="${x(rng[0])}" y="${top-4}" width="${Math.max(2, x(rng[1]) - x(rng[0]))}" height="${base - top + 6}" fill="#fff" opacity=".09"/>`;
  h += `<line x1="${pl}" x2="${W-pr}" y1="${base+.5}" y2="${base+.5}" stroke="#4D6079"/>`;
  bins.forEach((b,i) => { if (b.val == null) return; const bx = pl + i*bw;
    const inR = !rng || ((i+1)*BIN > rng[0] && i*BIN < rng[1]);
    const clip = m.kind !== 'cat' && !m.stripCnt && mx && stripV(m, b.val) > mx * 1.001, hh = m.kind === 'cat' ? full : m.stripCnt ? Math.max(1.5, full * Math.sqrt((b.cnt || 0) / cntMx)) : Math.max(1.5, full * (mx ? Math.min(1, stripV(m, b.val) / mx) : 0)), col = m.kind !== 'cat' && m.zero && b.val === 0 ? '#60738B' : colorOf(m, lv, b.val);
    h += `<rect x="${bx}" y="${base-hh}" width="${Math.max(1,bw-.6)}" height="${hh}" fill="${col}" opacity="${inR ? 1 : .3}" stroke="#fff" stroke-opacity=".22" stroke-width=".5"/>` +
      (clip ? `<path d="M${bx + bw / 2 - Math.min(3.5, bw / 2)} ${base - full} L${bx + bw / 2} ${base - full - 5} L${bx + bw / 2 + Math.min(3.5, bw / 2)} ${base - full} Z" fill="#fff" opacity="${inR ? .9 : .3}"/>` : ''); });
  h += elevSvg(pl, bw, top, base, W, pr, 'line') + elevSvg(pl, bw, top, base, W, pr, true);
  h += `<rect id="vwin" x="0" y="${top-4}" width="0" height="${base-top+6}" fill="none" stroke="#fff" stroke-width="1.5" rx="2"/>`;
  h += `<rect id="shover" x="0" y="${top-4}" width="${bw}" height="${base-top+6}" fill="#fff" opacity="0"/>`;
  D.regions.forEach((r,i) => { const x0 = x(r[1]), x1 = x(r[2]);
    h += `<line x1="${x0+.5}" x2="${x0+.5}" y1="${base}" y2="${base+22}" stroke="#4D6079"/>`;
    if (x1 - x0 > 70) h += `<text class="reg" x="${x0+6}" y="${base+16}">${esc(r[0])}</text>`; });
  h += `<line x1="${W-pr-.5}" x2="${W-pr-.5}" y1="${base}" y2="${base+22}" stroke="#4D6079"/>`;
  const wide = W > 520;
  h += `<text class="end" x="${pl}" y="${H-4}">${wide ? 'Springer Mountain, Georgia' : 'Georgia'}</text><text class="end" x="${W-pr}" y="${H-4}" text-anchor="end">${wide ? 'Katahdin, Maine' : 'Maine'}</text>`;
  const endL = wide ? 215 : 70, endR = wide ? 135 : 55; /* room taken by the end labels */
  if (W > 620) [500,1000,1500].filter(mi => x(mi) - 32 > pl + endL && x(mi) + 32 < W - pr - endR).forEach(mi => { h += `<text x="${x(mi)}" y="${H-4}" text-anchor="middle">mile ${fmt(mi,0)}</text><line x1="${x(mi)}" x2="${x(mi)}" y1="${base}" y2="${base+4}" stroke="#71849B"/>`; });
  svg.setAttribute('viewBox', `0 0 ${W} ${document.body.classList.contains('stackui') ? 94 : H}`); svg.style.height = document.body.classList.contains('stackui') ? '94px' : ''; svg.innerHTML = h;
  svg._geo = {pl, pw, bw};
  $('#striptitle').textContent = `${m.label}, south to north (${LV[lv].name} cells)`;
  $('#stripread').textContent = 'Click to go there';
  viewWindow(); }
function binAt(e){ const svg = $('#stripsvg'), r = svg.getBoundingClientRect(), g = svg._geo; if (!g) return -1;
  const px = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width); return Math.max(0, Math.min(NB-1, Math.floor((px - g.pl) / g.bw))); }
$('#stripsvg').addEventListener('pointermove', e => { const i = binAt(e); if (i < 0) return; const b = stripBins[i], g = $('#stripsvg')._geo, hv = $('#shover');
  hv.setAttribute('x', g.pl + i*g.bw); hv.setAttribute('opacity', .16);
  const where = `Miles ${fmt(i*BIN,0)} to ${fmt(Math.min(D.totalMi,(i+1)*BIN),0)}`;
  const club = b.club != null ? ', ' + shortClub(cat('club', b.club) || '') : '';
  let txt = S.m.find ? 'not recorded' : (S.m.none ? S.m.none.toLowerCase().replace('nps - appa', 'NPS - APPA') : 'no data'); if (b.val != null) txt = S.m.find ? 'recorded in this stretch' : S.m.yn ? S.m.yn + ' in this stretch' : S.m.kind === 'cat' ? 'mostly ' + show(S.m, b.val) : (S.m.unit === '%' ? fmt(b.val, 1) + '%' : fmt(b.val, b.val < 10 ? 1 : 0)) + ` on average per ${LV[stripLv].name} cell`;
  $('#stripread').textContent = `${where}${club}: ${txt}` + (ELEV ? `; trail about ${fmt(Math.round(elevAt((i + .5) * BIN) / 100) * 100, 0)} ft` : ''); });
$('#stripsvg').addEventListener('pointerleave', () => { $('#shover').setAttribute('opacity', 0); });
$('#stripsvg').addEventListener('click', e => { const i = binAt(e); if (i < 0) return; const L_ = D.levels.wheel, pts = [];
  for (let c = 0; c < L_.id.length; c++) if (L_.mi[c] >= i*BIN - BIN && L_.mi[c] < (i+2)*BIN) pts.push(L_.c[c]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(.15)); });
function viewWindow(){ const w = $('#vwin'), svg = $('#stripsvg'); if (!w || !svg._geo) return; const L_ = D.levels.wheel, bd = map.getBounds().pad(-.02); let lo = Infinity, hi = -Infinity;
  for (let c = 0; c < L_.id.length; c++) if (bd.contains(L_.c[c])){ lo = Math.min(lo, L_.mi[c]); hi = Math.max(hi, L_.mi[c]); }
  const g = svg._geo; if (lo === Infinity || (hi - lo) > D.totalMi * .93){ w.setAttribute('width', 0); return; }
  const x0 = g.pl + g.pw * lo / D.totalMi, x1 = g.pl + g.pw * hi / D.totalMi; w.setAttribute('x', x0 - 1); w.setAttribute('width', Math.max(4, x1 - x0 + 2)); }
/* Phones: browsers resize the window as their address bar slides in and out while you scroll. The map's height is set once, in pixels,
   and only recalculated when the screen width changes (a rotation), so the map block stays the same size while scrolling. */
let lockW = 0;
function lockMapHeight(){ const mw = $('#mapwrap'); if (document.body.classList.contains('stackui')){ if (mw.style.height) mw.style.height = ''; map.invalidateSize(); return; } if (document.body.classList.contains('touring') && VW() <= 860) return; if (VW() > 860){ if (mw.style.height){ mw.style.height = ''; lockW = 0; map.invalidateSize(); } return; }
  if (VW() === lockW) return; lockW = VW(); mw.style.height = Math.max(360, Math.round(VH() * .62)) + 'px'; map.invalidateSize(); }
lockMapHeight();
let rz, rzW = VW(); window.addEventListener('resize', () => { lockMapHeight(); clearTimeout(rz); rz = setTimeout(() => { const wChanged = VW() !== rzW; rzW = VW(); if (wChanged || VW() > 860){ strip(); map.invalidateSize(); } }, 150); });

/* ---------- about ---------- */
$('#aboutbtn').onclick = () => $('#about').showModal();
/* citation: the accessed date is the reader's own date */
$('#citedate').textContent = new Date().toLocaleDateString('en-US', {day:'numeric', month:'long', year:'numeric'});
$('#citecopy').onclick = () => { const t = $('#citetext').textContent.replace(/\s+/g, ' ').trim(), say = x => { $('#citemsg').textContent = x; setTimeout(() => $('#citemsg').textContent = '', 2500); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => say('Copied'), () => say('Select the text to copy it'));
  else say('Select the text to copy it'); };
$('#aboutclose').onclick = () => $('#about').close();
$('#about').addEventListener('click', e => { if (e.target === $('#about')) $('#about').close(); });

/* ---------- start ---------- */
if (isPhone()) trailMid(); else map.fitBounds(L.latLngBounds(D.levels.wheel.c).pad(.03)); baseSync();
/* phones: the page settles (address bar, fonts, panel) after the first draw, so center again until the person moves the map */
{ let moved = false; map.once('dragstart zoomstart', e => { if (e && e.originalEvent !== undefined) moved = true; }); map.getContainer().addEventListener('touchstart', () => { moved = true; }, {once:true, passive:true});
  const again = () => { if (moved || !isPhone() || S.sec !== 'all' || S.cell != null || (typeof TOUR !== 'undefined' && TOUR.id)) return; map.invalidateSize({pan:false}); trailMid(); };
  [300, 900, 2000, 3500].forEach(t => setTimeout(again, t)); if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(again, 150)); } mapGestures();
if (S.sec !== 'all') fitSection();
/* ---------- quarterly iNaturalist and eBird summaries from inat_ebird.json ----------
   Built on GitHub from GBIF downloads (build_inat_ebird.py). When the file is there, its summaries replace the ones built into
   this page; species strings are merged into D.spp and cells are matched by grid ID. Applied once the corridor cells are shown. */
var BIO = null;   // var: draw() may run before this line
/* geology.json and geology_huc10.json, built on GitHub (build_geology.py): cells matched by grid ID */
var GEO = null; const GEOHUC = 'data/geology_huc10.json';
var WX = null; const WXHUC = 'data/weather_huc10.json';
var TSL = null; const TSLHUC = 'data/trail_slope_huc10.json';
function tslApply(){ const j = TSL; if (!j || j.done || S.ext !== 'corr') return; j.done = true; D.themes.slope = thConv(j, 'slope', D.levels); extIndex(); }
fetch('data/trail_slope.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ TSL = j; if (S.ext === 'corr'){ tslApply(); redraw(); } } }).catch(() => {});
function thConv(j, th, levels){ const out = {}, src = j.themes[th] || {};
  for (const lv in src){ if (!levels[lv]) continue; const m = new Map(); levels[lv].id.forEach((id, i) => m.set(id, i)); const t = src[lv], keep = [], ix = [];
    t.ids.forEach((id, k) => { const c = m.get(id); if (c != null){ keep.push(k); ix.push(c); } });
    const f = {}; for (const name in t.f) f[name] = keep.map(k => t.f[name][k]); out[lv] = {ix, f}; }
  return out; }
function wxApply(){ const j = WX; if (!j || j.done || S.ext !== 'corr') return; j.done = true; WXMETA = j.meta || {}; for (const k in WXB) delete WXB[k]; D.themes.wx = thConv(j, 'wx', D.levels); extIndex(); }
fetch('data/weather.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ WX = j; if (S.ext === 'corr'){ wxApply(); redraw(); } } }).catch(() => {});
function geoTables(j){ if (!GEOT) GEOT = {maps:j.maps || [], units:(j.units || []).map(u => { if (!Array.isArray(u)) return u; u = u.slice(); const nm = String(u[0] || '').replace(/\s+/g, ' ').trim(), w = /^water$/i.test(nm); u[0] = w ? 'Open water' : nm; if (w) u[2] = u[2] || 'Not a bedrock unit'; u[1] = w ? '' : String(u[1] || '').replace(/;\d+$/, '').trim(); return u; }), meta:j.meta || {}};
  ['GEO_LITH','GEO_AGE','MAP_BEST','SURF','GIS_BEST'].forEach(k => { if (j.cats && j.cats[k] && j.cats[k].join('|') !== D.cats[k].join('|')) console.warn('geology categories differ from the page:', k); }); }
function geoConv(j, levels){ const out = {}, src = j.themes.geo || {};
  for (const lv in src){ if (!levels[lv]) continue; const m = new Map(); levels[lv].id.forEach((id, i) => m.set(id, i)); const t = src[lv], keep = [], ix = [];
    t.ids.forEach((id, k) => { const c = m.get(id); if (c != null){ keep.push(k); ix.push(c); } });
    const f = {}; for (const name in t.f) f[name] = keep.map(k => t.f[name][k]); out[lv] = {ix, f}; }
  return out; }
function geoApply(){ const j = GEO; if (!j || j.done || S.ext !== 'corr') return; j.done = true; geoTables(j); D.themes.geo = geoConv(j, D.levels); extIndex(); }
fetch('data/geology.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ GEO = j; if (S.ext === 'corr'){ geoApply(); redraw(); } } }).catch(() => {});
fetch('data/inat_ebird.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.themes){ BIO = j; if (S.ext === 'corr'){ bioApply(); redraw(); } } }).catch(() => {});
/* the file's cells matched to a set of grid levels by ID (idx: level -> Map(id -> cell)); species merged into D.spp */
function bioConv(j, idx){ const si = new Map(D.spp.map((s, i) => [s, i])), sp = i => { const s = j.spp[i]; let k = si.get(s); if (k == null){ k = D.spp.length; D.spp.push(s); si.set(s, k); } return k; };
  const ds = (j.cats && j.cats.DATA_STATUS || []).map(x => { let k = D.cats.DATA_STATUS.indexOf(x); if (k < 0){ k = D.cats.DATA_STATUS.length; D.cats.DATA_STATUS.push(x); } return k; });
  const themes = {};
  for (const th of ['inat', 'ebird', 'edd', 'vis']){ const src = j.themes[th]; if (!src) continue; const out = {};
    for (const lv in src){ if (!idx[lv]) continue; const t = src[lv], keep = [], ix = [];
      t.ids.forEach((id, k) => { const c = idx[lv].get(id); if (c != null){ keep.push(k); ix.push(c); } });
      const f = {};
      for (const name in t.f){ const col = t.f[name];
        f[name] = keep.map(k => { const x = col[k]; if (name === 'DATA_STATUS') return x == null ? null : ds[x];
          if (name.endsWith('_LIST') || name === 'TOP10_SPECIES') return (x || []).map(sp); if (name === 'EDD_SPP_DETAIL') return (x || []).map(r => [sp(r[0]), ...r.slice(1)]); return x; }); }
      out[lv] = {ix, f}; }
    themes[th] = out; }
  return themes; }
/* the watershed (HUC10) summaries, inat_ebird_huc10.json, loaded with the watershed cells */
const BIOHUC = 'data/inat_ebird_huc10.json.gz';
function bioHuc(j, H){ const idx = {}; for (const lv in H.levels){ const m = new Map(); H.levels[lv].id.forEach((id, i) => m.set(id, i)); idx[lv] = m; }
  Object.assign(H.themes, bioConv(j, idx)); H.bio = j.run || true; INATFLAGS = null; }
function bioApply(){ const j = BIO; if (!j || j.done || S.ext !== 'corr') return; j.done = true;
  Object.assign(D.themes, bioConv(j, IDX));
  if (j.run) D.run = j.run; document.querySelectorAll('.run').forEach(e => e.textContent = D.run);
  const m = j.meta || {}, dl = document.getElementById('biodl');
  if (dl && m.inat || dl && m.ebird) dl.hidden = false;
  if (dl) dl.innerHTML = '<b>Quarterly downloads.</b> GBIF.org occurrence downloads: ' + ['inat', 'ebird'].filter(k => m[k] && m[k].doi).map(k => `${k === 'inat' ? 'iNaturalist' : 'eBird'} ${esc(m[k].built || '')}, <a href="https://doi.org/${esc(m[k].doi)}" target="_blank" rel="noopener">doi.org/${esc(m[k].doi)}</a>`).join('; ') + '.' +
    (m.edd ? ` EDDMapS invasive species points ${esc(m.edd.built || '')}, from <a href="https://www.eddmaps.org/" target="_blank" rel="noopener">EDDMapS</a> (University of Georgia Center for Invasive Species and Ecosystem Health).` : '');
  if (m.edd && m.edd.built){ const d = new Date(m.edd.built + 'T12:00:00Z'), a = document.getElementById('eddacc'), yy = document.getElementById('eddyr');
    if (!isNaN(d)){ if (a) a.textContent = d.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric', timeZone:'UTC'}); if (yy) yy.textContent = d.getUTCFullYear(); } }
  extIndex(); FIDX = null; for (const k in RESTC) delete RESTC[k]; }
draw(); strip(); elevLoad();
if (S.pendingLayers) S.pendingLayers.forEach(id => { const l = LIVE.find(x => x.id === id), cb = document.querySelector('#layerspanel [data-live="' + id + '"]'); if (l && cb){ cb.checked = true; liveToggle(l, true); } });
if (S.pendingFind){ const e = findIndex().get(S.pendingFind); if (e) setFind(e, false); }
if (S.cell != null) select(S.cellLv, S.cell, true);
if (S.pendingExt === 'huc' && EXTQ.includes(S.q.id) && !EXTNO.includes(S.q.id)) setExt('huc');

/* Map layers gets its own spot: under the locate button on desktop; on phones in the top row, between Map options and locate,
   with the section picker narrowed so the row fits on one line */
{ const ly = $('#layers'), wrap = $('#mapwrap');
  if (ly && wrap){ wrap.appendChild(ly); ly.classList.add('laydock');
    const place = () => { const loc = document.querySelector('.leaflet-top.leaflet-right .leaflet-control'); if (!loc) return;
      const w = wrap.getBoundingClientRect(), r = loc.getBoundingClientRect(), phone = document.body.classList.contains('stackui'), c = $('#ctls'), sec = $('#section');
      if (typeof layersUI === 'function') layersUI();
      ctlAcross(phone); if (window.lvPlace) lvPlace();
      if (phone && document.body.classList.contains('ctlopen')) return;   /* Options open: leave the row as it is */
      if (phone){ ly.style.top = (r.top - w.top) + 'px'; ly.style.right = (w.right - r.left + 6) + 'px'; ly.style.height = r.height + 'px';
        const cr = w.right - r.left + 6 + ly.offsetWidth + 6; if (c) c.style.setProperty('right', cr + 'px', 'important');
        if (sec && c){ const cb = $('#ctlbtn') || c, sw = Math.max(70, Math.round(cb.getBoundingClientRect().left - sec.getBoundingClientRect().left - 6)); sec.style.setProperty('width', sw + 'px', 'important'); sec.style.setProperty('max-width', sw + 'px', 'important'); } }
      else { const pf = $('#profile'), po = pf && pf.classList.contains('open') && pf.offsetParent ? pf.getBoundingClientRect() : null;
        if (po && po.left < r.right){ ly.style.top = (po.top - w.top) + 'px'; ly.style.right = (w.right - po.left + 8) + 'px'; }
        else { ly.style.top = (r.top - w.top) + 'px'; ly.style.right = (w.right - r.left + 8) + 'px'; }   /* beside the locate button */
        ly.style.height = po && po.left < r.right ? '' : r.height + 'px';
        if (c) c.style.removeProperty('right'); if (sec){ sec.style.removeProperty('width'); sec.style.removeProperty('max-width'); } } };
    /* phones: the Options controls open in rows across the map's width, under the top row */
    function ctlAcross(phone){ const c = $('#ctls'), rows = ['#ctlrow1', '#ctlrow2', '#note'].map(q => $(q)).filter(Boolean), open = phone && document.body.classList.contains('ctlopen');
      rows.forEach(r => ['position', 'left', 'width', 'max-width', 'top', 'justify-content', 'flex-wrap'].forEach(k => r.style.removeProperty(k)));
      if (!open || !c) return; rows.forEach(r => r.style.setProperty('position', 'absolute', 'important'));
      const w = wrap.getBoundingClientRect(), cr = c.getBoundingClientRect(), btn = $('#ctlbtn'), br = btn ? btn.getBoundingClientRect() : cr; let y = (btn ? btn.offsetHeight : 34) + 6;
      rows.forEach(r => { if (r.hidden || !r.offsetHeight) return; r.style.setProperty('max-width', (w.width - 20) + 'px', 'important'); r.style.setProperty('width', 'max-content', 'important'); r.style.setProperty('flex-wrap', 'wrap', 'important'); r.style.setProperty('justify-content', 'flex-start', 'important');
        const rw = r.offsetWidth, x = Math.max(w.left + 10, Math.min(br.left, w.right - 10 - rw)); r.style.setProperty('left', (x - cr.left) + 'px', 'important'); r.style.setProperty('top', y + 'px', 'important'); y += r.offsetHeight + 6; }); }
    { const r1 = $('#ctlrow1'); let h1 = 0, w1 = 0; if (r1 && window.ResizeObserver) new ResizeObserver(() => { if (r1.offsetHeight !== h1){ h1 = r1.offsetHeight; ctlAcross(document.body.classList.contains('stackui')); }
      if (r1.offsetWidth !== w1){ w1 = r1.offsetWidth; } }).observe(r1); }
    /* cell size and basemap: two drop-downs of the same size side by side, beside the zoom-out button (phones: under the top row) */
    const lvEl = $('#levels'), bsEl = $('#base'), bar = document.createElement('div'); bar.id = 'lvbar'; wrap.appendChild(bar);
    if (lvEl){ bar.appendChild(lvEl); lvEl.classList.add('lvdock'); } if (bsEl){ bar.appendChild(bsEl); bsEl.classList.add('bsdock'); }
    const lvHead = () => { const t = $('#levels .lvt'); if (!t) return; const lv = typeof dispLevel === 'function' ? dispLevel() : null, nm = {wheel:'49', cog:'7', hex:'1'}[lv] || '';
      const ac = {wheel:'31,360', cog:'4,480', hex:'640'}[lv] || '';   /* acres in one cell: 640 per square mile */
      t.innerHTML = esc((S.level === 'auto' ? 'Auto' + (nm ? ' · ' + nm : '') : nm) + ' sq mi') + (ac ? `<span class="lvac"> · ${ac} ac</span>` : ''); };
    window.lvHead = lvHead; { const r1 = redraw; redraw = function(){ r1(); lvHead(); }; } map.on('zoomend', () => setTimeout(lvHead, 0));
    const lvPlace = () => { const w = wrap.getBoundingClientRect(), z = document.querySelector('.leaflet-control-zoom'), zr = z && z.offsetParent ? z.getBoundingClientRect() : null;
      let top, left; if (zr && zr.height){ const mi = z.querySelector('.leaflet-control-zoom-out'), mr = mi ? mi.getBoundingClientRect() : zr;   /* beside the zoom-out button */
        const tb = $('#tools'), tbr = tb && tb.offsetParent ? tb.getBoundingClientRect() : null;   /* left edge lined up with the Map tools box above */
        top = mr.top - w.top + (mr.height - barH()) / 2; left = (tbr ? tbr.left : zr.right + 8) - w.left; }
      else { const sec = $('#section'), sr = sec && sec.offsetParent ? sec.getBoundingClientRect() : null; top = (sr ? sr.bottom - w.top : 50) + 8; left = 10; }
      bar.style.top = Math.round(top) + 'px'; bar.style.left = Math.round(left) + 'px'; lvHead();
      justify(zr && zr.height && !document.body.classList.contains('stackui'));
      if (typeof phTickPos === 'function') phTickPos();
      document.documentElement.style.setProperty('--levb', Math.round(top + barH() + 18) + 'px'); };
    /* the bar's closed height: the Cells and Basemap boxes, without the open list */
    function barH(){ const h = lvEl && lvEl.querySelector('.lvh'), a = h ? h.offsetHeight + 8 : 0, b = bsEl ? bsEl.offsetHeight : 0; return Math.max(a, b, 33); }
    /* one right edge for the two control bars (desktop). The Map tools box is sized for its open state with "Clear selection"
       showing, so opening, closing or selecting changes nothing; Basemap fills the Cells + Basemap bar out to the same edge. */
    function toolsMaxW(){ const tl = $('#tools'); if (!tl) return 0; const hid = [...tl.querySelectorAll('[hidden]')], mw = tl.style.minWidth;
      tl.style.minWidth = ''; hid.forEach(x => { x.hidden = false; }); const w = tl.getBoundingClientRect().width; hid.forEach(x => { x.hidden = true; }); tl.style.minWidth = mw; return w; }
    function justify(wide){ const tl = $('#tools');
      if (!wide || !tl || !bsEl || !lvEl){ if (tl) tl.style.removeProperty('min-width'); if (bsEl) bsEl.style.removeProperty('width'); return; }
      const tr = tl.getBoundingClientRect(), lr = lvEl.getBoundingClientRect(), ly = $('#layers'), cap = ly && ly.offsetParent ? ly.getBoundingClientRect().left - 10 : Infinity;
      const edge = Math.min(cap, Math.max(tr.left + toolsMaxW(), lr.right + 6 + 190));
      tl.style.minWidth = Math.max(0, Math.round(edge - tr.left)) + 'px';
      bsEl.style.width = Math.max(150, Math.round(edge - (lr.right + 6))) + 'px'; }
    window.lvPlace = lvPlace; addEventListener('resize', () => setTimeout(lvPlace, 70)); setTimeout(lvPlace, 0); setTimeout(lvPlace, 700);
    /* (the bar's offset for the legend is set by lvPlace from its closed height, so opening the list moves nothing) */
    document.addEventListener('click', e => { if (lvEl && lvEl.classList.contains('open') && !e.target.closest('#levels')){ lvEl.classList.remove('open'); $('#levels .lvh').setAttribute('aria-expanded', 'false'); } });
    window.layersPlace = place;
    ly.addEventListener('click', e => { if (!e.target.closest('#layerstog')) return; const pn = $('#layerspanel'); if (document.body.classList.contains('stackui')) pn.style.top = Math.round(ly.getBoundingClientRect().bottom + 6) + 'px'; else pn.style.top = ''; });
    addEventListener('resize', () => setTimeout(place, 60)); addEventListener('load', () => setTimeout(place, 50)); setTimeout(place, 0); setTimeout(place, 600);
    const pr = $('#profile'); if (pr) new MutationObserver(() => { setTimeout(place, 30); setTimeout(() => window.lvPlace && window.lvPlace(), 60); }).observe(pr, {attributes:true, attributeFilter:['class']});
    new MutationObserver(() => setTimeout(place, 30)).observe(document.body, {attributes:true, attributeFilter:['class']});
    document.addEventListener('click', e => { const p = $('#layerspanel'); if (p && !p.hidden && !e.target.closest('#layers')){ p.hidden = true; $('#layerstog').setAttribute('aria-expanded', 'false'); } }); } }

/* iPhone and iPad: stop the automatic zoom when a search box or drop-down is tapped (pinch zoom still works on iOS) */
{ const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), vm = document.querySelector('meta[name=viewport]');
  if (ios && vm && !/maximum-scale/.test(vm.content)) vm.content += ', maximum-scale=1'; }

/* ---------- Save for offline: data files, imagery tiles along the trail, and the trail line, mile points and point layers ---------- */
{ const OFFC = 'atoffline-1', OKEY = 'atgrid_offline', btn = $('#offsave'), del = $('#offdel'), st = $('#offstat'), bar = $('#offbar');
  const offInfo = () => { try { return JSON.parse(localStorage.getItem(OKEY) || 'null'); } catch (e){ return null; } };
  const mb = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.round(n / 1e6) + ' MB';
  const offShow = async () => { const o = offInfo(); del.hidden = !o; btn.textContent = o ? 'Update offline copy' : 'Save for offline';
    if (o){ let used = ''; try { const e = await navigator.storage.estimate(); used = ' · ' + mb(e.usage) + ' stored on this device'; } catch (x) {}
      st.textContent = `Saved ${new Date(o.t).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}: ${fmt(o.files, 0)} data files and ${fmt(o.tiles, 0)} imagery tiles${o.miss ? ` (${fmt(o.miss, 0)} could not be saved)` : ''}${used}.`; } };
  const tiles = () => { const C = D.levels.hex.c, out = new Set();
    const T = (la, lo, z) => { const n = 2 ** z, r = la * Math.PI / 180; return [Math.floor((lo + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
    for (let z = 5; z <= 14; z++){ const rad = z >= 9 ? 1 : 0; for (const [la, lo] of C){ const [x, y] = T(la, lo, z); for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) out.add(TNM + 'USGSImageryOnly/MapServer/tile/' + z + '/' + (y + dy) + '/' + (x + dx)); } }
    return [...out]; };
  const files = async () => { try { const r = await fetch('https://api.github.com/repos/Creese333/AT-Resource-Grid/git/trees/main?recursive=1'); const j = await r.json();
      const f = (j.tree || []).filter(t => t.type === 'blob' && /^(data|images)\//.test(t.path)).map(t => t.path); if (f.length) return f; } catch (e) {}
    return [...new Set(performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => u.origin === location.origin && /^\/(data|images)\//.test(u.pathname)).map(u => u.pathname.slice(1)))]; };
  let busy = false;
  btn.onclick = async () => { if (busy) return; if (!('caches' in window)){ st.textContent = 'This browser cannot save the dashboard for offline use.'; return; }
    busy = true; btn.disabled = true; bar.hidden = false; const fill = bar.querySelector('i'); st.textContent = 'Getting the list of files…';
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const c = await caches.open(OFFC), F = await files(), Tl = tiles(), jobs = F.map(p => ({u:p, data:1})).concat(Tl.map(u => ({u})));
      let done = 0, miss = 0, nf = 0, nt = 0, i = 0; const total = jobs.length;
      const one = async j => { try { if (j.data){ const r = await fetch(j.u, {cache:'no-cache'}); if (!r.ok) throw 0; await c.put(j.u, r); nf++; }
          else { if (await c.match(j.u)){ nt++; return; } let r; try { r = await fetch(j.u, {mode:'cors'}); if (!r.ok) throw 0; } catch (e){ r = await fetch(j.u, {mode:'no-cors'}); } await c.put(j.u, r); nt++; } }
        catch (e){ miss++; } finally { done++; if (done % 20 === 0 || done === total){ fill.style.width = (done / total * 100).toFixed(1) + '%'; st.textContent = `Saving ${fmt(done, 0)} of ${fmt(total, 0)}…`; } } };
      const worker = async () => { while (i < jobs.length) await one(jobs[i++]); };
      /* the trail line, mile points and point layers go through the app's own requests, so the offline copy matches exactly */
      const live = Promise.allSettled([arcQuery(SVC + 'ANST_Centerline/FeatureServer/0', {outFields:'OBJECTID', maxAllowableOffset:'0.0003', geometryPrecision:5}), typeof milePts === 'function' ? milePts() : null]
        .concat(LIVE.filter(l => l.type === 'pt' && !l.local && !l.bbox).map(l => Promise.all([arcQuery(l.url, {outFields:'*', geometryPrecision:6}), (l.meta = null, arcMeta(l))]))));
      await Promise.all(Array.from({length:6}, worker)); await live;
      localStorage.setItem(OKEY, JSON.stringify({t:Date.now(), files:nf, tiles:nt, miss}));
      fill.style.width = '100%'; await offShow(); if (!navigator.serviceWorker || !navigator.serviceWorker.controller) st.textContent += ' Close and reopen the app once so it can use the saved copy.';
    } catch (e){ st.textContent = 'Saving stopped: ' + (e && e.name === 'QuotaExceededError' ? 'this device does not have enough free space.' : 'the connection dropped. Tap the button again to finish; files already saved are kept.'); }
    busy = false; btn.disabled = false; setTimeout(() => { bar.hidden = true; }, 1500); };
  del.onclick = async () => { await caches.delete(OFFC); await caches.delete('atlive-1'); try { localStorage.removeItem(OKEY); } catch (e) {} st.textContent = 'The offline copy was removed.'; del.hidden = true; btn.textContent = 'Save for offline'; };
  offShow();
  /* with no signal, imagery layers stop asking for sharper images than the saved trail-level tiles, and stretch those instead */
  const offBase = () => { const off = !navigator.onLine; BASEDEF.forEach(b => { const l = b[2]; if (l instanceof ImgLayer) l.offline(off); }); };
  addEventListener('online', offBase); addEventListener('offline', offBase); if (!navigator.onLine) offBase(); }

/* the loading screen goes once the map is drawn */
{ const sp = document.getElementById('splash'); const go = () => { if (!sp || sp.dataset.gone) return; sp.dataset.gone = 1; const b = sp.querySelector('.spblaze'); if (b) b.style.setProperty('--p', 1);   /* finish painting the blaze, then fade */
    setTimeout(() => { sp.style.opacity = 0; setTimeout(() => sp.remove(), 300); }, b ? 450 : 0); };
  /* on long enough to read: at least 1.2 s from launch and 0.5 s after the map is ready */ requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, Math.max(500, 1200 - performance.now())))); setTimeout(go, 6000); }
/* a newer version was found in the background. If the page has only just opened and nothing has been touched yet, load it right away
   (once; a second notice within a minute only offers it); otherwise offer a reload */
let upTouched = false; ['pointerdown', 'keydown', 'wheel'].forEach(t => addEventListener(t, () => { upTouched = true; }, {once:true, passive:true, capture:true}));
if (!window.__updH && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (!e.data || e.data.type !== 'updated' || $('#updtoast')) return;   /* the split page's loader handles this itself, from the first moment */
  let last = 0; try { last = +sessionStorage.getItem('atgrid_autoreload') || 0; } catch (x) {}
  if (!upTouched && performance.now() < 20000 && Date.now() - last > 60000){ try { sessionStorage.setItem('atgrid_autoreload', Date.now()); } catch (x) {} location.reload(); return; }
  { var t = document.createElement('div'); t.id = 'updtoast'; t.setAttribute('role', 'alertdialog'); t.setAttribute('aria-label', 'A new version is ready');
      t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3000;width:min(320px,calc(100vw - 40px));box-sizing:border-box;background:#142235;border:2px solid #05D16D;border-radius:14px;padding:18px 18px 14px;text-align:center;font:inherit;box-shadow:0 12px 40px rgba(0,0,0,.6)';
      t.innerHTML = '<div style="color:#05D16D;font-weight:700;font-size:17px;line-height:1.3;margin-bottom:12px">A new version is ready</div>' +
        '<button type="button" data-upd="go" style="display:block;width:100%;background:#05D16D;color:#0F1C2E;border:0;border-radius:999px;padding:11px 16px;font:inherit;font-size:16px;font-weight:700;cursor:pointer">Tap to reload</button>' +
        '<button type="button" data-upd="later" style="margin-top:8px;background:none;border:0;color:#9FB2C8;font:inherit;font-size:14px;padding:6px 10px;cursor:pointer">Later</button>';
      t.addEventListener('click', function(ev){ var b = ev.target.closest('[data-upd]'); if (!b) return; if (b.dataset.upd === 'go') location.reload(); else t.remove(); });
      document.body.appendChild(t); t.querySelector('[data-upd=go]').focus({preventScroll:true}); } });
})();
