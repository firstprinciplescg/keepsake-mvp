// app/api/dev/storage-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || "audio";

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") || "";
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const { data: s, error: se } = await supabaseAdmin
    .from("sessions")
    .select("audio_url")
    .eq("id", sessionId)
    .single();

  if (se || !s?.audio_url) {
    return NextResponse.json({ ok: false, step: "fetch_session", error: se?.message || "no audio_url" }, { status: 404 });
  }

  const key = s.audio_url as string;
  const dl = await supabaseAdmin.storage.from(AUDIO_BUCKET).download(key);
  const dlOk = !!dl.data;

  const sign = await supabaseAdmin.storage.from(AUDIO_BUCKET).createSignedUrl(key, 60);
  const signOk = !!sign.data?.signedUrl;

  return NextResponse.json({
    ok: dlOk || signOk,
    bucket: AUDIO_BUCKET,
    key,
    downloadOk: dlOk,
    signOk,
    errors: {
      download: dl.error?.message,
      sign: sign.error?.message,
    },
  });
}
