import { NextRequest, NextResponse } from 'next/server';
import { exchangeTokenForSession } from '@/lib/token';

export async function GET(req: NextRequest, { params }: { params: { token: string } }){
  const token = params.token;
  const result = await exchangeTokenForSession(token);
  if(!result.ok){
    return new NextResponse('Invalid or expired link', { status: 400 });
  }
  const res = NextResponse.redirect(new URL(`/session/${result.projectId}/upload`, req.url));
  res.cookies.set('kp_session', result.sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14 // 14 days
  });
  return res;
}
