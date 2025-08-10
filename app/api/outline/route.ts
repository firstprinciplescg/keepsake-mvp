// app/api/outline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai } from '@/lib/openai';

export const runtime = 'nodejs';

// You can override via env
const OUTLINE_MODEL = process.env.OPENAI_OUTLINE_MODEL || 'gpt-4o-mini';

// ---------- helpers ----------
function safeLog(ctx: any) {
  console.error('[app/api/outline] error', ctx);
}

function normalizeOutline(obj: any) {
  // Expecting: { chapters: [{ title: string, bullets: string[] }, ...] }
  if (!obj || typeof obj !== 'object') return { chapters: [] };
  const chapters = Array.isArray((obj as any).chapters) ? (obj as any).chapters : [];
  return {
    chapters: chapters.map((c: any) => ({
      title: String(c?.title ?? ''),
      bullets: Array.isArray(c?.bullets)
        ? (c.bullets as any[]).map((b) => String(b ?? '')).filter(Boolean)
        : String(c?.bullets ?? '')
            .split('\n')
            .map((b) => b.trim())
            .filter(Boolean),
    })),
  };
}

// ---------- GET /api/outline?sessionId=... OR ?outlineId=... ----------
export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('kp_session')?.value;
    const session = cookie ? await verifySessionCookie(cookie) : null;
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const outlineId = searchParams.get('outlineId');
    const sessionId = searchParams.get('sessionId');

    if (!outlineId && !sessionId) {
      return new NextResponse('outlineId or sessionId required', { status: 400 });
    }

    if (outlineId) {
      const { data, error } = await supabaseAdmin
        .from('outlines')
        .select('id, outline')
        .eq('id', outlineId)
        .single();
      if (error || !data) return new NextResponse('Not found', { status: 404 });
      return NextResponse.json({ id: data.id, outline: data.outline });
    }

    // sessionId case
    const { data, error } = await supabaseAdmin
      .from('outlines')
      .select('id, outline')
      .eq('session_id', sessionId as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return new NextResponse('Not found', { status: 404 });
    return NextResponse.json({ id: data.id, outline: data.outline });
  } catch (e: any) {
    safeLog({ message: e?.message });
    return new NextResponse(e?.message || 'Outline fetch failed', { status: 500 });
  }
}

// ---------- POST /api/outline  { sessionId } ----------
export async function POST(req: NextRequest) {
  let sessionId: string | undefined;

  try {
    const cookie = req.cookies.get('kp_session')?.value;
    const session = cookie ? await verifySessionCookie(cookie) : null;
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json().catch(() => ({}));
    sessionId = body?.sessionId;
    if (!sessionId) return new NextResponse('sessionId required', { status: 400 });

    // Pull latest transcript text
    const { data: tr, error: te } = await supabaseAdmin
      .from('transcripts')
      .select('text')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (te) throw te;
    if (!tr?.text) return new NextResponse('No transcript for this session', { status: 400 });

    // Build prompt (JSON-mode)
    const sys =
      'You are an editor creating a concise memoir outline. Return ONLY JSON with this schema: {"chapters":[{"title": string, "bullets": string[]}, ...]}. No prose.';
    const user =
      `Transcript:\n"""${tr.text.slice(0, 15000)}"""\n\n` +
      'Create 6–10 chapters. Each title short & evocative. ' +
      'Each chapter: 2–6 bullets (key moments/people/themes).';

    const resp = await openai.chat.completions.create({
      model: OUTLINE_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' } as any,
    });

    const content = resp.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { chapters: [] };
    }
    const outline = normalizeOutline(parsed);

    // Save
    const { data: inserted, error: ie } = await supabaseAdmin
      .from('outlines')
      .insert({ session_id: sessionId, outline })
      .select('id, outline')
      .single();
    if (ie) throw ie;

    return NextResponse.json({ id: inserted.id, outline: inserted.outline });
  } catch (e: any) {
    safeLog({ message: e?.message, sessionId });
    return new NextResponse(e?.message || 'Outline generation failed', { status: 500 });
  }
}

// ---------- PATCH /api/outline  { outlineId, outline } ----------
export async function PATCH(req: NextRequest) {
  let outlineId: string | undefined;

  try {
    const cookie = req.cookies.get('kp_session')?.value;
    const session = cookie ? await verifySessionCookie(cookie) : null;
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json().catch(() => ({}));
    outlineId = body?.outlineId;
    const outline = body?.outline;

    if (!outlineId || !outline) {
      return new NextResponse('outlineId and outline required', { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('outlines')
      .update({ outline })
      .eq('id', outlineId)
      .select('id, outline')
      .single();
    if (error || !data) throw error || new Error('Update failed');

    return NextResponse.json({ id: data.id, outline: data.outline });
  } catch (e: any) {
    safeLog({ message: e?.message, outlineId });
    return new NextResponse(e?.message || 'Outline update failed', { status: 500 });
  }
}
