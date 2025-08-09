// lib/token.ts
import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabaseAdmin';

const PROJECT_TOKEN_SECRET = process.env.PROJECT_TOKEN_SECRET;
if (!PROJECT_TOKEN_SECRET) {
  console.warn('PROJECT_TOKEN_SECRET missing.');
}
const encoder = new TextEncoder();

export function generateProjectToken() {
  return randomBytes(24).toString('base64url');
}

export async function createProject({
  name,
  dob,
  relationship,
  themes,
  output,
}: any) {
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '365', 10);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  const token = generateProjectToken();

  const { data: proj, error } = await supabaseAdmin
    .from('projects')
    .insert({
      token,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;

  const { error: ie } = await supabaseAdmin.from('interviewees').insert({
    project_id: proj.id,
    name,
    dob: dob || null,
    relationship: relationship || null,
    themes:
      typeof themes === 'string'
        ? themes
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : themes ?? [],
    output_prefs: { type: output || 'book' },
  });
  if (ie) throw ie;

  return { project: proj, token };
}

/**
 * Called by POST /api/token/exchange
 * - Validates token
 * - Rotates token (one-time semantics)
 * - Sets token_used_at on first use
 * - Returns a signed session cookie (14d)
 */
export async function exchangeTokenForSession(token: string) {
  const { data: proj, error } = await supabaseAdmin
    .from('projects')
    .select('id, token_used_at, expires_at, status')
    .eq('token', token)
    .single();

  if (error || !proj) return { ok: false as const };

  // Ensure project is active and not expired
  const now = Date.now();
  const expiresAt = (proj as any).expires_at as string | null;
  const expired = expiresAt ? new Date(expiresAt).getTime() < now : false;
  if ((proj as any).status !== 'active' || expired) {
    return { ok: false as const };
  }

  // Rotate token on exchange; record first-use time
  const newToken = generateProjectToken();
  const { error: updErr } = await supabaseAdmin
    .from('projects')
    .update({
      token: newToken,
      token_used_at: (proj as any).token_used_at || new Date().toISOString(),
    })
    .eq('id', (proj as any).id);
  if (updErr) return { ok: false as const };

  // Issue session cookie (14 days)
  const sessionCookie = await new SignJWT({ projectId: (proj as any).id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(encoder.encode(PROJECT_TOKEN_SECRET!));

  return { ok: true as const, projectId: (proj as any).id, sessionCookie };
}

export async function verifySessionCookie(cookie: string) {
  try {
    const { payload } = await jwtVerify(
      cookie,
      encoder.encode(PROJECT_TOKEN_SECRET!)
    );
    return payload as any;
  } catch {
    return null;
  }
}
