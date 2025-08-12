// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai, TRANSCRIPTION_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
// (Vercel) allow up to 5 minutes in case of long audio + cold start
export const maxDuration = 300;

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || "audio";

type Body = { sessionId?: string };

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("kp_session")?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let sessionId: string | undefined;
  let audioKey: string | undefined;

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    sessionId = body?.sessionId || new URL(req.url).searchParams.get("sessionId") || undefined;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // 1) Read canonical storage KEY from DB
    const { data: s, error: se } = await supabaseAdmin
      .from("sessions")
      .select("audio_url")
      .eq("id", sessionId)
      .single();
    if (se || !s?.audio_url) throw se || new Error("No audio uploaded for this session");
    audioKey = s.audio_url as string;
    if (audioKey.startsWith("/")) throw new Error(`Invalid storage key (leading slash): "${audioKey}"`);

    // 2) Get audio bytes (download first; fallback to signed url)
    const fetchBytes = async (key: string) => {
      const dl = await supabaseAdmin.storage.from(AUDIO_BUCKET).download(key);
      if (dl.data) {
        const ab = await dl.data.arrayBuffer();
        const ct = (dl.data as any).type || "audio/mpeg";
        return { ab, contentType: ct, via: "download" as const };
      }
      const signed = await supabaseAdmin.storage.from(AUDIO_BUCKET).createSignedUrl(key, 600);
      if (!signed.data?.signedUrl) {
        throw new Error(dl.error?.message || signed.error?.message || "Object not found");
      }
      const res = await fetch(signed.data.signedUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch audio (${res.status})`);
      const ab = await res.arrayBuffer();
      const ct = res.headers.get("content-type") || "audio/mpeg";
      return { ab, contentType: ct, via: "signed" as const };
    };
    const { ab, contentType, via } = await fetchBytes(audioKey);
    console.debug("[transcribe] fetched audio", { bucket: AUDIO_BUCKET, key: audioKey, via });

    const filename = audioKey.split("/").pop() || "audio.mp3";
    const file = new File([new Blob([ab], { type: contentType })], filename, { type: contentType });

    // 3) Pick response format based on model (hard-enforced here)
    const usingWhisper = TRANSCRIPTION_MODEL.toLowerCase() === "whisper-1";
    const response_format = usingWhisper ? "verbose_json" : "json";
    const reqBody: any = {
      model: TRANSCRIPTION_MODEL,
      file,
      response_format,
      temperature: 0,
    };
    if (usingWhisper) reqBody.timestamp_granularities = ["segment"];

    console.log("[stt] config", {
      model: TRANSCRIPTION_MODEL,
      response_format,
      granularity: usingWhisper ? ["segment"] : [],
    });

    // 4) STT
    const tr: any = await openai.audio.transcriptions.create(reqBody);

    const text = tr?.text ?? tr?.output_text ?? "";
    if (!text) throw new Error("Empty transcription result");
    const segments = usingWhisper && Array.isArray(tr?.segments) ? tr.segments : [];

    // 5) Save
    const { data: up, error: tErr } = await supabaseAdmin
      .from("transcripts")
      .upsert({ session_id: sessionId, text, segments }, { onConflict: "session_id" })
      .select("id")
      .single();
    if (tErr) throw tErr;

    await supabaseAdmin.from("sessions").update({ transcript_id: up.id }).eq("id", sessionId);

    return NextResponse.json({ transcriptId: up.id, textLength: text.length, segments: segments.length });
  } catch (e: any) {
    console.error("[transcribe] error", {
      message: e?.message,
      sessionId,
      bucket: AUDIO_BUCKET,
      key: audioKey,
      model: TRANSCRIPTION_MODEL,
    });
    return NextResponse.json(
      { error: e?.message || "Transcription failed", code: "transcribe_error" },
      { status: 500 }
    );
  }
} 