// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure Node runtime

type Body = { sessionId?: string };

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function parseStorageKey(key: string): { bucket: string; path: string } | null {
  // expects e.g., "audio/<sessionId>/filename.webm"
  const parts = key.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [bucket, ...rest] = parts;
  return { bucket, path: rest.join("/") };
}

async function fetchBytesWithTimeout(url: string, ms: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`audio fetch failed (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } finally {
    clearTimeout(t);
  }
}

// TS-safe helper: convert a Uint8Array into an ArrayBuffer BlobPart
function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Using Uint8Array.slice() returns a new typed array whose .buffer is a proper ArrayBuffer
  return u8.slice().buffer;
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    maxRetries: 1,       // project rule: retry once
    timeout: 120_000,    // up to 120s for larger audio
  });

  try {
    const body = (await req.json()) as Body;
    const sessionId = body?.sessionId?.trim();

    if (!sessionId || !isUUID(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId", code: "bad_request" }, { status: 400 });
    }

    // 1) Load session & audio key
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select("id, audio_url, transcript_id")
      .eq("id", sessionId)
      .single();

    if (sessionErr) {
      console.error("[transcribe] error", { message: sessionErr.message, sessionId });
      return NextResponse.json({ error: "Session fetch failed", code: "db_fetch_error" }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found", code: "not_found" }, { status: 404 });
    }
    if (!session.audio_url) {
      return NextResponse.json({ error: "No audio key found for session", code: "no_audio" }, { status: 400 });
    }

    // 2) Sign the audio URL (≤10 min). Do NOT log signed URLs.
    const parsed = parseStorageKey(session.audio_url);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid audio key format", code: "bad_audio_key" }, { status: 422 });
    }

    const { bucket, path } = parsed;
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 600); // 10 minutes

    if (signErr || !signed?.signedUrl) {
      console.error("[transcribe] error", { message: signErr?.message || "signing failed", sessionId, bucket, path });
      return NextResponse.json({ error: "Failed to sign audio", code: "sign_error" }, { status: 500 });
    }

    // 3) Fetch bytes with timeout and one manual retry
    let audioBytes: Uint8Array | null = null;
    try {
      audioBytes = await fetchBytesWithTimeout(signed.signedUrl, 30_000);
    } catch (e1: any) {
      console.error("[transcribe] error", { message: `audio fetch attempt1: ${e1?.message}`, sessionId, bucket, path });
      // retry once
      audioBytes = await fetchBytesWithTimeout(signed.signedUrl, 30_000);
    }

    // 4) Prepare File for OpenAI (pass ArrayBuffer to avoid TS BlobPart mismatch)
    const filename = path.split("/").pop() || "audio.mpeg";
    const arrayBuffer = u8ToArrayBuffer(audioBytes!);
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const file = await OpenAI.toFile(blob, filename);

    // 5) Whisper transcription (verbose_json)
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      temperature: 0,
    }) as any;

    const text: string = result?.text ?? "";
    const segments: unknown[] = Array.isArray(result?.segments) ? result.segments : [];

    if (!text) {
      console.error("[transcribe] error", { message: "empty transcription text", sessionId });
      return NextResponse.json({ error: "Empty transcription", code: "empty_text" }, { status: 502 });
    }

    // 6) Upsert transcript row
    const { data: existing, error: txFetchErr } = await supabaseAdmin
      .from("transcripts")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (txFetchErr) {
      console.error("[transcribe] error", { message: txFetchErr.message, sessionId });
      return NextResponse.json({ error: "Transcript fetch failed", code: "db_fetch_error" }, { status: 500 });
    }

    let transcriptId: string | null = existing?.id ?? null;

    if (transcriptId) {
      const { error: updErr } = await supabaseAdmin
        .from("transcripts")
        .update({ text, segments })
        .eq("id", transcriptId);
      if (updErr) {
        console.error("[transcribe] error", { message: updErr.message, sessionId });
        return NextResponse.json({ error: "Transcript update failed", code: "db_update_error" }, { status: 500 });
      }
    } else {
      const { data: insertRows, error: insErr } = await supabaseAdmin
        .from("transcripts")
        .insert({ session_id: sessionId, text, segments })
        .select("id")
        .single();
      if (insErr) {
        console.error("[transcribe] error", { message: insErr.message, sessionId });
        return NextResponse.json({ error: "Transcript insert failed", code: "db_insert_error" }, { status: 500 });
      }
      transcriptId = insertRows.id;
    }

    // 7) Link session.transcript_id if needed (idempotent)
    if (transcriptId && session.transcript_id !== transcriptId) {
      const { error: linkErr } = await supabaseAdmin
        .from("sessions")
        .update({ transcript_id: transcriptId })
        .eq("id", sessionId);
      if (linkErr) {
        console.error("[transcribe] error", { message: linkErr.message, sessionId });
        return NextResponse.json({ error: "Session link failed", code: "db_update_error" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      transcriptId,
      textLength: text.length,
      segments: Array.isArray(segments) ? segments.length : 0,
    });
  } catch (e: any) {
    console.error("[transcribe] error", { message: e?.message });
    return new NextResponse(JSON.stringify({ error: e?.message ?? "Internal error", code: "internal" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
