// Copy for the trade and area landing pages. Keep licence notes conservative: only state a WA
// requirement here if it's well established, and point people to the register to check.

const TRADE_INFO = {
  tiling: {
    plural: 'Tilers',
    jobs: ['Regrouting and resealing showers', 'Replacing cracked or drummy tiles', 'Bathroom and laundry retiling', 'Kitchen splashbacks', 'Outdoor and pool tiling', 'Waterproofing before tiling'],
    licence: "No separate tiling licence is needed in WA, but waterproofing in wet areas has to meet the Australian Standard (AS 3740), and work over $20,000 needs a registered building contractor.",
    tip: 'Give the room size, the tile size you want, and whether old tiles need to come up. Mention if you already have tiles.',
  },
  plumbing: {
    plural: 'Plumbers',
    jobs: ['Leaking taps and toilets', 'Blocked drains', 'Hot water system repairs and replacement', 'Burst pipes', 'Bathroom and kitchen rough-ins', 'Gas appliance connections'],
    licence: 'Plumbing work in WA must be done by a licensed plumbing contractor. Gas fitting needs a separate gas fitting permit.',
    tip: 'Say what is leaking or blocked, how long it has been happening, and the age of the house or fixture if you know it.',
  },
  electrical: {
    plural: 'Electricians',
    jobs: ['Power points and lights', 'Switchboard upgrades', 'Safety switches (RCDs)', 'Ceiling fans', 'Rewiring', 'Fault finding'],
    licence: 'All electrical work in WA has to be done by a licensed electrical contractor. You can check a licence on the Building and Energy register.',
    tip: 'Say how many points or fittings, whether it is a new install or a fault, and roughly how old the switchboard is.',
  },
  carpentry: {
    plural: 'Carpenters',
    jobs: ['Doors and door frames', 'Decking and pergolas', 'Skirting and architraves', 'Built-in wardrobes and shelving', 'Termite and rot repairs', 'Stairs and balustrades'],
    licence: 'Carpentry work over $20,000 in WA needs a registered building contractor.',
    tip: 'Give measurements and say what material you want, for example merbau or treated pine for decking.',
  },
  painting: {
    plural: 'Painters',
    jobs: ['Interior repaints', 'Exterior and weatherboard painting', 'Roof painting', 'Patching and painting between tenants', 'Feature walls', 'Fence and deck staining'],
    licence: 'In WA, painting work over $1,000 has to be done by a registered painting contractor.',
    tip: 'Say how many rooms or the rough wall area, the ceiling height, and whether there is patching to do first.',
  },
  roofing: {
    plural: 'Roofers',
    jobs: ['Leak repairs', 'Gutter cleaning and replacement', 'Rebedding and repointing tiled roofs', 'Replacing broken tiles or sheets', 'Whirlybirds and vents', 'Full reroofs'],
    licence: 'Roofing work over $20,000 needs a registered building contractor. Ask how they manage working at heights.',
    tip: 'Say whether it is tiles or Colorbond, single or double storey, and where the leak shows inside.',
  },
  bricklaying: {
    plural: 'Bricklayers',
    jobs: ['Retaining walls', 'Letterboxes and pillars', 'Garden and boundary walls', 'Repairing cracked brickwork', 'Paving edges and steps', 'Extensions'],
    licence: 'Brickwork over $20,000 needs a registered building contractor. Retaining walls over a certain height may need council approval and engineering.',
    tip: 'Give the length and height of the wall, and say if it is retaining soil.',
  },
  plastering: {
    plural: 'Plasterers',
    jobs: ['Patching holes and cracks', 'Cornices', 'Ceiling repairs and sagging ceilings', 'New plasterboard walls', 'Water damage repairs', 'Rendering'],
    licence: 'Plastering work over $20,000 needs a registered building contractor.',
    tip: 'Say the size of the damage and whether it was caused by water. If so, fix the leak first.',
  },
  concreting: {
    plural: 'Concreters',
    jobs: ['Driveways', 'Paths and patios', 'Shed and water tank slabs', 'Exposed aggregate', 'Paving', 'Footings'],
    licence: 'Concrete work over $20,000 needs a registered building contractor.',
    tip: 'Give the area in square metres, the finish you want, and how the truck can get to the site.',
  },
  landscaping: {
    plural: 'Landscapers',
    jobs: ['Reticulation repairs and installs', 'Turf laying', 'Garden makeovers', 'Limestone and retaining walls', 'Artificial grass', 'Yard clean-ups'],
    licence: 'No specific licence for general landscaping. Connections to the mains water supply need a licensed plumber.',
    tip: 'Say the size of the area, what is there now, and whether you are on scheme or bore water.',
  },
  fencing: {
    plural: 'Fencers',
    jobs: ['Colorbond fencing', 'Pool fencing', 'Gates and sliding gates', 'Brick and limestone pillars', 'Dividing fences with neighbours', 'Repairs after storms'],
    licence: 'Pool fences in WA must meet the pool barrier standard and are inspected by council.',
    tip: 'Give the length in metres, the height, and whether old fencing needs to come out.',
  },
  aircon: {
    plural: 'Air con technicians',
    jobs: ['Split system installs', 'Ducted reverse cycle', 'Evaporative cooler servicing', 'Air con not cooling', 'Gas re-gas and leak repairs', 'Replacing old units'],
    licence: 'Installing or servicing refrigerant-based air con needs an ARCtick refrigerant handling licence, and hardwiring needs a licensed electrician.',
    tip: 'Say the unit type and brand if you know it, the room size, and how far the outdoor unit is from the indoor one.',
  },
  handyman: {
    plural: 'Handyman services',
    jobs: ['Flat-pack assembly', 'Hanging doors and shelves', 'Small repairs between tenants', 'Gutter cleaning', 'Silicone and caulking', 'Odd jobs lists'],
    licence: "Handymen can't do electrical, plumbing or gas work in WA, and work over $20,000 needs a registered builder.",
    tip: 'List everything you want done in one job. It usually works out cheaper than separate call-outs.',
  },
  renovation: {
    plural: 'Renovation builders',
    jobs: ['Bathroom renovations', 'Kitchen renovations', 'Extensions and additions', 'Patios and alfrescos', 'Knocking out walls', 'Granny flats'],
    licence: 'Building work over $20,000 in WA needs a registered building contractor and, in most cases, home indemnity insurance.',
    tip: 'Share plans or photos if you have them, and say whether you need help with council approvals.',
  },
  locksmith: {
    plural: 'Locksmiths',
    jobs: ['Lockouts', 'Rekeying after tenants move out', 'Deadlocks and window locks', 'Keyless and smart locks', 'Master key systems for hotels and offices', 'Safes'],
    licence: 'Ask about any security licensing that applies to the work, especially for access control systems.',
    tip: 'Say how many doors or locks, and whether you want them keyed alike.',
  },
  appliances: {
    plural: 'Appliance repairers',
    jobs: ['Ovens and cooktops', 'Washing machines and dryers', 'Dishwashers', 'Fridges and freezers', 'Rangehoods', 'Commercial kitchen equipment'],
    licence: 'Gas appliances need a licensed gas fitter, and hardwired appliances need a licensed electrician.',
    tip: 'Give the brand and model number, the fault, and any error code on the display.',
  },
  welding: {
    plural: 'Welders and fabricators',
    jobs: ['Gates and balustrades', 'Steel repairs', 'Trailer and ute tray repairs', 'Structural steel', 'Workshop and plant repairs', 'Custom fabrication'],
    licence: 'Structural welding should be done by a qualified welder to the Australian Standard. Ask for their tickets.',
    tip: 'Say the material, the rough size, and whether the work is on site or can go to their workshop.',
  },
  fitting: {
    plural: 'Mechanical fitters',
    jobs: ['Pump repairs', 'Conveyor maintenance', 'Plant and machinery servicing', 'Shutdown support', 'Bearing and seal replacement', 'Workshop equipment'],
    licence: 'Look for a trade-qualified fitter. Mine sites will have their own induction and ticket requirements.',
    tip: 'List the equipment make and model and what has failed.',
  },
  scaffolding: {
    plural: 'Scaffolders',
    jobs: ['Scaffolding for roof work', 'Two-storey painting and rendering', 'Commercial and hotel facades', 'Industrial and mine site scaffold', 'Edge protection', 'Hire with erect and dismantle'],
    licence: 'Scaffolding where someone could fall more than 4 metres needs a high risk work licence.',
    tip: 'Give the height, the length of wall, and how long you need it up.',
  },
};

