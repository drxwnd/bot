const { test } = require('node:test');
const assert = require('node:assert');
const { locate } = require('../src/locality');

const cases = [
  ['12 Smith St, Morley WA 6062', 'Morley', 'north-east'],
  ['12 Perth St, Morley', 'Morley', 'north-east'],
  ['3/88 Walcott St Mt Lawley', 'Mount Lawley', 'cbd'],
  ['Unit 4, 10 Beach Rd, Coogee, Western Australia 6166', 'Coogee', 'fremantle'],
  ['12 Albany Hwy, Victoria Park 6100', 'Victoria Park', 'cbd'],
  ['Lot 5 Ocean Reef Rd, Ocean Reef 6027', 'Ocean Reef', 'northern'],
  ['Mt Whaleback mine site, Newman WA 6753', 'Newman', 'pilbara'],
  ['20 Victoria St, Bunbury WA 6230', 'Bunbury', 'south-west'],
  ['Broome', 'Broome', 'kimberley'],
  ['Kalgoorlie', 'Kalgoorlie', 'goldfields'],
];

test('finds the suburb and area in typical WA addresses', () => {
  for (const [address, suburb, region] of cases) {
    const got = locate(address);
    assert.strictEqual(got.suburb, suburb, address);
    assert.strictEqual(got.region, region, address);
  }
});

test("doesn't mistake a street name for the suburb", () => {
  assert.strictEqual(locate('12 Albany Hwy').error, 'no-suburb');
});

test('asks for the suburb when a postcode covers several', () => {
  const got = locate('1 Main St 6062');
  assert.strictEqual(got.error, 'pick-suburb');
  assert.ok(got.options.includes('Morley'));
});

test('rejects addresses outside WA', () => {
  assert.ok(locate('12 Fake St, Melbourne VIC 3000').error);
});
