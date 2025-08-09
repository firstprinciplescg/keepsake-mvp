import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseBuffer } from 'music-metadata';

const MAX_SECONDS = parseInt(process.env.MAX_AUDIO_DURATION_SECONDS || '1800', 10); // 30m
const MAX_MB = parseInt(process.env.MAX_AUDIO_FILE_MB || '200', 10);

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const form = await req.formData();
  const projectId = form.get('projectId')?.toString();
  const file = form.get('file') as File | null;
  if(!projectId || !file) return new NextResponse('Missing file or projectId', { status: 400 });

  if(file.size > MAX_MB * 1024 * 1024){
    return new NextResponse(`File too large. Max ${MAX_MB}MB`, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // Duration sniff (best-effort)
  let seconds: number | null = null;
  try{
    const meta = await parseBuffer(buf, file.type);
    seconds = Math.round(meta.format.duration || 0);
    if(seconds && seconds > MAX_SECONDS){
      return new NextResponse(`Recording too long (${seconds}s). Max ${MAX_SECONDS}s.`, { status: 400 });
    }
  }catch{ /* ignore */ }

  // Upload to Supabase Storage
  const bucket = process.env.SUPABASE_BUCKET_AUDIO || 'audio';
  const path = `${projectId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if(error) return new NextResponse(error.message, { status: 500 });

  // Find interviewee for this project
  const { data: iv, error: ive } = await supabaseAdmin.from('interviewees')
    .select('id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(1).single();
  if(ive) return new NextResponse(ive.message, { status: 500 });

  // Record session
  const { data: sessionRow, error: sErr } = await supabaseAdmin.from('sessions')
    .insert({ project_id: projectId, interviewee_id: iv?.id || null, audio_url: data.path, duration_seconds: seconds })
    .select('*')
    .single();
  if(sErr) return new NextResponse(sErr.message, { status: 500 });

  return NextResponse.json({ sessionId: sessionRow.id, audioPath: data.path, duration: seconds });
}
