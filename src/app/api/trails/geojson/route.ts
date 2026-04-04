import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/trails/geojson?bbox=west,south,east,north
 *
 * Returns trail data as GeoJSON FeatureCollection for map rendering.
 * Filters out parking lots, sidewalks, and very short segments.
 * Enriches features with region for sidebar grouping.
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

    // 1. Get GeoJSON from spatial RPC
    const { data, error } = await supabase.rpc('trails_as_geojson', {
      bbox_west: west,
      bbox_south: south,
      bbox_east: east,
      bbox_north: north,
      max_results: 500,
    });

    if (error) {
      console.error('GeoJSON query error:', error);
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    const geojson = data || { type: 'FeatureCollection', features: [] };

    // 2. Fetch region info for these trails (supplementary query)
    if (geojson.features?.length > 0) {
      const trailIds = geojson.features.map((f: { properties: { id: string } }) => f.properties?.id).filter(Boolean);

      if (trailIds.length > 0) {
        const { data: regionData } = await supabase
          .from('trails')
          .select('id, region')
          .in('id', trailIds);

        if (regionData) {
          const regionMap = new Map(regionData.map((r: { id: string; region: string }) => [r.id, r.region]));
          for (const feature of geojson.features) {
            if (feature.properties?.id) {
              feature.properties.region = regionMap.get(feature.properties.id) || null;
            }
          }
        }
      }
    }

    // 3. Filter out non-trail features
    const EXCLUDE_PATTERNS = /parking|sidewalk|pathway\b|boulevard\b/i;
    const EXCLUDE_SURFACES = new Set(['concrete', 'asphalt', 'paved']);
    const MIN_LENGTH_MILES = 0.1;

    if (geojson.features) {
      geojson.features = geojson.features.filter((f: { properties: Record<string, unknown> }) => {
        const name = (f.properties?.name as string) || '';
        const length = (f.properties?.length_miles as number) ?? 999;

        // Exclude parking areas and very short segments
        if (EXCLUDE_PATTERNS.test(name)) return false;
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
