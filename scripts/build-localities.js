// Builds src/data/wa-localities.json from the community postcode list:
//   https://github.com/matthewproctor/australianpostcodes (australian_postcodes.csv)
//
//   node scripts/build-localities.js path/to/australian_postcodes.csv
//
// Each WA suburb or town is tagged with the nearest area (see ANCHORS) by distance, because the
// council column in that file isn't reliable. Customers can still correct the area on the job form.

const fs = require('fs');
const path = require('path');

const ANCHORS = {
  cbd: ['PERTH', 'NORTHBRIDGE', 'EAST PERTH', 'WEST PERTH', 'LEEDERVILLE', 'MOUNT LAWLEY', 'HIGHGATE', 'SUBIACO', 'VICTORIA PARK', 'SOUTH PERTH', 'NORTH PERTH', 'MAYLANDS'],
  western: ['COTTESLOE', 'CLAREMONT', 'NEDLANDS', 'MOSMAN PARK', 'CITY BEACH', 'FLOREAT', 'DALKEITH', 'SWANBOURNE', 'WEMBLEY', 'CHURCHLANDS'],
  northern: ['JOONDALUP', 'SCARBOROUGH', 'KARRINYUP', 'WANNEROO', 'CLARKSON', 'HILLARYS', 'DUNCRAIG', 'BUTLER', 'YANCHEP', 'TWO ROCKS', 'MIRRABOOKA', 'BALCATTA', 'OSBORNE PARK', 'GIRRAWHEEN', 'ALEXANDER HEIGHTS'],
  'north-east': ['MIDLAND', 'ELLENBROOK', 'BASSENDEAN', 'GUILDFORD', 'MORLEY', 'BAYSWATER', 'BEECHBORO', 'THE VINES', 'BULLSBROOK', 'BALLAJURA', 'HERNE HILL'],
  eastern: ['KALAMUNDA', 'MUNDARING', 'FORRESTFIELD', 'LESMURDIE', 'MAIDA VALE', 'HIGH WYCOMBE', 'DARLINGTON', 'GOOSEBERRY HILL', 'SAWYERS VALLEY', 'GIDGEGANNUP', 'CHIDLOW'],
  'south-east': ['ARMADALE', 'GOSNELLS', 'CANNING VALE', 'THORNLIE', 'BYFORD', 'KELMSCOTT', 'HARRISDALE', 'PIARA WATERS', 'MADDINGTON', 'CANNINGTON', 'SERPENTINE', 'MUNDIJONG'],
  southern: ['WILLETTON', 'APPLECROSS', 'BOORAGOON', 'BULL CREEK', 'MURDOCH', 'COCKBURN CENTRAL', 'SUCCESS', 'ATWELL', 'RIVERTON', 'BATEMAN', 'LEEMING', 'JANDAKOT'],
  fremantle: ['FREMANTLE', 'EAST FREMANTLE', 'SOUTH FREMANTLE', 'NORTH FREMANTLE', 'BEACONSFIELD', 'WHITE GUM VALLEY', 'HAMILTON HILL', 'SPEARWOOD', 'COOGEE', 'BICTON'],
  peel: ['ROCKINGHAM', 'BALDIVIS', 'KWINANA TOWN CENTRE', 'MANDURAH', 'SECRET HARBOUR', 'PORT KENNEDY', 'PINJARRA', 'HALLS HEAD', 'WAROONA', 'BODDINGTON', 'DAWESVILLE', 'SAFETY BAY'],
  'south-west': ['BUNBURY', 'BUSSELTON', 'MARGARET RIVER', 'DUNSBOROUGH', 'AUSTRALIND', 'COLLIE', 'AUGUSTA', 'MANJIMUP', 'BRIDGETOWN', 'HARVEY', 'DONNYBROOK', 'NANNUP', 'PEMBERTON'],
  'great-southern': ['ALBANY', 'DENMARK', 'MOUNT BARKER', 'KATANNING', 'WALPOLE', 'KOJONUP', 'GNOWANGERUP', 'BREMER BAY', 'CRANBROOK'],
  wheatbelt: ['NORTHAM', 'YORK', 'MERREDIN', 'NARROGIN', 'MOORA', 'WONGAN HILLS', 'KONDININ', 'LAKE GRACE', 'TOODYAY', 'DALWALLINU', 'KELLERBERRIN', 'CORRIGIN', 'BEVERLEY', 'CERVANTES'],
  'mid-west': ['GERALDTON', 'KALBARRI', 'DONGARA', 'CARNARVON', 'MOUNT MAGNET', 'CUE', 'MEEKATHARRA', 'EXMOUTH', 'DENHAM', 'MULLEWA', 'MORAWA'],
  goldfields: ['KALGOORLIE', 'BOULDER', 'ESPERANCE', 'COOLGARDIE', 'KAMBALDA', 'LEONORA', 'LAVERTON', 'NORSEMAN', 'SOUTHERN CROSS', 'RAVENSTHORPE', 'MENZIES', 'WILUNA'],
  pilbara: ['KARRATHA', 'PORT HEDLAND', 'SOUTH HEDLAND', 'NEWMAN', 'TOM PRICE', 'PARABURDOO', 'ONSLOW', 'DAMPIER', 'MARBLE BAR', 'WICKHAM', 'ROEBOURNE', 'PANNAWONICA'],
  kimberley: ['BROOME', 'KUNUNURRA', 'DERBY', 'FITZROY CROSSING', 'HALLS CREEK', 'WYNDHAM'],
};

