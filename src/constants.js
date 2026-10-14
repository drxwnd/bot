const TRADES = [
  { slug: 'tiling', name: 'Tiling' },
  { slug: 'plumbing', name: 'Plumbing' },
  { slug: 'electrical', name: 'Electrical' },
  { slug: 'carpentry', name: 'Carpentry' },
  { slug: 'painting', name: 'Painting' },
  { slug: 'roofing', name: 'Roofing & gutters' },
  { slug: 'bricklaying', name: 'Bricklaying' },
  { slug: 'plastering', name: 'Plastering' },
  { slug: 'concreting', name: 'Concreting' },
  { slug: 'landscaping', name: 'Landscaping & reticulation' },
  { slug: 'fencing', name: 'Fencing & gates' },
  { slug: 'aircon', name: 'Air con & heating' },
  { slug: 'handyman', name: 'Handyman' },
  { slug: 'renovation', name: 'Renovation & extensions' },
  { slug: 'locksmith', name: 'Locks & security' },
  { slug: 'appliances', name: 'Appliance repair' },
  { slug: 'welding', name: 'Welding & fabrication' },
  { slug: 'fitting', name: 'Mechanical fitting' },
  { slug: 'scaffolding', name: 'Scaffolding' },
  { slug: 'other', name: 'Something else' },
];

const SECTORS = [
  {
    slug: 'housing',
    name: 'Housing',
    short: 'Homes, rentals and units',
    path: '/housing',
    // What the extra job field is called for this sector, if it has one.
    extraLabel: null,
  },
  {
    slug: 'hotels',
    name: 'Hotels',
    short: 'Hotels, motels, short-stay and serviced apartments',
    path: '/hotels',
    extraLabel: 'Access and timing',
    extraHint: 'When can work happen? e.g. between 10am and 2pm, after checkout, rooms we can block out, guest areas to avoid.',
  },
  {
    slug: 'mining',
    name: 'Mining',
    short: 'Mine sites, camps, workshops and offices',
    path: '/mining',
    extraLabel: 'Site requirements',
    extraHint: 'Inductions, tickets, medicals, PPE, FIFO or DIDO, and whether flights, meals and accommodation are provided.',
  },
];

// Tradies pick the ones they'll travel to.
const REGIONS = [
  { slug: 'cbd', name: 'Perth CBD & inner city', group: 'Perth metro' },
  { slug: 'western', name: 'Western suburbs', group: 'Perth metro' },
  { slug: 'northern', name: 'Northern suburbs', group: 'Perth metro' },
  { slug: 'north-east', name: 'Swan Valley & north-east', group: 'Perth metro' },
  { slug: 'eastern', name: 'Eastern suburbs & hills', group: 'Perth metro' },
  { slug: 'south-east', name: 'South-east', group: 'Perth metro' },
  { slug: 'southern', name: 'Southern suburbs', group: 'Perth metro' },
  { slug: 'fremantle', name: 'Fremantle & surrounds', group: 'Perth metro' },
  { slug: 'peel', name: 'Rockingham, Kwinana & Peel', group: 'Perth metro' },
  { slug: 'south-west', name: 'South West (Bunbury, Margaret River)', group: 'Regional WA' },
  { slug: 'great-southern', name: 'Great Southern (Albany)', group: 'Regional WA' },
  { slug: 'wheatbelt', name: 'Wheatbelt', group: 'Regional WA' },
  { slug: 'mid-west', name: 'Mid West (Geraldton)', group: 'Regional WA' },
  { slug: 'goldfields', name: 'Goldfields-Esperance (Kalgoorlie)', group: 'Regional WA' },
  { slug: 'pilbara', name: 'Pilbara (Karratha, Port Hedland, Newman)', group: 'Regional WA' },
  { slug: 'kimberley', name: 'Kimberley (Broome, Kununurra)', group: 'Regional WA' },
];

const REGION_GROUPS = ['Perth metro', 'Regional WA'];

const TIMINGS = [
  { slug: 'urgent', name: 'Urgent, within a few days' },
  { slug: 'two-weeks', name: 'Within two weeks' },
  { slug: 'month', name: 'Within a month' },
  { slug: 'flexible', name: 'Flexible / just getting prices' },
];

const BUDGETS = [
  { slug: 'under-500', name: 'Under $500' },
  { slug: '500-2k', name: '$500 – $2,000' },
  { slug: '2k-10k', name: '$2,000 – $10,000' },
  { slug: '10k-50k', name: '$10,000 – $50,000' },
  { slug: 'over-50k', name: '$50,000+' },
  { slug: 'unsure', name: 'Not sure yet' },
];

// Lookups have no prototype, so "constructor" or "__proto__" from a form never counts as a valid option.
const dict = (obj) => Object.assign(Object.create(null), obj);
const lookup = (list) => dict(Object.fromEntries(list.map((x) => [x.slug, x.name])));

// The value if it's one of the map's own keys, otherwise the fallback. Repeated form fields arrive as
// arrays, which are refused too.
const oneOf = (map, value, fallback = '') => (typeof value === 'string' && Object.hasOwn(map, value) ? value : fallback);

module.exports = {
  TRADES,
  SECTORS,
  REGIONS,
  REGION_GROUPS,
  TIMINGS,
  BUDGETS,
  tradeName: lookup(TRADES),
  sectorName: lookup(SECTORS),
  sectorBySlug: dict(Object.fromEntries(SECTORS.map((x) => [x.slug, x]))),
  regionName: lookup(REGIONS),
  timingName: lookup(TIMINGS),
  budgetName: lookup(BUDGETS),
  dict,
  oneOf,
};
