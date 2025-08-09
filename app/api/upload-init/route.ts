import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/token';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'audio';
const MAX_MB = parseInt(process.env.MAX_AUDIO_FILE_MB || '200', 10);

function slugify(name: string){
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(()=> ({}));
  const { projectId, fileName, fileSize } = body || {};
  if(!projectId || !fileName) return new NextResponse('projectId and fileName required', { status: 400 });
  if(fileSize && fileSize > MAX_MB * 1024 * 1024){
    return new NextResponse(`File too large. Max ${MAX_MB}MB`, { status: 400 });
  }

  const path = `${projectId}/${Date.now()}-${slugify(fileName)}`;
  const { data, error } = await supabaseAdmin
    .storage
    .from(AUDIO_BUCKET)
    .createSignedUploadUrl(path); // returns { signedUrl, token }

  if(error || !data) return new NextResponse(error?.message || 'Failed to create signed upload URL', { status: 500 });
  return NextResponse.json({ bucket: AUDIO_BUCKET, path, token: (data as any).token });
}
