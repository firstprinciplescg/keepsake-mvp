import { NextRequest, NextResponse } from 'next/server';
import { openai, OUTLINE_MODEL } from '@/lib/openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { sessionId } = await req.json();
    if(!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // Fetch transcript + interviewee metadata
    const { data: sess, error: se } = await supabaseAdmin.from('sessions').select('id, project_id, transcript_id, interviewee_id').eq('id', sessionId).single();
    if(se || !sess) throw se || new Error('Session not found');

    const { data: tr, error: te } = await supabaseAdmin.from('transcripts').select('text').eq('id', sess.transcript_id).single();
    if(te || !tr) throw te || new Error('Transcript missing');

    const { data: iv, error: ie } = await supabaseAdmin.from('interviewees').select('name, themes, output_prefs').eq('id', sess.interviewee_id).single();
    if(ie || !iv) throw ie || new Error('Interviewee missing');

    const sys = 'You are a memoir outline generator. Given a transcript and metadata, produce JSON: {"chapters":[{"title":"","bullets":[""]}]}. Aim for 5–7 chapters focused on core life moments.';
    const user = `Transcript: ${tr.text}\nMetadata: ${JSON.stringify(iv)}`;

    const chat = await openai.chat.completions.create({
      model: OUTLINE_MODEL,
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.3
    });
    const content = chat.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    const { data: out, error: oe } = await supabaseAdmin.from('outlines').insert({ session_id: sess.id, structure: parsed, approved: false }).select('*').single();
    if(oe) throw oe;
    return NextResponse.json({ outlineId: out.id, structure: out.structure });
  }catch(e:any){
    return new NextResponse(e.message || 'Failed to generate outline', { status: 500 });
  }
}
