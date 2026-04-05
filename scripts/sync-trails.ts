/**
 * ROAM Trail Data Sync Script
 *
 * Fetches hiking trail data from OpenStreetMap (Overpass API)
 * and inserts/updates it in the Supabase database.
 *
 * Usage: npx tsx scripts/sync-trails.ts [--state CA] [--limit 500]
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
}

/**
 * Build an Overpass QL query to fetch hiking trails in a bounding box.
 */
function buildOverpassQuery(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  return `
    [out:json][timeout:120][bbox:${south},${west},${north},${east}];
    (
      way["highway"="path"]["name"];
      way["highway"="footway"]["name"];
      way["highway"="track"]["name"]["access"!="private"];
      relation["route"="hiking"]["name"];
    );
    out geom;
  `;
}

/**
 * Map SAC scale to our difficulty levels.
 */
function mapDifficulty(tags: Record<string, string>): string | null {
  const sac = tags.sac_scale;
  if (sac) {
    if (sac === 'hiking') return 'easy';
    if (sac === 'mountain_hiking') return 'moderate';
    if (sac === 'demanding_mountain_hiking') return 'hard';
    if (sac.includes('alpine')) return 'expert';
  }

  const trail_visibility = tags.trail_visibility;
  if (trail_visibility === 'excellent' || trail_visibility === 'good') return 'easy';
  if (trail_visibility === 'intermediate') return 'moderate';
  if (trail_visibility === 'bad' || trail_visibility === 'horrible') return 'hard';

  return null;
}

/**
 * Check if two points are close enough to be considered connected.
 */
function pointsClose(a: [number, number], b: [number, number], threshold = 0.0001): boolean {
  return Math.abs(a[0] - b[0]) < threshold && Math.abs(a[1] - b[1]) < threshold;
}

/**
 * Chain an array of line segments into connected sequences.
 * Returns the longest connected chain. Segments are flipped if needed
 * to connect end-to-start.
 */
function chainSegments(segments: [number, number][][]): [number, number][][] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return [segments[0]];

  const used = new Set<number>();
  const chains: [number, number][][] = [];

  while (used.size < segments.length) {
    // Find first unused segment to start a new chain
    let startIdx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (!used.has(i)) { startIdx = i; break; }
    }
    if (startIdx === -1) break;

    used.add(startIdx);
    let chain = [...segments[startIdx]];

    // Keep extending the chain by finding connected segments
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const seg = segments[i];
        const chainEnd = chain[chain.length - 1];
        const chainStart = chain[0];

        // Try appending: chain end → segment start
        if (pointsClose(chainEnd, seg[0])) {
          chain.push(...seg.slice(1));
          used.add(i);
          extended = true;
        }
        // Try appending reversed: chain end → segment end
        else if (pointsClose(chainEnd, seg[seg.length - 1])) {
          chain.push(...[...seg].reverse().slice(1));
          used.add(i);
          extended = true;
        }
        // Try prepending: segment end → chain start
        else if (pointsClose(seg[seg.length - 1], chainStart)) {
          chain = [...seg.slice(0, -1), ...chain];
          used.add(i);
          extended = true;
        }
        // Try prepending reversed: segment start → chain start
        else if (pointsClose(seg[0], chainStart)) {
          chain = [...[...seg].reverse().slice(0, -1), ...chain];
          used.add(i);
          extended = true;
        }
      }
    }

    chains.push(chain);
  }

  return chains;
}

/**
 * Convert an Overpass element to trail geometry/geometries.
 * - For ways: returns a single LineString coordinate array.
 * - For relations: chains connected member segments and returns ALL
 *   connected chains (each becomes its own trail row to avoid criss-crosses).
 */
function extractGeometries(element: OverpassElement): [number, number][][] {
  // Simple way — single geometry
  if (element.geometry && element.geometry.length >= 2) {
    return [element.geometry.map((p) => [p.lon, p.lat])];
  }

  // Relation — extract each member as a separate segment, then chain
  if (element.members) {
    const segments: [number, number][][] = [];
    for (const member of element.members) {
      if (member.geometry && member.geometry.length >= 2) {
        segments.push(member.geometry.map((p) => [p.lon, p.lat]));
      }
    }
    if (segments.length === 0) return [];

    const chains = chainSegments(segments);
    // Filter out tiny chains (< 3 points) that are likely artifacts
    return chains.filter(c => c.length >= 3);
  }

  return [];
}

