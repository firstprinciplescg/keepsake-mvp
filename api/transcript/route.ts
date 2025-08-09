import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if(!sessionId) return new NextResponse('sessionId required', { status: 400 });

  const { data: tr, error } = await supabaseAdmin.from('transcripts').select('id, text, segments').eq('session_id', sessionId).single();
  if(error) return new NextResponse(error.message, { status: 404 });
  return NextResponse.json(tr);
}

export async function PATCH(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const { transcriptId, text } = body || {};
  if(!transcriptId || typeof text !== 'string') return new NextResponse('transcriptId and text required', { status: 400 });

  const { error } = await supabaseAdmin.from('transcripts').update({ text }).eq('id', transcriptId);
  if(error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
