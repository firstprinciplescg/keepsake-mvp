// app/api/outline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai } from '@/lib/openai';

export const runtime = 'nodejs';

// You can override this in Vercel env if desired
const OUTLINE_MODEL = process.env.OPENAI_OUTLINE_MODEL || 'gpt-4o-mini';

// ---- Helpers ----
function safeLog(ctx: any) {
  console.error('[app/api/outline] error', ctx);
}

function normalizeOutline(obj: any) {
  // Expecting: { chapters: [{ title: string, bullets: string[] }, ...] }
  if (!obj || typeof obj !== 'object') return { chapters: [] };
  const chapters = Array.isArray(obj.chapters) ? obj.chapters : [];
  return {
    chapters: chapters.map((c) => ({
      title: String(c?.title ?? ''),
      bullets: Array.isArray(c?.bullets)
        ? c.bullets.map((b) => String(b ?? '')).filter(Boolean)
        : String(c?.bullets ?? '')
            .split('\n')
            .map((b) => b.trim())
            .filter(Boolean),
    })),
  };
}

// ---- GET /api/outline?sessionId=... OR ?outlineId=... ----
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

    // sessionId case: return most recent
    const { data, error } = await supabaseAdmin
      .from('outlines')
      .select('id, outline')
      .eq('session_id', sessionId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return new NextResponse('Not found', { status: 404 });
    return NextResponse.json({ id: data.id, outline: data.outline });
  } catch (e: any) {
    safeLog({ message: e?.message });
    return new NextResponse(e?.message || 'Outline fetch failed', { status: 500 });
