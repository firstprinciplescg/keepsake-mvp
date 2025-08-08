import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const { rating, comment } = await req.json();
  await supabaseAdmin.from('events').insert({ project_id: (session as any).projectId, type: 'feedback', payload: { rating, comment } });
  return NextResponse.json({ ok: true });
}
