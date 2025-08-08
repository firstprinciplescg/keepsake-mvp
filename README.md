# Keepsake MVP — App Scaffold (Commit 1)

This is the **initial code scaffold** for the Keepsake MVP. It includes:
- Next.js (App Router, TypeScript, Tailwind)
- API routes for onboarding, token exchange, upload, outline, drafts, export (PDF)
- Supabase admin client (server-only), SQL migrations (RLS: server-only for MVP)
- Token model: one-time URL → HttpOnly cookie session

## Deploy (Vercel)
1. Set these **Vercel env vars** (Production):
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(server only)*
   - `PROJECT_TOKEN_SECRET` *(random, long)*
   - `PDF_SECRET_SALT` *(random, long)*
   - Optional: `RETENTION_DAYS=365`, `MAX_AUDIO_DURATION_SECONDS=1800`, `MAX_AUDIO_FILE_MB=200`, `REGEN_LIMIT_PER_CHAPTER=2`

2. **Supabase**
   - Create a project
   - In SQL Editor: run `supabase/migrations/001_init.sql` then `002_policies.sql`
   - Create private Storage buckets: `audio`, `pdfs` (and `images` if you opt-in later)

3. **Push & Deploy**
   - `npm i`
   - `npm run build` (locally to verify)
   - Push to GitHub → Vercel auto-deploys

## Using the app
- Visit `/` → fill the Onboard form → copy the **private link** (`/t/<token>`)
- Open the private link once → cookie session is set → redirected to `/session/<projectId>/upload`
- Upload audio → (Next) Transcribe → Outline → Draft → Export

> Pages for transcript/outline/draft currently show “Coming Soon” placeholders—API endpoints and data model are ready for wiring as we implement the next milestones.

## Notes
- RLS policies are **deny-all** for now; all DB access goes through server-side API routes with the **Service Role** key. This is simplest and safest for MVP.
- PDF uses `puppeteer-core` + `@sparticuz/chromium`. Vercel will use the serverless Chrome binary automatically.

