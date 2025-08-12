// app/api/outline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai } from "@/lib/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";
const OUTLINE_MODEL = process.env.OPENAI_MODEL_OUTLINE || "gpt-4o-mini";

/**
 * GET /api/outline?sessionId=...
 * Returns { outlineId, outline } or 404 if none.
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") || undefined;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const { data: row, error } = await supabaseAdmin
    .from("outlines")
    .select("id, outline, structure")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[outline][GET] error", { message: error.message, sessionId });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const outline = row.outline ?? row.structure ?? [];
  return NextResponse.json({ outlineId: row.id, outline });
}

/**
 * POST /api/outline { sessionId }
 * Generates outline JSON from transcript and upserts it by session.
 */
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // 1) Fetch transcript text
    const { data: tr, error: te } = await supabaseAdmin
      .from("transcripts")
      .select("text")
      .eq("session_id", sessionId)
      .single();
    if (te || !tr?.text) throw new Error("Transcript not found for session");

    const transcriptText = String(tr.text);

    // 2) Ask model for compact JSON outline
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Create a clear, hierarchical book outline from the transcript. Return ONLY compact JSON with parts/chapters/sections. No commentary.",
      },
      { role: "user", content: transcriptText.slice(0, 120_000) },
    ];

    const completion = await openai.chat.completions.create({
      model: OUTLINE_MODEL,
      messages,
      temperature: 0.2,
    });

    let raw = completion.choices[0]?.message?.content?.trim() || "[]";
    if (/^```/m.test(raw)) raw = raw.replace(/```json|```/g, "");
    let outlineJson: any;
    try {
      outlineJson = JSON.parse(raw);
    } catch {
      outlineJson = [];
    }

    // 3) Upsert by session — write both `outline` and legacy `structure` when present
    const payload = { session_id: sessionId, outline: outlineJson, structure: outlineJson };
    let up = await supabaseAdmin
      .from("outlines")
      .upsert(payload, { onConflict: "session_id" })
      .select("id")
      .single();

    // Retry without `structure` if that column doesn't exist in this env
    if (up.error && /column .*structure.* does not exist/i.test(up.error.message)) {
      up = await supabaseAdmin
        .from("outlines")
        .upsert({ session_id: sessionId, outline: outlineJson }, { onConflict: "session_id" })
        .select("id")
        .single();
    }

    if (up.error || !up.data?.id) throw up.error || new Error("Outline upsert failed");

    return NextResponse.json({ outlineId: up.data.id });
  } catch (e: any) {
    console.error("[outline][POST] error", { message: e?.message });
    return NextResponse.json(
      { error: e?.message || "Outline generation failed" },
      { status: 500 }
    );
  }
}
