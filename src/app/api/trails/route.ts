import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/trails?query=...&difficulty=easy,moderate&min_length=1&max_length=10&limit=50&offset=0
 *
 * Returns trail list with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('query') || '';
  const difficulties = searchParams.get('difficulty')?.split(',').filter(Boolean) || [];
  const minLength = searchParams.get('min_length') ? Number(searchParams.get('min_length')) : null;
  const maxLength = searchParams.get('max_length') ? Number(searchParams.get('max_length')) : null;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);
  const offset = Number(searchParams.get('offset') || 0);

  try {
    const supabase = createServiceClient();

    let dbQuery = supabase
      .from('trails')
      .select('id, name, description, difficulty, length_miles, elevation_gain_ft, elevation_loss_ft, route_type, surface_type, state, source', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    if (query) {
      dbQuery = dbQuery.ilike('name', `%${query}%`);
    }

    if (difficulties.length > 0) {
      dbQuery = dbQuery.in('difficulty', difficulties);
    }

    if (minLength !== null) {
      dbQuery = dbQuery.gte('length_miles', minLength);
    }

    if (maxLength !== null) {
      dbQuery = dbQuery.lte('length_miles', maxLength);
    }

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error('Trail search error:', error);
      return NextResponse.json({ trails: [], total: 0 });
    }

    return NextResponse.json({
      trails: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Trail API error:', err);
    return NextResponse.json({ trails: [], total: 0 }, { status: 500 });
  }
}
