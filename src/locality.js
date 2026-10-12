// Works out the suburb or town, postcode and area from a typed WA address, so only the suburb is
// shown publicly and the full address stays private.

const ABBREVIATIONS = [
  [/ MT(?= )/g, ' MOUNT'],
  [/ STH(?= )/g, ' SOUTH'],
  [/ NTH(?= )/g, ' NORTH'],
];

// A suburb name followed by one of these is a street, e.g. "Albany Hwy" or "Perth St".
const STREET_TYPES = new Set(
  'ST STREET RD ROAD AVE AV AVENUE DR DRIVE HWY HIGHWAY CRES CR CRESCENT CT COURT PL PLACE WAY LANE LN PDE PARADE TCE TERRACE BLVD BOULEVARD CL CLOSE GR GROVE CCT CIRCUIT LOOP ENTRANCE ESP ESPLANADE FWY FREEWAY RISE VISTA BEND MEWS GDNS GARDENS PROMENADE'.split(' '),
);

function normalise(s) {
  let out = ` ${String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
  for (const [re, to] of ABBREVIATIONS) out = out.replace(re, to);
  return out;
}

function isStreetName(text, end) {
  const next = text.slice(end).trim().split(' ')[0];
  return STREET_TYPES.has(next);
}

const LOCALITIES = require('./data/wa-localities.json').map(([name, postcode, region]) => ({
  name,
  postcode,
  region,
  key: normalise(name),
}));

// Returns { suburb, postcode, region } or { error, options? } when the address can't be pinned down.
function locate(address) {
  // Drop the state and country so they can't be mistaken for part of a suburb name.
  const text = normalise(address).replace(/ (WESTERN AUSTRALIA|AUSTRALIA|WA)(?= )/g, ' ');
  if (text.trim().length < 3) return { error: 'empty' };

  const postcodes = [...text.matchAll(/ (6\d{3})(?= )/g)].map((m) => m[1]);
  const postcode = postcodes[postcodes.length - 1] || null;
  const pool = postcode ? LOCALITIES.filter((l) => l.postcode === postcode) : LOCALITIES;
  if (postcode && !pool.length) return { error: 'unknown-postcode', postcode };

  // The suburb normally comes last, after the street ("12 Perth St, Morley"), so prefer the match
  // that ends latest, then the longest name ("Mount Lawley" over "Lawley").
  let best = null;
  for (const l of pool) {
    const at = text.lastIndexOf(l.key);
    if (at === -1) continue;
    const end = at + l.key.length;
    if (isStreetName(text, end - 1)) continue;
    if (!best || end > best.end || (end === best.end && l.key.length > best.l.key.length)) best = { l, end };
  }

  if (best) return { suburb: best.l.name, postcode: best.l.postcode, region: best.l.region };
  if (postcode && pool.length === 1) return { suburb: pool[0].name, postcode, region: pool[0].region };
  if (postcode) return { error: 'pick-suburb', postcode, options: pool.map((l) => l.name) };
  return { error: 'no-suburb' };
}

function errorMessage(result) {
  switch (result.error) {
    case 'unknown-postcode':
      return `${result.postcode} isn't a WA postcode we know. Check it and try again.`;
    case 'pick-suburb':
      return `Add the suburb or town to the address. ${result.postcode} covers ${result.options.slice(0, 6).join(', ')}${result.options.length > 6 ? ' and others' : ''}.`;
    default:
      return "We couldn't find a WA suburb or town in that address. Include the suburb and postcode, e.g. 12 Smith St, Morley WA 6062.";
  }
}

module.exports = { locate, errorMessage };
