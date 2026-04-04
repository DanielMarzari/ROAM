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
  PA: [-80.52, 39.72, -74.69, 42.27],
  CA: [-124.48, 32.53, -114.13, 42.01],
  CO: [-109.06, 36.99, -102.04, 41.00],
  WA: [-124.85, 45.54, -116.92, 49.00],
  OR: [-124.57, 41.99, -116.46, 46.29],
  UT: [-114.05, 36.99, -109.04, 42.00],
  AZ: [-114.82, 31.33, -109.04, 37.00],
  MT: [-116.05, 44.36, -104.04, 49.00],
  NY: [-79.76, 40.50, -71.86, 45.02],
  NC: [-84.32, 33.84, -75.46, 36.59],
  TN: [-90.31, 34.98, -81.65, 36.68],
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
 * Convert an Overpass element to a trail geometry (LineString coordinates).
 * For relations, properly chains connected member segments and returns
 * the longest connected chain (avoids criss-cross artifacts).
 */
function extractGeometry(element: OverpassElement): [number, number][] | null {
  // Simple way — just return its geometry
  if (element.geometry && element.geometry.length >= 2) {
    return element.geometry.map((p) => [p.lon, p.lat]);
  }

  // Relation — extract each member as a separate segment, then chain them
  if (element.members) {
    const segments: [number, number][][] = [];
    for (const member of element.members) {
      if (member.geometry && member.geometry.length >= 2) {
        segments.push(member.geometry.map((p) => [p.lon, p.lat]));
      }
    }
    if (segments.length === 0) return null;

    const chains = chainSegments(segments);
    if (chains.length === 0) return null;

    // Return the longest connected chain
    const longest = chains.reduce((a, b) => a.length > b.length ? a : b);
    if (longest.length >= 2) return longest;
  }

  return null;
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

      const coords = extractGeometry(element);
      if (!coords || coords.length < 2) { skipped++; continue; }

      const centroid = calculateCentroid(coords);
      const lengthMiles = tags.distance
        ? parseFloat(tags.distance) * 0.000621371
        : calculateLengthMiles(coords);

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
        external_id: `${element.type}/${element.id}`,
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
