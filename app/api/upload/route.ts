// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';

export const runtime = 'nodejs'; // ensure Node runtime for formData + Buffer

export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const cookie = req.cookies.get('kp_session')?.value;
    const session = cookie ? await verifySessionCookie(cookie) : null;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse multipart form ---
    const form = await req.formData();
    const file = form.get('file');
    const audioKey = form.get('audioKey');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing "file" in form-data' }, { status: 400 });
    }
    if (typeof audioKey !== 'string' || !audioKey) {
      return NextResponse.json({ error: 'Missing "audioKey" in form-data' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = file.type || 'audio/wav'; // default; adjust if needed

    // --- Upload to Supabase Storage ---
    const { data, error } = await supabaseAdmin
      .storage
      .from(AUDIO_BUCKET)
      .upload(audioKey, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('[upload] Supabase upload failed', {
        bucket: AUDIO_BUCKET,
        audioKey,
        error,
      });
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Return the storage path; client can later call /api/transcribe with this key
    return NextResponse.json({
      ok: true,
      bucket: AUDIO_BUCKET,
      audioKey,
      data,
    });
  } catch (err: any) {
    console.error('[upload] Uncaught error', { err });
    return NextResponse.json({ error: 'Unhandled server error' }, { status: 500 });
  }
}
