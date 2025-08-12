// app/api/outline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
const OUTLINE_MODEL = process.env.OPENAI_MODEL_OUTLINE || "gpt-4o-mini";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // 1) Fetch transcript
    const { data: tr, error: te } = await supabaseAdmin
      .from("transcripts")
      .select("text")
      .eq("session_id", sessionId)
      .single();
    if (te || !tr?.text) throw new Error("Transcript not found for session");

    // 2) Ask model for compact JSON outline
    const prompt = [
      {
        role: "system",
        content:
          "Create a clear, hierarchical book outline from the transcript. Return compact JSON with parts/chapters/sections only.",
      },
      { role: "user", content: tr.text.slice(0, 120_000) }, // basic guard
    ];
    const completion = await openai.chat.completions.create({
      model: OUTLINE_MODEL,
      messages: prompt,
      temperature: 0.2,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || "[]";
    if (/^```/m.test(raw)) raw = raw.replace(/```json|```/g, "");

    let outlineJson: any;
    try {
      outlineJson = JSON.parse(raw);
    } catch {
      outlineJson = []; // fail-closed to valid JSON
    }

    // 3) Upsert — try writing both columns; retry if legacy column missing
    const payloadBase = { session_id: sessionId, outline: outlineJson };
    let upErr = null;
    let upId: string | undefined;

    // attempt with outline + structure (legacy-friendly)
    let up = await supabaseAdmin
      .from("outlines")
      .upsert({ ...payloadBase, structure: outlineJson }, { onConflict: "session_id" })
      .select("id")
      .single();

    if (up.error && /column .*structure.* does not exist/i.test(up.error.message)) {
      // retry without structure
      up = await supabaseAdmin
        .from("outlines")
        .upsert(payloadBase, { onConflict: "session_id" })
        .select("id")
        .single();
    }

    upErr = up.error ?? null;
    upId = up.data?.id;

    if (upErr || !upId) throw upErr || new Error("Outline upsert failed");

    return NextResponse.json({ outlineId: upId });
  } catch (e: any) {
    console.error("[outline] error", { message: e?.message });
    return NextResponse.json(
      { error: e?.message || "Outline generation failed" },
      { status: 500 }
    );
  }
}
