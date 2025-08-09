// app/api/session/current/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const projectId = (session as any).projectId;
  const { data: s, error } = await supabaseAdmin
    .from('sessions')
    .select('id, transcript_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({
    projectId,
    sessionId: s?.id || null,
    transcriptId: s?.transcript_id || null,
  });
}