const SMALL_WORDS = new Set(['of', 'and', 'the']);
function titleCase(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w
        .split('-')
        .map((p) => p.replace(/^(mc|o')?([a-z])/, (m, pre, c) => (pre ? pre[0].toUpperCase() + pre.slice(1) + c.toUpperCase() : c.toUpperCase())))
        .join('-');
    })
    .join(' ');
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-localities.js australian_postcodes.csv');
  process.exit(1);
}

const [header, ...data] = parseCsv(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const wa = data
  .filter((r) => r[col.state] === 'WA' && r[col.type] === 'Delivery Area')
  .map((r) => ({ name: r[col.locality].trim(), postcode: r[col.postcode], lat: Number(r[col.lat]), lng: Number(r[col.long]) }))
  .filter((r) => r.name && /^6\d{3}$/.test(r.postcode) && r.lat && r.lng)
  // Mail centres and PO box areas, not places anyone lives or works.
  .filter((r) => !/\b(GPO|DC|DELIVERY CENTRE|MAIL CENTRE|MAIL PROCESSING|BC|LPO)\b/.test(r.name));

const byName = new Map();
for (const r of wa) if (!byName.has(r.name)) byName.set(r.name, r);

const anchors = [];
for (const [region, names] of Object.entries(ANCHORS)) {
  for (const n of names) {
    const hit = byName.get(n);
    if (!hit) throw new Error(`Anchor not found in data: ${n}`);
    anchors.push({ region, lat: hit.lat, lng: hit.lng });
  }
}

function nearestRegion(lat, lng) {
  let best = null, bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const a of anchors) {
    const d = (a.lat - lat) ** 2 + ((a.lng - lng) * k) ** 2;
    if (d < bestD) { bestD = d; best = a.region; }
  }
  return best;
}

const seen = new Set();
const out = [];
for (const r of wa) {
  const key = `${r.name}|${r.postcode}`;
  if (seen.has(key)) continue;
  seen.add(key);
  out.push([titleCase(r.name), r.postcode, nearestRegion(r.lat, r.lng)]);
}
out.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

const dest = path.join(__dirname, '..', 'src', 'data', 'wa-localities.json');
fs.writeFileSync(dest, '[\n' + out.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`Wrote ${out.length} WA localities to ${path.relative(process.cwd(), dest)}`);
