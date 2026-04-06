import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trails/geometry
 * Body: { ids: string[] }
 * Returns empty GeoJSON FeatureCollection.
 *
 * NOTE: Geometry data is not available in SQLite.
 * The map uses OpenTrailMap vector tiles for rendering trail paths.
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

    // Geometry data not available in SQLite
    // Return empty features — map uses vector tiles for rendering
    return NextResponse.json(
      { type: 'FeatureCollection', features: [] },
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
