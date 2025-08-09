import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(()=> ({}));
  const { projectId, path, durationSeconds } = body || {};
  if(!projectId || !path) return new NextResponse('projectId and path required', { status: 400 });

  // get interviewee for this project
  const { data: iv, error: ive } = await supabaseAdmin
    .from('interviewees')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if(ive) return new NextResponse(ive.message, { status: 500 });

  const { data: s, error: se } = await supabaseAdmin
    .from('sessions')
    .insert({ project_id: projectId, interviewee_id: iv?.id || null, audio_url: path, duration_seconds: durationSeconds || null })
    .select('id')
    .single();
  if(se) return new NextResponse(se.message, { status: 500 });

  return NextResponse.json({ sessionId: s.id });
}
