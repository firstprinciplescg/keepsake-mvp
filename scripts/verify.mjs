// Lightweight repo sanity checks for Keepsake MVP
// Run with: npm run verify

import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();

const requiredPaths = [
  'app/t/[token]/page.tsx',
  'app/api/token/exchange/route.ts',
  'app/session/[projectId]/upload/page.tsx',
  'app/session/[projectId]/transcript/page.tsx',

  // upload flow
  'app/api/upload-init/route.ts',
  'app/api/upload-complete/route.ts',

  // transcript flow
  'app/api/session/current/route.ts',
  'app/api/transcribe/route.ts',
  'app/api/transcript/route.ts',
];

const warnings = [];
const errors = [];

async function fileExists(p) {
  try { await fs.access(path.join(root, p)); return true; }
  catch { return false; }
}

async function readText(p) {
  return fs.readFile(path.join(root, p), 'utf8');
}

async function verifyRequiredPaths() {
  for (const p of requiredPaths) {
    if (!(await fileExists(p))) errors.push(`Missing file: ${p}`);
  }
}

async function verifyDynamicSegmentName() {
  const sessionDir = path.join(root, 'app', 'session');
  try {
    const entries = await fs.readdir(sessionDir);
    const hasProjectId = entries.includes('[projectId]');
    const hasWeird = entries.some(e => /^\[projectid\]|\[projectID\]$/i.test(e) && e !== '[projectId]');
    if (!hasProjectId) errors.push('Dynamic segment folder missing: app/session/[projectId]');
    if (hasWeird) warnings.push('Found a similarly named segment under app/session (e.g. [projectID]). Remove it to avoid confusion.');
  } catch {
    errors.push('Missing dir: app/session');
  }
}

async function verifyUploadPage() {
  const p = 'app/session/[projectId]/upload/page.tsx';
  if (!(await fileExists(p))) return;
  const src = await readText(p);

  // must have a file input OR signed upload call
  const hasFileInput = /type\s*=\s*["']file["']/.test(src);
  const usesSignedUpload = /uploadToSignedUrl\s*\(/.test(src);
  if (!hasFileInput && !usesSignedUpload) {
    errors.push(`Upload page missing file input or signed upload call: ${p}`);
  }

  // Upload page should NOT try to read /api/session/current (that’s transcript logic)
  if (/\/api\/session\/current/.test(src)) {
    errors.push(`Upload page calls /api/session/current (transcript logic). Please remove from ${p}`);
  }
}

async function verifyTranscriptPage() {
  const p = 'app/session/[projectId]/transcript/page.tsx';
  if (!(await fileExists(p))) return;
  const src = await readText(p);

  // transcript should interact with transcript/transcribe APIs
  const hasApis = /\/api\/transcribe|\/api\/transcript/.test(src);
  if (!hasApis) warnings.push('Transcript page does not reference /api/transcribe or /api/transcript. Is this the right file?');

  // helpful CTA back to upload
  if (!/\/session\/\$\{?projectId|\/upload/.test(src) && !/\/upload/.test(src)) {
    warnings.push('Consider adding an "Upload audio" CTA on Transcript when no session exists.');
  }
}

async function verifyExchangeRedirect() {
  const p = 'app/api/token/exchange/route.ts';
  if (!(await fileExists(p))) return;
  const src = await readText(p);

  // should redirect to /upload (not /transcript) after join
  const mentionsUpload = /\/session\/\$\{?[^}]+}/.test(src) && /\/upload/.test(src);
  if (!mentionsUpload) {
    errors.push('token/exchange redirect does not point to /session/:id/upload. Please update the redirect target.');
  }

  // cookie should be set on the same response
  const setsCookie = /res\.cookies\.set\(\s*['"`]kp_session['"`]/.test(src);
  if (!setsCookie) warnings.push('token/exchange does not set kp_session cookie; join flow may fail.');
}

async function main() {
  await verifyRequiredPaths();
  await verifyDynamicSegmentName();
  await verifyUploadPage();
  await verifyTranscriptPage();
  await verifyExchangeRedirect();

  if (warnings.length) {
    console.log('\n⚠️  WARNINGS');
    for (const w of warnings) console.log(' - ' + w);
  }
  if (errors.length) {
    console.log('\n❌ FAILURES');
    for (const e of errors) console.log(' - ' + e);
    console.log('\nRun `git status` to review recent changes. Fix the items above and re-run: npm run verify\n');
    process.exit(1);
  }

  console.log('✅ verify: all checks passed');
}

main().catch(err => {
  console.error('verify crashed:', err);
  process.exit(1);
});
