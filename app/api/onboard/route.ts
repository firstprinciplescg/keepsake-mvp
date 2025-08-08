import { NextRequest, NextResponse } from 'next/server';
import { createProject } from '@/lib/token';

export async function POST(req: NextRequest){
  try{
    const { name, dob, relationship, themes, output } = await req.json();
    if(!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const { project, token } = await createProject({ name, dob, relationship, themes, output });
    const origin = req.headers.get('origin') || '';
    const shareUrl = `${origin}/t/${token}`;
    return NextResponse.json({ projectId: project.id, shareUrl });
  }catch(e:any){
    return new NextResponse(e.message || 'Failed', { status: 500 });
  }
}
