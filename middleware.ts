import { NextRequest, NextResponse } from 'next/server';

export const config = { matcher: ['/session/:path*'] };

export default function middleware(req: NextRequest){
  const cookie = req.cookies.get('kp_session');
  if(!cookie){
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
