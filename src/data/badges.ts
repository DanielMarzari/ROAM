import type { Badge } from '@/types/awards';
import { NATIONAL_PARKS } from './nationalParks';

// Mileage milestones (cumulative miles hiked)
const MILEAGE_BADGES: Badge[] = [
  { id: 'mi-10',   name: 'Trail Starter',     description: 'Hike 10 cumulative miles.',   category: 'mileage', emoji: '🥾', color: 'lime',     shape: 'medal', requirement: { type: 'miles_hiked', miles: 10 } },
  { id: 'mi-25',   name: 'Day Hiker',         description: 'Hike 25 cumulative miles.',   category: 'mileage', emoji: '🥾', color: 'green',    shape: 'medal', requirement: { type: 'miles_hiked', miles: 25 } },
  { id: 'mi-50',   name: 'Weekend Warrior',   description: 'Hike 50 cumulative miles.',   category: 'mileage', emoji: '⛰️',  color: 'emerald',  shape: 'medal', requirement: { type: 'miles_hiked', miles: 50 } },
  { id: 'mi-100',  name: 'Centurion',         description: 'Hike 100 cumulative miles.',  category: 'mileage', emoji: '💯', color: 'teal',     shape: 'medal', requirement: { type: 'miles_hiked', miles: 100 } },
  { id: 'mi-250',  name: 'Trail Master',      description: 'Hike 250 cumulative miles.',  category: 'mileage', emoji: '🏆', color: 'cyan',     shape: 'medal', requirement: { type: 'miles_hiked', miles: 250 } },
  { id: 'mi-500',  name: 'Ultra Hiker',       description: 'Hike 500 cumulative miles.',  category: 'mileage', emoji: '🔥', color: 'sky',      shape: 'medal', requirement: { type: 'miles_hiked', miles: 500 } },
  { id: 'mi-1000', name: 'Thousand-Miler',    description: 'Hike 1,000 cumulative miles.',category: 'mileage', emoji: '🌟', color: 'amber',    shape: 'star',  requirement: { type: 'miles_hiked', miles: 1000 } },
  { id: 'mi-2000', name: 'Long Trail Legend', description: 'Hike 2,000 cumulative miles.',category: 'mileage', emoji: '👑', color: 'yellow',   shape: 'star',  requirement: { type: 'miles_hiked', miles: 2000 } },
];

// Park collector badges
const COLLECTOR_BADGES: Badge[] = [
  { id: 'parks-1',  name: 'First Stamp',         description: 'Visit your first National Park.', category: 'collector', emoji: '🎯', color: 'rose',    shape: 'shield', requirement: { type: 'park_count', count: 1 } },
  { id: 'parks-5',  name: 'Park Explorer',       description: 'Visit 5 National Parks.',         category: 'collector', emoji: '🗺️', color: 'orange',  shape: 'shield', requirement: { type: 'park_count', count: 5 } },
  { id: 'parks-10', name: 'Park Hopper',         description: 'Visit 10 National Parks.',        category: 'collector', emoji: '🚐', color: 'amber',   shape: 'shield', requirement: { type: 'park_count', count: 10 } },
  { id: 'parks-25', name: 'Park Devotee',        description: 'Visit 25 National Parks.',        category: 'collector', emoji: '🏕️', color: 'emerald', shape: 'shield', requirement: { type: 'park_count', count: 25 } },
  { id: 'parks-40', name: 'Park Pilgrim',        description: 'Visit 40 National Parks.',        category: 'collector', emoji: '🛤️', color: 'teal',    shape: 'shield', requirement: { type: 'park_count', count: 40 } },
  { id: 'parks-63', name: 'All Parks Conqueror', description: 'Visit all 63 US National Parks.', category: 'collector', emoji: '👑', color: 'yellow',  shape: 'star',   requirement: { type: 'park_count', count: 63 } },
];

