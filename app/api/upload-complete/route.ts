// app/api/upload-complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

type Body = {
  projectId: string;
  path: string;                 // Supabase Storage key (e.g., "<projectId>/<ts>-file.mp3")
  durationSeconds?: number | null;
};

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let projectId: string | undefined;
  let audioKey: string | undefined;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    projectId = body?.projectId || undefined;
    audioKey = body?.path || undefined;
    const durationSeconds =
      typeof body?.durationSeconds === 'number' ? body?.durationSeconds : null;

    if (!projectId || !audioKey) {
      return new NextResponse('projectId and path required', { status: 400 });
    }

    // Try to link to the first interviewee for this project (if any)
    const { data: iv, error: ive } = await supabaseAdmin
      .from('interviewees')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ive) return new NextResponse(ive.message, { status: 500 });

    // Create session row
    const { data: s, error: se } = await supabaseAdmin
      .from('sessions')
      .insert({
        project_id: projectId,
        interviewee_id: iv?.id ?? null,
        audio_url: audioKey,
        duration_seconds: durationSeconds,
      })
      .select('id')
      .single();

    if (se) throw se;

    // Success log
    console.info('[app/api/upload-complete] attached audio', {
      audioBucket: AUDIO_BUCKET,
      audioKey,
      projectId,
      sessionId: s.id,
      durationSeconds,
    });

    return NextResponse.json({ sessionId: s.id });
  } catch (e: any) {
    console.error('[app/api/upload-complete] error', {
      message: e?.message,
      audioBucket: AUDIO_BUCKET,
      audioKey,
      projectId,
    });
    return new NextResponse(e?.message || 'Upload complete failed', { status: 500 });
  }
}
