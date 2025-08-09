import { NextRequest, NextResponse } from 'next/server';
import { openai, DRAFT_MODEL } from '@/lib/openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';

const REGEN_LIMIT = parseInt(process.env.REGEN_LIMIT_PER_CHAPTER || '2', 10);

export async function GET(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const outlineId = searchParams.get('outlineId');
  if(!outlineId) return new NextResponse('outlineId required', { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('draft_chapters')
    .select('id, title, content, regen_count, version, status')
    .eq('outline_id', outlineId)
    .order('title', { ascending: true });
  if(error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ drafts: data || [], regenLimit: REGEN_LIMIT });
}

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { outlineId } = await req.json();
    if(!outlineId) return new NextResponse('outlineId required', { status: 400 });

    const { data: out, error: oe } = await supabaseAdmin.from('outlines').select('id, structure, approved').eq('id', outlineId).single();
    if(oe || !out) throw oe || new Error('Outline missing');

    const chapters = (out.structure?.chapters || []) as any[];
    const createdIds: string[] = [];

    for(const ch of chapters){
      const prompt = `You are a warm, conversational memoir writer. Draft ~300 words for chapter titled "${ch.title}". Use the following bullets as guidance: ${JSON.stringify(ch.bullets || [])}`;
      const chat = await openai.chat.completions.create({
        model: DRAFT_MODEL,
        messages: [{ role:'system', content: 'Write engaging, personal prose in first person when appropriate.' }, { role:'user', content: prompt }],
        temperature: 0.7
      });
      const text = chat.choices[0]?.message?.content || '';
      const { data: dr, error: de } = await supabaseAdmin.from('draft_chapters').insert({ outline_id: outlineId, title: ch.title, content: text, status: 'generated', regen_count: 0, version: 1 }).select('id').single();
      if(de) throw de;
      createdIds.push(dr.id);
    }
    return NextResponse.json({ draftChapterIds: createdIds });
  }catch(e:any){
    return new NextResponse(e.message || 'Failed to generate drafts', { status: 500 });
  }
}

export async function PATCH(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { draftId, accept } = await req.json();
    if(!draftId) return new NextResponse('draftId required', { status: 400 });

    if(accept){
      const { error: ae } = await supabaseAdmin.from('draft_chapters').update({ status: 'accepted' }).eq('id', draftId);
      if(ae) throw ae;
      return NextResponse.json({ ok: true, accepted: true });
    }

    const { data: dr, error: de } = await supabaseAdmin.from('draft_chapters').select('id, title, regen_count, outline_id, version').eq('id', draftId).single();
    if(de || !dr) throw de || new Error('Draft not found');
    if((dr as any).regen_count >= REGEN_LIMIT) return new NextResponse('Regen limit reached', { status: 400 });

    const { data: out, error: oe } = await supabaseAdmin.from('outlines').select('structure').eq('id', (dr as any).outline_id).single();
    if(oe || !out) throw oe || new Error('Outline missing');
    const chapter = (out.structure?.chapters || []).find((c:any)=>c.title===(dr as any).title);

    const prompt = `Regenerate ~300 words for chapter titled "${(dr as any).title}". Bullets: ${JSON.stringify(chapter?.bullets || [])}`;
    const chat = await openai.chat.completions.create({
      model: DRAFT_MODEL,
      messages: [{ role:'system', content: 'Write engaging, personal prose in first person when appropriate.' }, { role:'user', content: prompt }],
      temperature: 0.7
    });
    const text = chat.choices[0]?.message?.content || '';
    const { error: ue } = await supabaseAdmin.from('draft_chapters').update({ content: text, regen_count: (dr as any).regen_count + 1, version: (dr as any).version + 1 }).eq('id', draftId);
    if(ue) throw ue;

    return NextResponse.json({ ok: true });
  }catch(e:any){
    return new NextResponse(e.message || 'Failed to update draft', { status: 500 });
  }
}
