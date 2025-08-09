import { NextRequest, NextResponse } from 'next/server';
import { exchangeTokenForSession } from '@/lib/token';

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  let token: string | null = null;

  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    token = (fd.get('token') as string) || null;
  } else {
    const body = await req.json().catch(() => ({}));
    token = body?.token ?? null;
  }
  if (!token) return new NextResponse('token required', { status: 400 });

  const result = await exchangeTokenForSession(token); // rotates + cookie
  if (!result.ok) return new NextResponse('Invalid or expired link', { status: 400 });
/*mdm edit*/
const res = NextResponse.redirect(new URL(`/session/${result.projectId}/upload`, req.url), 303);
res.cookies.set('kp_session', result.sessionCookie, {
  httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14
});
return res;
}
