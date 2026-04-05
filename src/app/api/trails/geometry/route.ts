import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface GeomRow {
  trail_id: string;
  geom: GeoJSON.Geometry & { crs?: unknown };
}

/**
 * POST /api/trails/geometry
 * Body: { ids: string[] }
 * Returns GeoJSON FeatureCollection with geometry for requested trail IDs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { type: 'FeatureCollection', features: [] },
        { status: 200 }
      );
    }

    // Cap at 200 IDs per request
    const limitedIds = ids.slice(0, 200);

    const supabase = createServiceClient();

    const { data: rows, error } = await supabase.rpc('trail_geometries_by_ids', {
      trail_ids: limitedIds,
    });

    if (error) {
      console.error('[ROAM] Geometry query error:', error);
      return NextResponse.json(
        { type: 'FeatureCollection', features: [], _error: error.message },
        { status: 500 }
      );
    }

    // PostgREST auto-parses geometry to GeoJSON — strip crs wrapper
    const features: GeoJSON.Feature[] = ((rows as GeomRow[]) || [])
      .filter(r => r.geom)
      .map(r => ({
        type: 'Feature' as const,
        id: r.trail_id,
        geometry: {
          type: r.geom.type,
          coordinates: (r.geom as { coordinates: unknown }).coordinates,
        } as GeoJSON.Geometry,
        properties: { id: r.trail_id },
      }));

    return NextResponse.json(
      { type: 'FeatureCollection', features },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    console.error('[ROAM] Geometry endpoint error:', err);
    return NextResponse.json(
      { type: 'FeatureCollection', features: [], _error: String(err) },
      { status: 500 }
    );
  }
}
