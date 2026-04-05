import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wkx = require('wkx');

// Street/road suffix patterns — if a name ends with these, it's not a trail
// UNLESS it also contains trail-like words (Trail, Path, Loop, etc.)
const STREET_SUFFIXES = /\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|place|pl|pike|highway|hwy|way)\s*$/i;
const TRAIL_WORDS = /trail|path|loop|hike|trek|ridge|run|creek|falls|mountain|hollow|gap|knob|summit|overlook|greenway/i;
const EXCLUDE_NAMES = /parking|sidewalk|^abandoned\s/i;
const MIN_LENGTH_MILES = 0.1;

function isTrail(name: string): boolean {
  if (!name) return false;
  if (EXCLUDE_NAMES.test(name)) return false;
  if (TRAIL_WORDS.test(name)) return true;
  if (STREET_SUFFIXES.test(name.trim())) return false;
  return true;
}

/** Decode WKB hex string to GeoJSON geometry object */
function wkbToGeoJSON(wkbHex: string): GeoJSON.Geometry | null {
  try {
    const geom = wkx.Geometry.parse(Buffer.from(wkbHex, 'hex'));
    return geom.toGeoJSON() as GeoJSON.Geometry;
  } catch {
    return null;
  }
}

interface TrailRow {
  id: string;
  name: string;
  difficulty: string | null;
  length_miles: number;
  elevation_gain_ft: number | null;
  route_type: string | null;
  bbox_west: number;
  bbox_south: number;
  bbox_east: number;
  bbox_north: number;
  geom: string; // WKB hex
}

/**
 * GET /api/trails/geojson?bbox=west,south,east,north
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bboxParam = searchParams.get('bbox');

  const minLengthParam = searchParams.get('min_length');
  const minLength = minLengthParam ? parseFloat(minLengthParam) : MIN_LENGTH_MILES;
  const maxResultsParam = searchParams.get('max_results');
  const maxResults = maxResultsParam ? Math.min(parseInt(maxResultsParam), 2000) : 2000;

  let west = -180, south = -90, east = 180, north = 90;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      [west, south, east, north] = parts;
    }
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('[ROAM] Missing env vars:', {
        hasUrl: !!url,
        hasServiceKey: !!key,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });
      return NextResponse.json(
        { type: 'FeatureCollection', features: [], _error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();

    // RPC returns raw rows — DB does zero geometry serialization (34ms)
    const { data: rows, error } = await supabase.rpc('trails_in_bbox', {
      vp_west: west,
      vp_south: south,
      vp_east: east,
      vp_north: north,
      max_results: maxResults,
      min_length_miles: minLength,
    });

    if (error) {
      console.error('[ROAM] GeoJSON query error:', error);
      return NextResponse.json(
        { type: 'FeatureCollection', features: [], _error: error.message },
        { status: 500 }
      );
    }

    // Build GeoJSON FeatureCollection from raw rows, decoding WKB client-side
    const features: GeoJSON.Feature[] = [];
    const trailIds: string[] = [];

    for (const row of (rows as TrailRow[]) || []) {
      if (!row.geom) continue;
      if (!isTrail(row.name || '')) continue;
      if ((row.length_miles ?? 0) < minLength) continue;

      const geometry = wkbToGeoJSON(row.geom);
      if (!geometry) continue;

      trailIds.push(row.id);
      features.push({
        type: 'Feature',
        id: row.id,
        geometry,
        properties: {
          id: row.id,
          name: row.name,
          difficulty: row.difficulty,
          length_miles: row.length_miles,
          elevation_gain_ft: row.elevation_gain_ft,
          route_type: row.route_type,
        },
      });
    }

    // Enrich with region for sidebar grouping
    if (trailIds.length > 0) {
      const { data: regionData } = await supabase
        .from('trails')
        .select('id, region')
        .in('id', trailIds);

      if (regionData) {
        const regionMap = new Map(
          regionData.map((r: { id: string; region: string }) => [r.id, r.region])
        );
        for (const feature of features) {
          if (feature.properties?.id) {
            feature.properties.region = regionMap.get(feature.properties.id) || null;
          }
        }
      }
    }

    // Already sorted by length DESC from the RPC
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    return NextResponse.json(geojson, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[ROAM] GeoJSON endpoint error:', err);
    return NextResponse.json(
      { type: 'FeatureCollection', features: [], _error: String(err) },
      { status: 500 }
    );
  }
}