/**
 * Calculate approximate trail length in miles from coordinates.
 */
function calculateLengthMiles(coords: [number, number][]): number {
  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return Math.round(totalKm * 0.621371 * 100) / 100;
}

/**
 * Calculate the centroid of a set of coordinates.
 */
function calculateCentroid(coords: [number, number][]): [number, number] {
  const sumLng = coords.reduce((s, c) => s + c[0], 0);
  const sumLat = coords.reduce((s, c) => s + c[1], 0);
  return [sumLng / coords.length, sumLat / coords.length];
}

/**
 * Fetch and import trails for a given state.
 */
async function syncState(stateCode: string, limit?: number) {
  const bbox = STATE_BBOXES[stateCode];
  if (!bbox) {
    console.error(`Unknown state: ${stateCode}`);
    return;
  }

  console.log(`\nFetching trails for ${stateCode}...`);
  const query = buildOverpassQuery(bbox);

  // Log sync start
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ source: 'osm', region: stateCode, status: 'running' })
    .select()
    .single();

  try {
    const response = await axios.post(OVERPASS_ENDPOINT, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 180000,
    });

    const elements: OverpassElement[] = response.data.elements || [];
    console.log(`  Received ${elements.length} elements from Overpass`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const trailsToProcess = limit ? elements.slice(0, limit) : elements;

    for (const element of trailsToProcess) {
      const tags = element.tags || {};
      if (!tags.name) { skipped++; continue; }

      const chains = extractGeometries(element);
      if (chains.length === 0) { skipped++; continue; }

      // Each connected chain becomes its own trail row.
      // Ways produce 1 chain; relations may produce multiple.
      for (let ci = 0; ci < chains.length; ci++) {
        const coords = chains[ci];
        if (coords.length < 2) continue;

        const centroid = calculateCentroid(coords);
        const lengthMiles = (ci === 0 && tags.distance)
          ? parseFloat(tags.distance) * 0.000621371
          : calculateLengthMiles(coords);

        // For relations with multiple chains, append /chain-N to make unique external_ids
        const externalId = chains.length === 1
          ? `${element.type}/${element.id}`
          : `${element.type}/${element.id}/chain-${ci}`;

        const trail = {
          name: tags.name,
          description: tags.description || tags.note || null,
          difficulty: mapDifficulty(tags),
          length_miles: Math.round(lengthMiles * 100) / 100,
          route_type: tags.roundtrip === 'yes' ? 'loop' : null,
          surface_type: tags.surface || null,
          geometry: `SRID=4326;LINESTRING(${coords.map((c) => `${c[0]} ${c[1]}`).join(',')})`,
          center_point: `SRID=4326;POINT(${centroid[0]} ${centroid[1]})`,
          source: 'osm' as const,
          external_id: externalId,
          source_data: tags,
          pet_friendly: tags.dog === 'yes' ? true : tags.dog === 'no' ? false : null,
          water_available: tags.drinking_water === 'yes' ? true : null,
          maintained_by: tags.operator || null,
          state: stateCode,
          last_synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('trails')
          .upsert(trail, { onConflict: 'source,external_id' });

        if (error) {
          console.error(`  Error inserting ${trail.name}:`, error.message);
          skipped++;
        } else {
          created++;
        }
      }
    }

    console.log(`  Done: ${created} created/updated, ${skipped} skipped`);

    // Update sync log
    if (logEntry) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          trails_fetched: elements.length,
          trails_created: created,
          trails_updated: updated,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`  Failed to sync ${stateCode}:`, errorMessage);
    if (logEntry) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }
  }
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf('--state');
  const limitIdx = args.indexOf('--limit');

  const state = stateIdx >= 0 ? args[stateIdx + 1]?.toUpperCase() : null;
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : undefined;

  if (state) {
    await syncState(state, limit);
  } else {
    // Sync all states
    console.log('Syncing all states...');
    for (const stateCode of Object.keys(STATE_BBOXES)) {
      await syncState(stateCode, limit);
      // Pause between states to be kind to the Overpass API
      console.log('  Waiting 10s before next state...');
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log('\nSync complete!');
}

main().catch(console.error);
