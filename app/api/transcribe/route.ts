// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai, TRANSCRIPTION_MODEL } from "@/lib/openai";

export const runtime = "nodejs";

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || "audio";

type Body = {
  sessionId?: string;   // preferred: we’ll read the storage key from DB
  audioKey?: string;    // fallback: full storage key "<folder>/<filename>"
  path?: string;        // alias for audioKey
};

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let sessionId: string | undefined;
  let audioKey: string | undefined;

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    sessionId = body?.sessionId || new URL(req.url).searchParams.get("sessionId") || undefined;

    // 1) Prefer DB when we have a sessionId (prevents client/path drift)
    if (sessionId) {
      const { data: s, error: se } = await supabaseAdmin
        .from("sessions")
        .select("audio_url")
        .eq("id", sessionId)
        .single();
      if (se || !s) throw se || new Error("Session not found");
      if (!s.audio_url) throw new Error("No audio uploaded for this session");
      audioKey = s.audio_url as string; // e.g. "<folder>/<filename>"
    } else {
      // No sessionId: accept a full storage key from the client
      audioKey = body?.audioKey || body?.path || undefined;
      if (!audioKey) {
        return NextResponse.json(
          { error: 'Provide either "sessionId" or a full "audioKey"/"path".', code: "bad_request" },
          { status: 400 }
        );
      }
    }

    // Guard: storage keys must not start with '/'
    if (audioKey.startsWith("/")) {
      throw new Error(`Invalid storage key (leading slash): "${audioKey}"`);
    }

    // If the key has no slash but we have a sessionId, self-heal → "<sessionId>/<key>"
    if (sessionId && !audioKey.includes("/")) {
      audioKey = `${sessionId}/${audioKey}`;
    }

    // Helper: fetch bytes from Storage (download first, then signed URL)
    const fetchBytes = async (key: string) => {
      // Try direct download (simplest, no URL leakage)
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(AUDIO_BUCKET)
        .download(key);

      if (blob) {
        const ab = await blob.arrayBuffer();
        const ct = (blob as any).type || "audio/mpeg";
        return { ab, contentType: ct, via: "download" as const };
      }

      // Fallback: signed URL
      if (dlErr) {
        console.warn("[transcribe] storage.download failed; will sign", {
          audioBucket: AUDIO_BUCKET,
          audioKey: key,
          message: dlErr?.message,
        });
      }
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(key, 600);
      if (signErr || !signed?.signedUrl) {
        console.error("[transcribe] sign error", {
          audioBucket: AUDIO_BUCKET,
          audioKey: key,
          message: signErr?.message,
        });
        throw new Error("Object not found");
      }
      const res = await fetch(signed.signedUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch audio (${res.status})`);
      const ab = await res.arrayBuffer();
      const ct = res.headers.get("content-type") || "audio/mpeg";
      return { ab, contentType: ct, via: "signed" as const };
    };

    // Fetch audio
    const { ab, contentType, via } = await fetchBytes(audioKey);
    console.debug("[transcribe] fetched audio", { audioBucket: AUDIO_BUCKET, audioKey, via });

    const filename = audioKey.split("/").pop() || "audio.mp3";
    const file = new File([new Blob([ab], { type: contentType })], filename, { type: contentType });

    // 2) Whisper + verbose_json (segments) | fallback to json if ever not whisper
    const usingWhisper = TRANSCRIPTION_MODEL.toLowerCase() === "whisper-1";
    const reqBody: any = {
      model: TRANSCRIPTION_MODEL,
      file,
      response_format: usingWhisper ? "verbose_json" : "json",
      temperature: 0,
    };
    if (usingWhisper) reqBody.timestamp_granularities = ["segment"]; // or ["word","segment"]

    const tr: any = await openai.audio.transcriptions.create(reqBody);

    const text = tr?.text ?? tr?.output_text ?? "";
    if (!text) throw new Error("Empty transcription result");
    const segments = usingWhisper && Array.isArray(tr?.segments) ? tr.segments : [];

    // 3) Idempotent write (upsert on session)
    const { data: upserted, error: tErr } = await supabaseAdmin
      .from("transcripts")
      .upsert({ session_id: sessionId ?? null, text, segments }, { onConflict: "session_id" })
      .select("id")
      .single();
    if (tErr) throw tErr;

    // Persist corrected key if we self-healed, and link transcript
    if (sessionId) {
      await supabaseAdmin
        .from("sessions")
        .update({ transcript_id: upserted.id, audio_url: audioKey })
        .eq("id", sessionId);
    }

    return NextResponse.json({ transcriptId: upserted.id });
  } catch (e: any) {
    console.error("[transcribe] error", {
      message: e?.message,
      sessionId,
      audioBucket: AUDIO_BUCKET,
      audioKey,
    });
    return NextResponse.json(
      { error: e?.message || "Transcription failed", code: "transcribe_error" },
      { status: 500 }
    );
  }
}
