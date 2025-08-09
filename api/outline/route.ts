import { NextRequest, NextResponse } from 'next/server';
import { openai, OUTLINE_MODEL } from '@/lib/openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';

export async function GET(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if(!sessionId) return new NextResponse('sessionId required', { status: 400 });

  const { data: out, error } = await supabaseAdmin.from('outlines').select('id, structure, approved').eq('session_id', sessionId).single();
  if(error) return new NextResponse(error.message, { status: 404 });
  return NextResponse.json(out);
}

export async function PATCH(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const { outlineId, structure, approved } = body || {};
  if(!outlineId) return new NextResponse('outlineId required', { status: 400 });

  const patch: any = {};
  if(structure) patch.structure = structure;
  if(typeof approved === 'boolean') { patch.approved = approved; if(approved) patch.approved_at = new Date().toISOString(); }

  const { error } = await supabaseAdmin.from('outlines').update(patch).eq('id', outlineId);
  if(error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { sessionId } = await req.json();
    if(!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // Fetch transcript + interviewee metadata
    const { data: sess, error: se } = await supabaseAdmin.from('sessions').select('id, interviewee_id, transcript_id').eq('id', sessionId).single();
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
    let parsed: any;
    try{ parsed = JSON.parse(content); } catch{ throw new Error('Model returned non-JSON outline. Please retry.'); }

    const { data: existing, error: ge } = await supabaseAdmin.from('outlines').select('id').eq('session_id', sess.id).maybeSingle();
    if(ge) throw ge;
    if(existing){
      const { error: ue } = await supabaseAdmin.from('outlines').update({ structure: parsed, approved: false }).eq('id', existing.id);
      if(ue) throw ue;
      return NextResponse.json({ outlineId: existing.id, structure: parsed });
    } else {
      const { data: out, error: oe } = await supabaseAdmin.from('outlines').insert({ session_id: sess.id, structure: parsed, approved: false }).select('*').single();
      if(oe) throw oe;
      return NextResponse.json({ outlineId: out.id, structure: out.structure });
    }
  }catch(e:any){
    return new NextResponse(e.message || 'Failed to generate outline', { status: 500 });
  }
}
