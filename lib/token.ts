import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabaseAdmin';

const PROJECT_TOKEN_SECRET = process.env.PROJECT_TOKEN_SECRET;
if(!PROJECT_TOKEN_SECRET){
  console.warn('PROJECT_TOKEN_SECRET missing.');
}
const encoder = new TextEncoder();

export function generateProjectToken(){
  return randomBytes(24).toString('base64url');
}

export async function createProject({ name, dob, relationship, themes, output } : any){
  const token = generateProjectToken();
  const expiresAt = new Date(Date.now() + (process.env.RETENTION_DAYS ? parseInt(process.env.RETENTION_DAYS)*24*60*60*1000 : 365*24*60*60*1000));
  const { data: proj, error } = await supabaseAdmin
    .from('projects')
    .insert({ token, status: 'active', expires_at: expiresAt.toISOString() })
    .select('*')
    .single();
  if(error) throw error;

  const { error: ie } = await supabaseAdmin
    .from('interviewees')
    .insert({
      project_id: proj.id,
      name,
      dob: dob || null,
      relationship: relationship || null,
      themes: themes ? themes.split(',').map((t:string)=>t.trim()) : [],
      output_prefs: { type: output || 'book' }
    });
  if(ie) throw ie;

  return { project: proj, token };
}

export async function exchangeTokenForSession(token: string){
  // find project by token; if already used, rotate
  const { data: proj, error } = await supabaseAdmin
    .from('projects')
    .select('id, token_used_at')
    .eq('token', token)
    .single();
  if(error || !proj) return { ok:false as const };

  // rotate token (one-time semantics)
  const newToken = generateProjectToken();
  await supabaseAdmin.from('projects').update({ token: newToken, token_used_at: new Date().toISOString() }).eq('id', proj.id);

  // issue cookie
  const sessionCookie = await new SignJWT({ projectId: proj.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(encoder.encode(PROJECT_TOKEN_SECRET!));

  return { ok:true as const, projectId: proj.id, sessionCookie };
}

export async function verifySessionCookie(cookie: string){
  try{
    const { payload } = await jwtVerify(cookie, encoder.encode(PROJECT_TOKEN_SECRET!));
    return payload as any;
  } catch{
    return null;
  }
}
