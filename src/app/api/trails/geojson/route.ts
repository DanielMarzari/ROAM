import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Street/road suffix patterns — if a name ends with these, it's not a trail
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

interface TrailRow {
  id: string;
  name: string;
  difficulty: string | null;
  length_miles: number;
  elevation_gain_ft: number | null;
  route_type: string | null;
  region: string | null;
  bbox_west: number;
  bbox_south: number;
  bbox_east: number;
  bbox_north: number;
}

/**
 * GET /api/trails/geojson?bbox=west,south,east,north
 * Returns lightweight trail metadata (no geometry).
 * Geometry is fetched separately via /api/trails/geometry.
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
      return NextResponse.json(
        { trails: [], _error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();

    const { data: rows, error } = await supabase.rpc('trails_in_bbox', {
      vp_west: west,
      vp_south: south,
      vp_east: east,
      vp_north: north,
      max_results: maxResults,
      min_length_miles: minLength,
    });

    if (error) {
      console.error('[ROAM] Trail query error:', error);
      return NextResponse.json(
        { trails: [], _error: error.message },
        { status: 500 }
      );
    }

    // Filter non-trails and build lightweight response
    const trails = ((rows as TrailRow[]) || [])
      .filter(r => isTrail(r.name || '') && (r.length_miles ?? 0) >= minLength)
      .map(r => ({
        id: r.id,
        name: r.name,
        difficulty: r.difficulty,
        length_miles: r.length_miles,
        elevation_gain_ft: r.elevation_gain_ft,
        route_type: r.route_type,
        region: r.region,
        bbox: [r.bbox_west, r.bbox_south, r.bbox_east, r.bbox_north],
      }));

    return NextResponse.json({ trails }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[ROAM] Trail endpoint error:', err);
    return NextResponse.json(
      { trails: [], _error: String(err) },
      { status: 500 }
    );
  }
}
