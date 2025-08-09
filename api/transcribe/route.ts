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

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId =
      body?.sessionId || new URL(req.url).searchParams.get('sessionId');
    if (!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // Lookup session + audio
    const { data: s, error: se } = await supabaseAdmin
      .from('sessions')
      .select('id, audio_url')
      .eq('id', sessionId)
      .single();
    if (se || !s) throw se || new Error('Session not found');
    if (!s.audio_url) throw new Error('No audio uploaded for this session');

    // Create a short-lived signed URL to the private audio file
    const { data: signed, error: sue } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(s.audio_url, 60);
    if (sue || !signed?.signedUrl) throw sue || new Error('Failed to sign audio URL');

    // Fetch audio bytes
    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`Failed to fetch audio (${resp.status})`);
    const ab = await resp.arrayBuffer();

    // Turn buffer into a file for OpenAI SDK
    const filename = s.audio_url.split('/').pop() || 'audio.m4a';
    const file = await OpenAI.toFile(Buffer.from(ab), filename);

    // Call OpenAI Transcriptions API
    const result = await openai.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL,
      file,
      // When supported, return segments too
      response_format: 'json',
      timestamp_granularities: ['segment'] as any,
    } as any);

    const text = (result as any).text || '';
    const segments = (result as any).segments || [];

    // Insert transcript
    const { data: tr, error: te } = await supabaseAdmin
      .from('transcripts')
      .insert({ session_id: sessionId, text, segments })
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
    // Surface the real error text to the client during MVP
    return new NextResponse(e?.message || 'Transcription failed', { status: 500 });
  }
}
