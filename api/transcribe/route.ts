import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai } from '@/lib/openai';
import OpenAI from 'openai';

const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { searchParams } = new URL(req.url);
    const sessionId = (await req.json())?.sessionId || searchParams.get('sessionId');
    if(!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // find session
    const { data: s, error: se } = await supabaseAdmin.from('sessions').select('id, project_id, audio_url').eq('id', sessionId).single();
    if(se || !s) throw se || new Error('Session not found');
    if(!s.audio_url) throw new Error('No audio uploaded for this session');

    // get a signed URL to download the audio
    const { data: signed, error: sue } = await supabaseAdmin.storage.from(AUDIO_BUCKET).createSignedUrl(s.audio_url, 60);
    if(sue || !signed?.signedUrl) throw sue || new Error('Failed to sign audio URL');

    // fetch audio bytes
    const resp = await fetch(signed.signedUrl);
    if(!resp.ok) throw new Error(`Failed to fetch audio (${resp.status})`);
    const ab = await resp.arrayBuffer();
    const file = await OpenAI.toFile(Buffer.from(ab), s.audio_url.split('/').pop() || 'audio.m4a');

    // call OpenAI Transcriptions API
    const result = await openai.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL,
      file,
      // Ask for segment-level timestamps when supported
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    } as any);

    // result may include text and segments depending on model
    const text = (result as any).text || '';
    const segments = (result as any).segments || [];

    // insert transcript
    const { data: tr, error: te } = await supabaseAdmin
      .from('transcripts')
      .insert({ session_id: sessionId, text, segments })
      .select('id')
      .single();
    if(te) throw te;

    // link to session
    const { error: ue } = await supabaseAdmin.from('sessions').update({ transcript_id: tr.id }).eq('id', sessionId);
    if(ue) throw ue;

    return NextResponse.json({ transcriptId: tr.id });
  }catch(e:any){
    return new NextResponse(e.message || 'Transcription failed', { status: 500 });
  }
}
