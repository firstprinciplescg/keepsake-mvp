import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe-api-ev3';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    // 1) Load the session to get the audio URL
    const { data: session, error: sErr } = await supabaseAdmin
      .from('sessions')
      .select('id, audio_url, project_id')
      .eq('id', sessionId)
      .single();
    if (sErr || !session) return new NextResponse('session not found', { status: 404 });

    if (!session.audio_url) {
      return new NextResponse('audio_url missing for session', { status: 400 });
    }

    // 2) Download audio as a Blob (Node 20 supports Blob/File)
    const audioRes = await fetch(session.audio_url);
    if (!audioRes.ok) throw new Error(`fetch audio failed: ${audioRes.status}`);
    const audioBlob = await audioRes.blob();

    // 3) Choose response_format based on model
    const isEv3 = /transcribe-api/i.test(MODEL);
    const response_format: 'json' | 'text' = isEv3 ? 'json' : 'text';

    // 4) Transcribe
    const tr = await openai.audio.transcriptions.create({
      model: MODEL,
      file: new File([audioBlob], 'audio', { type: audioBlob.type || 'audio/mpeg' }),
      response_format,
      // language: 'en', // optional
      // temperature: 0.2, // optional
    });

    // 5) Normalize result
    // ev3 'json' -> { text: string }
    // Whisper 'text' -> string
    const text = typeof tr === 'string' ? tr : (tr as any).text || '';

    // (MVP) we store text only; timestamps JSON can be null for ev3
    const timestamps = null;

    // 6) Upsert transcript row
    const { data: transcript, error: tErr } = await supabaseAdmin
      .from('transcripts')
      .upsert(
        {
          session_id: session.id,
          text,
          timestamps, // null on ev3
          tenant_id: null
        },
        { onConflict: 'session_id' }
      )
      .select('*')
      .single();
    if (tErr) throw tErr;

    return NextResponse.json({ transcriptId: transcript.id });
  } catch (e: any) {
    return new NextResponse(e?.message || 'transcription failed', { status: 400 });
  }
}
