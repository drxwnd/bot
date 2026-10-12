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
  { slug: 'other', name: 'Something else' },
];

// Broad Perth metro regions. Tradies pick the ones they'll travel to.
const REGIONS = [
  { slug: 'cbd', name: 'Perth CBD & inner city' },
  { slug: 'western', name: 'Western suburbs' },
  { slug: 'northern', name: 'Northern suburbs' },
  { slug: 'north-east', name: 'Swan Valley & north-east' },
  { slug: 'eastern', name: 'Eastern suburbs & hills' },
  { slug: 'south-east', name: 'South-east' },
  { slug: 'southern', name: 'Southern suburbs' },
  { slug: 'fremantle', name: 'Fremantle & surrounds' },
  { slug: 'peel', name: 'Rockingham, Kwinana & Peel' },
];

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

const lookup = (list) => Object.fromEntries(list.map((x) => [x.slug, x.name]));

module.exports = {
  TRADES,
  REGIONS,
  TIMINGS,
  BUDGETS,
  tradeName: lookup(TRADES),
  regionName: lookup(REGIONS),
  timingName: lookup(TIMINGS),
  budgetName: lookup(BUDGETS),
};