// Activity badges
const ACTIVITY_BADGES: Badge[] = [
  { id: 'act-climb',       name: 'Vertical Limit',    description: 'Log a rock-climbing outing.', category: 'activity', emoji: '🧗', color: 'orange',  shape: 'patch', requirement: { type: 'activity', activity: 'climbing' } },
  { id: 'act-cave',        name: 'Spelunker',          description: 'Log a caving expedition.',     category: 'activity', emoji: '🦇', color: 'stone',   shape: 'patch', requirement: { type: 'activity', activity: 'cave' } },
  { id: 'act-camp',        name: 'Under the Stars',    description: 'Log a camping trip.',          category: 'activity', emoji: '⛺', color: 'green',   shape: 'patch', requirement: { type: 'activity', activity: 'camping' } },
  { id: 'act-via-ferrata', name: 'Iron Path',          description: 'Log a via ferrata route.',     category: 'activity', emoji: '🪜', color: 'red',     shape: 'patch', requirement: { type: 'activity', activity: 'via_ferrata' } },
  { id: 'act-offroad',     name: 'Off the Beaten Path',description: 'Log an off-roading session.',  category: 'activity', emoji: '🚙', color: 'amber',   shape: 'patch', requirement: { type: 'activity', activity: 'offroad' } },
  { id: 'act-kayak',       name: 'Paddle Pioneer',     description: 'Log a kayaking trip.',         category: 'activity', emoji: '🛶', color: 'blue',    shape: 'patch', requirement: { type: 'activity', activity: 'kayak' } },
  { id: 'act-fishing',     name: 'Reel Deal',          description: 'Log a fishing trip.',          category: 'activity', emoji: '🎣', color: 'teal',    shape: 'patch', requirement: { type: 'activity', activity: 'fishing' } },
  { id: 'act-darksky',     name: 'Stargazer',          description: 'Visit a Dark Sky location.',   category: 'activity', emoji: '🌌', color: 'indigo',  shape: 'patch', requirement: { type: 'special', key: 'dark_sky_visit' } },
  { id: 'act-tribal',      name: 'Sacred Ground',      description: 'Visit Tribal Lands respectfully.', category: 'activity', emoji: '🪶', color: 'rose', shape: 'patch', requirement: { type: 'special', key: 'tribal_land_visit' } },
];

// Special "lifetime achievement" badges
const SPECIAL_BADGES: Badge[] = [
  { id: 'sp-all-activities', name: 'Triple Threat',      description: 'Log every activity type at least once.', category: 'special', emoji: '🎖️', color: 'violet', shape: 'star',  requirement: { type: 'special', key: 'all_activities' } },
  { id: 'sp-summit-fever',   name: 'Summit Fever',       description: 'Hike a trail with 5,000+ ft elevation gain.', category: 'special', emoji: '🏔️', color: 'sky',  shape: 'star',  requirement: { type: 'special', key: 'big_elevation' } },
  { id: 'sp-thru-hike',      name: 'Long Distance',      description: 'Log a single hike of 20+ miles.',       category: 'special', emoji: '➡️',  color: 'lime',   shape: 'star',  requirement: { type: 'special', key: 'long_single_hike' } },
];

// Park badges (auto-generated from NATIONAL_PARKS)
const PARK_BADGES: Badge[] = NATIONAL_PARKS.map((park) => ({
  id: `park-${park.id}`,
  name: park.name,
  description: `Visit ${park.name} National Park (${park.state}).`,
  category: 'park',
  emoji: park.emoji,
  color: park.color,
  shape: 'patch',
  requirement: { type: 'park_visit', parkId: park.id },
}));

export const ALL_BADGES: Badge[] = [
  ...PARK_BADGES,
  ...MILEAGE_BADGES,
  ...COLLECTOR_BADGES,
  ...ACTIVITY_BADGES,
  ...SPECIAL_BADGES,
];

export const BADGES_BY_CATEGORY = {
  park:      PARK_BADGES,
  mileage:   MILEAGE_BADGES,
  collector: COLLECTOR_BADGES,
  activity:  ACTIVITY_BADGES,
  special:   SPECIAL_BADGES,
};

export const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  park:      { label: 'National Park Patches', description: 'Collect a patch for every park you visit.' },
  mileage:   { label: 'Mileage Medals',         description: 'Earn medals as your trail miles add up.' },
  collector: { label: 'Park Collector',         description: 'Milestones for visiting multiple parks.' },
  activity:  { label: 'Activity Patches',       description: 'A patch for each adventure category.' },
  special:   { label: 'Lifetime Achievements',  description: 'Rare awards for exceptional feats.' },
};
