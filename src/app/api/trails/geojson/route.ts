import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/trails/geojson?bbox=west,south,east,north
 *
 * Returns trail data as GeoJSON FeatureCollection for map rendering.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bboxParam = searchParams.get('bbox');

  let west = -180, south = -90, east = 180, north = 90;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      [west, south, east, north] = parts;
    }
  }

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('trails_as_geojson', {
      bbox_west: west,
      bbox_south: south,
      bbox_east: east,
      bbox_north: north,
      max_results: 500,
    });

    if (error) {
      console.error('GeoJSON query error:', error);
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
      });
    }

    // Filter out parking lots, very short segments, and non-trail features
    const PARKING_PATTERNS = /parking|lot\b/i;
    const MIN_LENGTH_MILES = 0.1;

    const geojson = data || { type: 'FeatureCollection', features: [] };
    if (geojson.features) {
      geojson.features = geojson.features.filter((f: { properties: { name?: string; length_miles?: number } }) => {
        const name = f.properties?.name || '';
        const length = f.properties?.length_miles ?? 999;
        // Exclude parking areas and very short segments
        if (PARKING_PATTERNS.test(name)) return false;
        if (length < MIN_LENGTH_MILES) return false;
        return true;
      });
    }

    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('GeoJSON endpoint error:', err);
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }
}
