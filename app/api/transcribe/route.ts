// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai, TRANSCRIPTION_MODEL } from '@/lib/openai';

export const runtime = 'nodejs';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

type TranscribeBody = {
  sessionId?: string;   // we'll look up the audio key if provided
  audioKey?: string;    // Supabase Storage key, e.g. "<projectId>/<timestamp>-file.mp3"
  path?: string;        // alias for audioKey
};

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let sessionId: string | undefined;
  let audioKey: string | undefined;

  try {
    const body = (await req.json().catch(() => ({}))) as TranscribeBody;

    sessionId = body?.sessionId || new URL(req.url).searchParams.get('sessionId') || undefined;
    audioKey = body?.audioKey || body?.path || undefined;

    // If we were given a sessionId, fetch the storage key from DB
    if (!audioKey && sessionId) {
      const { data: s, error: se } = await supabaseAdmin
        .from('sessions')
        .select('audio_url')
        .eq('id', sessionId)
        .single();
      if (se || !s) throw se || new Error('Session not found');
      if (!s.audio_url) throw new Error('No audio uploaded for this session');
      audioKey = s.audio_url as string;
    }

    if (!audioKey) {
      return NextResponse.json(
        { error: 'Provide either "sessionId" or an "audioKey"/"path".' },
        { status: 400 }
      );
    }

    // Sign a short-lived URL for the private object
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage.from(AUDIO_BUCKET)
      .createSignedUrl(audioKey, 600); // 10 minutes
    if (signErr || !signed?.signedUrl) {
      throw signErr || new Error('Failed to sign audio URL');
    }

    // ✅ Safe debug log goes right after signing (don’t log the URL itself)
    console.debug('[transcribe] signed url created', {
      hasUrl: !!signed?.signedUrl,
      urlLength: signed?.signedUrl?.length || 0,
      audioBucket: AUDIO_BUCKET,
      audioKey,
      sessionId,
    });

    // Fetch the bytes using the signed URL
    const fileRes = await fetch(signed.signedUrl, { cache: 'no-store' });
    if (!fileRes.ok) throw new Error(`Failed to fetch audio (${fileRes.status})`);

    const ab = await fileRes.arrayBuffer();
    const filename = audioKey.split('/').pop() || 'audio.mp3';
    const contentType = fileRes.headers.get('content-type') || 'audio/mpeg';

    // Node 18+/20+ has Blob/File via undici
    const blob = new Blob([ab], { type: contentType });
    const file = new File([blob], filename, { type: contentType });

    // Transcribe with ev3 (supports "json" or "text", not "verbose_json")
    const tr: any = await openai.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL,   // set OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe-api-ev3
      file,
      response_format: 'json',
      temperature: 0,
    } as any);

    const text = tr?.text ?? tr?.output_text ?? '';
    if (!text) throw new Error('Empty transcription result');

    // Insert transcript
    const { data: inserted, error: tErr } = await supabaseAdmin
      .from('transcripts')
      .insert({
        session_id: sessionId ?? null,
        text,
        segments: [], // ev3 doesn’t return segment timings
      })
      .select('id')
      .single();
    if (tErr) throw tErr;

    // Link to session if applicable
    if (sessionId) {
      const { error: ue } = await supabaseAdmin
        .from('sessions')
        .update({ transcript_id: inserted.id })
        .eq('id', sessionId);
      if (ue) throw ue;
    }

    return NextResponse.json({ transcriptId: inserted.id });
  } catch (e: any) {
    console.error('[app/api/transcribe] error', {
      message: e?.message,
      audioBucket: AUDIO_BUCKET,
      audioKey,
      sessionId,
    });
    return new NextResponse(e?.message || 'Transcription failed', { status: 500 });
  }
}
