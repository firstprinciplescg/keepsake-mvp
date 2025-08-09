// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai, TRANSCRIPTION_MODEL } from '@/lib/openai';
import OpenAI from 'openai';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  // for logging in catch
  let audioKey: string | undefined;
  let sessionId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    sessionId = body?.sessionId || new URL(req.url).searchParams.get('sessionId') || undefined;
    if (!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // Lookup session + audio
    const { data: s, error: se } = await supabaseAdmin
      .from('sessions')
      .select('id, audio_url') // audio_url is actually a storage key
      .eq('id', sessionId)
      .single();
    if (se || !s) throw se || new Error('Session not found');
    if (!s.audio_url) throw new Error('No audio uploaded for this session');

    audioKey = s.audio_url;

    // Create a short-lived signed URL to the private audio file
    const { data: signed, error: sue } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(audioKey, 600); // 10 minutes
    if (sue || !signed?.signedUrl) throw sue || new Error('Failed to sign audio URL');

    // Fetch audio bytes
    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`Failed to fetch audio (${resp.status})`);
    const ab = await resp.arrayBuffer();

    // Turn buffer into a file for OpenAI SDK
    const filename = audioKey.split('/').pop() || 'audio.mp3';
    const file = await OpenAI.toFile(Buffer.from(ab), filename);

    // Call OpenAI Transcriptions API (ev3)
    const result = await openai.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL, // "gpt-4o-mini-transcribe-api-ev3"
      file,
      response_format: 'json',              // <- ev3 supports "json" or "text"
      // timestamp_granularities: NOT supported by ev3
    } as any);

    const text =
      (result as any).text ??
      (result as any).output_text ??
      '';

    // Insert transcript
    const { data: tr, error: te } = await supabaseAdmin
      .from('transcripts')
      .insert({ session_id: sessionId, text, segments: [] }) // no segments with ev3
      .select('id')
      .single();
    if (te) throw te;

    // Link transcript to session
    const { error: ue } = await supabaseAdmin
      .from('sessions')
      .update({ transcript_id: tr.id })
      .eq('id', sessionId);
    if (ue) throw ue;

    return NextResponse.json({ transcriptId: tr.id });
  } catch (e: any) {
    // Safe, contextual logging
    console.error('[transcribe] error', {
      message: e?.message,
      audioBucket: AUDIO_BUCKET,
      audioKey,              // storage key, safe to log
      sessionId,
    });
    return new NextResponse(e?.message || 'Transcription failed', { status: 500 });
  }
}
