import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const projectId = (session as any).projectId;
  await supabaseAdmin.from('projects').update({ status: 'delete_pending' }).eq('id', projectId);
  return NextResponse.json({ ok: true });
}
