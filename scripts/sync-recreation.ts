/**
 * ROAM Recreation Sites Sync Script
 *
 * Fetches recreation POIs from OpenStreetMap (Overpass API)
 * and inserts/updates them in the SQLite database.
 *
 * Usage:
 *   npx tsx scripts/sync-recreation.ts --state CA --type climbing
 *   npx tsx scripts/sync-recreation.ts --state CO              # all types
 *   npx tsx scripts/sync-recreation.ts                         # all states, all types
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'roam.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// US state bounding boxes (west, south, east, north)
const STATE_BBOXES: Record<string, [number, number, number, number]> = {
  AL: [-88.47, 30.22, -84.89, 35.01],
  AK: [-179.15, 51.21, -129.98, 71.39],
  AZ: [-114.82, 31.33, -109.04, 37.00],
  AR: [-94.62, 33.00, -89.64, 36.50],
  CA: [-124.48, 32.53, -114.13, 42.01],
  CO: [-109.06, 36.99, -102.04, 41.00],
  CT: [-73.73, 40.98, -71.79, 42.05],
  DE: [-75.79, 38.45, -75.05, 39.84],
  FL: [-87.63, 24.52, -80.03, 31.00],
  GA: [-85.61, 30.36, -80.84, 35.00],
  HI: [-160.24, 18.91, -154.81, 22.24],
  ID: [-117.24, 41.99, -111.04, 49.00],
  IL: [-91.51, 36.97, -87.50, 42.51],
  IN: [-88.10, 37.77, -84.78, 41.76],
  IA: [-96.64, 40.38, -90.14, 43.50],
  KS: [-102.05, 36.99, -94.59, 40.00],
  KY: [-89.57, 36.50, -81.96, 39.15],
  LA: [-94.04, 28.93, -88.82, 33.02],
  ME: [-71.08, 43.06, -66.95, 47.46],
  MD: [-79.49, 37.91, -75.05, 39.72],
  MA: [-73.51, 41.24, -69.93, 42.89],
  MI: [-90.42, 41.70, -82.12, 48.31],
  MN: [-97.24, 43.50, -89.49, 49.38],
  MS: [-91.66, 30.17, -88.10, 34.99],
  MO: [-95.77, 36.00, -89.10, 40.61],
  MT: [-116.05, 44.36, -104.04, 49.00],
  NE: [-104.05, 39.99, -95.31, 43.00],
  NV: [-120.01, 35.00, -114.04, 42.00],
  NH: [-72.56, 42.70, -70.70, 45.31],
  NJ: [-75.56, 38.93, -73.89, 41.36],
  NM: [-109.05, 31.33, -103.00, 37.00],
  NY: [-79.76, 40.50, -71.86, 45.02],
  NC: [-84.32, 33.84, -75.46, 36.59],
  ND: [-104.05, 45.94, -96.55, 49.00],
  OH: [-84.82, 38.40, -80.52, 42.33],
  OK: [-103.00, 33.62, -94.43, 37.00],
  OR: [-124.57, 41.99, -116.46, 46.29],
  PA: [-80.52, 39.72, -74.69, 42.27],
  RI: [-71.86, 41.15, -71.12, 42.02],
  SC: [-83.35, 32.05, -78.54, 35.22],
  SD: [-104.06, 42.48, -96.44, 45.95],
  TN: [-90.31, 34.98, -81.65, 36.68],
  TX: [-106.65, 25.84, -93.51, 36.50],
  UT: [-114.05, 36.99, -109.04, 42.00],
  VT: [-73.44, 42.73, -71.46, 45.02],
  VA: [-83.68, 36.54, -75.24, 39.47],
  WA: [-124.85, 45.54, -116.92, 49.00],
  WV: [-82.64, 37.20, -77.72, 40.64],
  WI: [-92.89, 42.49, -86.25, 47.08],
  WY: [-111.06, 40.99, -104.05, 45.01],
};

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Activity type → Overpass query fragments
const ACTIVITY_QUERIES: Record<string, (bbox: string) => string> = {
  climbing: (bbox) => `
    node["sport"="climbing"](${bbox});
    way["sport"="climbing"](${bbox});
    node["climbing"](${bbox});
  `,
  cave: (bbox) => `
    node["natural"="cave_entrance"](${bbox});
  `,
  camping: (bbox) => `
    node["tourism"="camp_site"](${bbox});
    way["tourism"="camp_site"](${bbox});
  `,
  via_ferrata: (bbox) => `
    way["sport"="via_ferrata"](${bbox});
    node["sport"="via_ferrata"](${bbox});
  `,
  offroad: (bbox) => `
    way["highway"="track"]["4wd_only"](${bbox});
    node["sport"="motor"](${bbox});
  `,
  kayak: (bbox) => `
    node["sport"="kayak"](${bbox});
    node["sport"="canoe"](${bbox});
    node["canoe"="put_in"](${bbox});
  `,
  fishing: (bbox) => `
    node["leisure"="fishing"](${bbox});
    node["sport"="fishing"](${bbox});
    way["leisure"="fishing"](${bbox});
  `,
};

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  center?: { lat: number; lon: number };
}

// Ensure the recreation_sites table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS recreation_sites (
    id TEXT PRIMARY KEY,
    name TEXT,
    activity_type TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    state TEXT,
    source TEXT DEFAULT 'osm',
    tags_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_recreation_activity ON recreation_sites(activity_type);
  CREATE INDEX IF NOT EXISTS idx_recreation_lat ON recreation_sites(lat);
  CREATE INDEX IF NOT EXISTS idx_recreation_lng ON recreation_sites(lng);
  CREATE INDEX IF NOT EXISTS idx_recreation_state ON recreation_sites(state);
`);

function buildOverpassQuery(bbox: [number, number, number, number], activityType: string): string {
  const [west, south, east, north] = bbox;
  const bboxStr = `${south},${west},${north},${east}`;
  const queryFn = ACTIVITY_QUERIES[activityType];
  if (!queryFn) throw new Error(`Unknown activity type: ${activityType}`);

  return `
    [out:json][timeout:120][bbox:${bboxStr}];
    (
      ${queryFn(bboxStr)}
    );
    out center;
  `;
}

function getLatLng(element: OverpassElement): { lat: number; lng: number } | null {
  // Node with direct coordinates
  if (element.lat !== undefined && element.lon !== undefined) {
    return { lat: element.lat, lng: element.lon };
  }
  // Way/relation with center
  if (element.center) {
    return { lat: element.center.lat, lng: element.center.lon };
  }
  // Way with geometry — compute centroid
  if (element.geometry && element.geometry.length > 0) {
    const sumLat = element.geometry.reduce((s, p) => s + p.lat, 0);
    const sumLon = element.geometry.reduce((s, p) => s + p.lon, 0);
    return { lat: sumLat / element.geometry.length, lng: sumLon / element.geometry.length };
  }
  return null;
}

async function syncActivityForState(stateCode: string, activityType: string) {
  const bbox = STATE_BBOXES[stateCode];
  if (!bbox) {
    console.error(`Unknown state: ${stateCode}`);
    return;
  }

  console.log(`  Fetching ${activityType} for ${stateCode}...`);
  const query = buildOverpassQuery(bbox, activityType);

  try {
    const response = await axios.post(OVERPASS_ENDPOINT, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 120000,
    });

    const elements: OverpassElement[] = response.data.elements || [];
    console.log(`    Received ${elements.length} elements`);

    const upsert = db.prepare(`
      INSERT INTO recreation_sites (id, name, activity_type, lat, lng, state, source, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'osm', ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        lat = excluded.lat,
        lng = excluded.lng,
        tags_json = excluded.tags_json,
        updated_at = datetime('now')
    `);

    let processed = 0;
    const insertMany = db.transaction((elems: OverpassElement[]) => {
      for (const el of elems) {
        const loc = getLatLng(el);
        if (!loc) continue;

        const id = `osm-${el.type}-${el.id}`;
        const tags = el.tags || {};
        const name = tags.name || null;

        upsert.run(id, name, activityType, loc.lat, loc.lng, stateCode, JSON.stringify(tags));
        processed++;
      }
    });

    insertMany(elements);
    console.log(`    Processed: ${processed} sites`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    Failed: ${msg}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf('--state');
  const typeIdx = args.indexOf('--type');

  const state = stateIdx >= 0 ? args[stateIdx + 1]?.toUpperCase() : null;
  const actType = typeIdx >= 0 ? args[typeIdx + 1] : null;

  const types = actType ? [actType] : Object.keys(ACTIVITY_QUERIES);
  const states = state ? [state] : Object.keys(STATE_BBOXES);

  console.log(`Syncing recreation sites: ${types.join(', ')} for ${states.length} state(s)\n`);

  for (const st of states) {
    console.log(`\n=== ${st} ===`);
    for (const t of types) {
      await syncActivityForState(st, t);
      // Pause between queries to respect Overpass rate limits
      await new Promise(r => setTimeout(r, 5000));
    }
    if (states.length > 1) {
      console.log('  Waiting 10s before next state...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log('\nRecreation sync complete!');
}

main().catch(console.error);
