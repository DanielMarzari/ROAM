import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Street/road suffix patterns — if a name ends with these, it's not a trail
// UNLESS it also contains trail-like words (Trail, Path, Loop, etc.)
const STREET_SUFFIXES = /\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|place|pl|pike|highway|hwy|way)\s*$/i;
const TRAIL_WORDS = /trail|path|loop|hike|trek|ridge|run|creek|falls|mountain|hollow|gap|knob|summit|overlook|greenway/i;
const EXCLUDE_NAMES = /parking|sidewalk|^abandoned\s/i;
const MIN_LENGTH_MILES = 0.1;

function isTrail(name: string): boolean {
  if (!name) return false;

  // Always exclude these
  if (EXCLUDE_NAMES.test(name)) return false;

  // If it has trail-like words, keep it regardless
  if (TRAIL_WORDS.test(name)) return true;

  // If it looks like a street name (ends with St, Road, Ave, etc.), filter it
  if (STREET_SUFFIXES.test(name.trim())) return false;

  // Keep everything else
  return true;
}

/**
 * GET /api/trails/geojson?bbox=west,south,east,north
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
      max_results: 2000,
    });

    if (error) {
      console.error('GeoJSON query error:', error);
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    const geojson = data || { type: 'FeatureCollection', features: [] };

    // Enrich with region for sidebar grouping
    if (geojson.features?.length > 0) {
      const trailIds = geojson.features
        .map((f: { properties: { id: string } }) => f.properties?.id)
        .filter(Boolean);

      if (trailIds.length > 0) {
        const { data: regionData } = await supabase
          .from('trails')
          .select('id, region')
          .in('id', trailIds);

        if (regionData) {
          const regionMap = new Map(
            regionData.map((r: { id: string; region: string }) => [r.id, r.region])
          );
          for (const feature of geojson.features) {
            if (feature.properties?.id) {
              feature.properties.region = regionMap.get(feature.properties.id) || null;
            }
          }
        }
      }
    }

    // Filter out non-trail features (streets, parking, short segments)
    if (geojson.features) {
      geojson.features = geojson.features.filter(
        (f: { properties: Record<string, unknown> }) => {
          const name = (f.properties?.name as string) || '';
          const length = (f.properties?.length_miles as number) ?? 999;
          if (length < MIN_LENGTH_MILES) return false;
          return isTrail(name);
        }
      );
    }

    return NextResponse.json(geojson, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('GeoJSON endpoint error:', err);
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }
}
