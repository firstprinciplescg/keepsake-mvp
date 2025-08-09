// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { openai, TRANSCRIPTION_MODEL } from '@/lib/openai';

// If you prefer a different bucket name, set SUPABASE_BUCKET_AUDIO in Vercel env.
const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

type TranscribeBody = {
  /** Path in your Supabase bucket, e.g. "users/uid123/abcdef.wav" */
  audioKey?: string;
};

export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const cookie = req.cookies.get('kp_session')?.value;
    const session = cookie ? await verifySessionCookie(cookie) : null;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse & validate body ---
    let body: TranscribeBody | undefined;
    try {
      body = (await req.json()) as TranscribeBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const audioKey = body?.audioKey;
    if (!audioKey || typeof audioKey !== 'string') {
      // Log key context (not PII) for debugging
      console.error('[transcribe] Missing/invalid audioKey', {
        bucket: AUDIO_BUCKET,
        receivedType: typeof audioKey,
        received: audioKey,
      });
      return NextResponse.json({ error: 'Missing required "audioKey"' }, { status: 400 });
    }

    // --- Sign short-lived URL to read the file ---
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(audioKey, 600); // 10 minutes

    if (signErr || !signed?.signedUrl) {
      console.error('[transcribe] Failed to create signed URL', {
        bucket: AUDIO_BUCKET,
        audioKey,
        signErr,
      });
      return NextResponse.json({ error: 'Failed to sign audio URL' }, { status: 500 });
    }

    // --- Fetch bytes from signed URL ---
    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) {
      console.error('[transcribe] Fetch signed URL failed', {
        status: fileRes.status,
        statusText: fileRes.statusText,
        bucket: AUDIO_BUCKET,
        audioKey,
      });
      return NextResponse.json({ error: 'Failed to fetch audio bytes' }, { status: 502 });
    }

    const contentType =
      fileRes.headers.get('content-type') ||
      // Safe fallback; OpenAI will still accept as binary
      'application/octet-stream';

    const buf = Buffer.from(await fileRes.arrayBuffer());
    const filename = audioKey.split('/').pop() || 'audio-file';

    // In Node 18+/20+, File/Blob are available globally (undici)
    const blob = new Blob([buf], { type: contentType });
    const file = new File([blob], filename, { type: contentType });

    // --- Transcribe with OpenAI ---
    // IMPORTANT: For 'gpt-4o-mini-transcribe-api-ev3', use response_format 'json' or 'text'
    const transcription: any = await openai.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL,           // e.g., "gpt-4o-mini-transcribe-api-ev3"
      file,                                  // the File constructed above
      response_format: 'json',               // <-- NOT 'verbose_json' for this model
      temperature: 0,
    } as any);

    // Normalize the response a bit; different SDKs may va
