import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
    const db = getDb();

    const rows = db.prepare(`
      SELECT id, name, difficulty, length_miles, elevation_gain_ft, route_type, region,
             bbox_west, bbox_south, bbox_east, bbox_north
      FROM trails
      WHERE bbox_west IS NOT NULL
        AND bbox_east >= ? AND bbox_west <= ?
        AND bbox_north >= ? AND bbox_south <= ?
        AND length_miles >= ?
      ORDER BY length_miles DESC
      LIMIT ?
    `).all(west, east, south, north, minLength, maxResults) as TrailRow[];

    // Filter non-trails and build lightweight response
    const trails = (rows || [])
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