// Towns and suburbs help people recognise their area and give each area page its own content.
const REGION_INFO = {
  cbd: { name: "Perth's CBD and inner suburbs", places: ['Perth', 'Northbridge', 'East Perth', 'West Perth', 'Leederville', 'Mount Lawley', 'Highgate', 'Subiaco'], note: 'Apartments, older character homes and plenty of hotels. Parking and building access are worth mentioning in your job.' },
  western: { name: "Perth's western suburbs", places: ['Cottesloe', 'Claremont', 'Nedlands', 'Mosman Park', 'Peppermint Grove', 'City Beach', 'Floreat', 'Dalkeith'], note: 'Lots of older homes and heritage features, plus coastal exposure that is hard on paint and metalwork.' },
  northern: { name: "Perth's northern suburbs", places: ['Joondalup', 'Scarborough', 'Karrinyup', 'Wanneroo', 'Clarkson', 'Hillarys', 'Duncraig', 'Butler', 'Yanchep'], note: 'From established coastal suburbs to new estates up to Yanchep and Two Rocks.' },
  'north-east': { name: "the Swan Valley and north-east Perth", places: ['Midland', 'Ellenbrook', 'Bassendean', 'Guildford', 'Morley', 'Bayswater', 'Beechboro', 'The Vines'], note: 'A mix of older Midland and Guildford homes and newer Ellenbrook builds.' },
  eastern: { name: "Perth's eastern suburbs and hills", places: ['Kalamunda', 'Mundaring', 'Forrestfield', 'Lesmurdie', 'Maida Vale', 'High Wycombe', 'Darlington'], note: 'Hills properties often have steep blocks, bushfire requirements and longer travel for tradies.' },
  'south-east': { name: "Perth's south-east", places: ['Armadale', 'Gosnells', 'Canning Vale', 'Thornlie', 'Byford', 'Kelmscott', 'Harrisdale', 'Piara Waters'], note: 'Fast-growing estates with lots of newer homes, plus established suburbs around Gosnells and Armadale.' },
  southern: { name: "Perth's southern suburbs", places: ['Willetton', 'Applecross', 'Booragoon', 'Bull Creek', 'Murdoch', 'Cockburn Central', 'Success', 'Atwell'], note: 'Mostly 1970s to 2000s homes, plus the newer estates around Cockburn.' },
  fremantle: { name: "Fremantle", places: ['Fremantle', 'East Fremantle', 'South Fremantle', 'North Fremantle', 'Beaconsfield', 'White Gum Valley', 'Hamilton Hill', 'Spearwood'], note: 'Heritage limestone homes, salt air, and a busy hospitality strip.' },
  peel: { name: "Rockingham, Kwinana and Peel", places: ['Rockingham', 'Baldivis', 'Kwinana', 'Mandurah', 'Secret Harbour', 'Port Kennedy', 'Pinjarra', 'Halls Head'], note: 'Coastal homes and plenty of new estates, plus industry around Kwinana.' },
  'south-west': { name: "the South West", places: ['Bunbury', 'Busselton', 'Margaret River', 'Dunsborough', 'Australind', 'Collie', 'Augusta'], note: 'Holiday homes, wineries and short-stay accommodation, plus industry around Bunbury and Collie.' },
  'great-southern': { name: "the Great Southern", places: ['Albany', 'Denmark', 'Mount Barker', 'Katanning', 'Walpole'], note: 'Cooler and wetter than Perth, so roofing, gutters and damp problems come up a lot.' },
  wheatbelt: { name: "the Wheatbelt", places: ['Northam', 'York', 'Merredin', 'Narrogin', 'Moora', 'Wongan Hills'], note: 'Farm buildings, sheds and country homes. Travel time is usually built into quotes.' },
  'mid-west': { name: "the Mid West", places: ['Geraldton', 'Kalbarri', 'Dongara', 'Carnarvon', 'Mount Magnet', 'Cue'], note: 'Coastal towns and inland mining operations.' },
  goldfields: { name: "the Goldfields", places: ['Kalgoorlie-Boulder', 'Esperance', 'Coolgardie', 'Kambalda', 'Leonora', 'Laverton', 'Norseman'], note: 'Gold mining country. Camp, workshop and accommodation work is common, along with homes in Kalgoorlie and Esperance.' },
  pilbara: { name: "the Pilbara", places: ['Karratha', 'Port Hedland', 'South Hedland', 'Newman', 'Tom Price', 'Paraburdoo', 'Onslow', 'Dampier'], note: 'Iron ore country. FIFO and DIDO work, camp maintenance, and cyclone-rated building requirements on the coast.' },
  kimberley: { name: "the Kimberley", places: ['Broome', 'Kununurra', 'Derby', 'Fitzroy Crossing', 'Halls Creek', 'Wyndham'], note: 'Remote, with a short dry-season window for a lot of work. Tourism and accommodation keep Broome busy.' },
};

module.exports = { TRADE_INFO, REGION_INFO };
