// app/api/outline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai } from "@/lib/openai";

// ✅ Import the correct message type so TS narrows `role` properly
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

const OUTLINE_MODEL = process.env.OPENAI_MODEL_OUTLINE || "gpt-4o-mini";

export async function POST(req: NextRequest) {
  // Same auth as your other routes
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // 1) Pull transcript text
    const { data: tr, error: te } = await supabaseAdmin
      .from("transcripts")
      .select("text")
      .eq("session_id", sessionId)
      .single();

    if (te || !tr?.text) throw new Error("Transcript not found for session");

    const transcriptText: string = String(tr.text);

    // 2) Build typed messages (prevents the TS union from choosing the function variant)
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Create a clear, hierarchical book outline from the transcript. Return compact JSON (array or object) with parts/chapters/sections only. No commentary.",
      },
      {
        role: "user",
        content: transcriptText.slice(0, 120_000), // basic guard for very long inputs
      },
    ];

    // 3) Call the model
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
      outlineJson = []; // fail-closed to valid JSON
    }

    // 4) Upsert by session — write both outline + structure to satisfy legacy schemas
    const payloadBase = { session_id: sessionId, outline: outlineJson };

    let up = await supabaseAdmin
      .from("outlines")
      .upsert({ ...payloadBase, structure: outlineJson }, { onConflict: "session_id" })
      .select("id")
      .single();

    // If `structure` column doesn't exist in this env, retry without it
    if (up.error && /column .*structure.* does not exist/i.test(up.error.message)) {
      up = await supabaseAdmin
        .from("outlines")
        .upsert(payloadBase, { onConflict: "session_id" })
        .select("id")
        .single();
    }

    if (up.error || !up.data?.id) throw up.error || new Error("Outline upsert failed");

    return NextResponse.json({ outlineId: up.data.id });
  } catch (e: any) {
    console.error("[outline] error", { message: e?.message });
    return NextResponse.json(
      { error: e?.message || "Outline generation failed" },
      { status: 500 }
    );
  }
}
