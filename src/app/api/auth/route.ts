import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'roam2026';
const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * POST /api/auth
 * Body: { password: string }
 * Returns session token in httpOnly cookie if password matches
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || password !== AUTH_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const sessionToken = randomUUID();
    const response = NextResponse.json(
      { success: true, message: 'Authenticated' },
      { status: 200 }
    );

    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY / 1000, // Convert to seconds
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth
 * Returns whether current session is valid
 */
export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('session_token');

    if (!session || !session.value) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { authenticated: true },
      { status: 200 }
    );
  } catch (err) {
    console.error('Auth check error:', err);
    return NextResponse.json(
      { authenticated: false },
      { status: 200 }
    );
  }
}
