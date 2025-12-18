// ABOUTME: CORS middleware for Chrome extension plugin endpoints
// ABOUTME: Allows chrome-extension:// origins to access plugin APIs with credentials

import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS configuration for Chrome extension plugin endpoints
 * Allows requests from chrome-extension:// origins with credentials
 */
export function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') || '';

  // Allow chrome-extension:// origins and localhost for development
  const allowedOrigins = [
    /^chrome-extension:\/\/[a-z]+$/,
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/.*\.vercel\.app$/,
  ];

  const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle OPTIONS preflight requests for CORS
 */
export function handleCorsPrelight(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }
  return null;
}

/**
 * Wrap a NextResponse with CORS headers
 */
export function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const headers = corsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
