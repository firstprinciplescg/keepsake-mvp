# Keepsake MVP — Repo Bootstrap (Docs-Only)

This repository bootstrap contains **documentation and environment variable templates only**. It’s designed so you can create the project in Vercel and set up secrets **before any application code is added**.

> If you want a placeholder "Coming Soon" page so Vercel deploys without errors, add a single `index.html` later. This bootstrap intentionally contains **no app code**.

## What’s here
- `/docs/PRD.md`: Your Product Requirements Document, for reference.
- `/docs/ENVVARS.md`: All environment variables with purpose, scope, and defaults.
- `/docs/REPO_STRUCTURE.md`: Proposed directory layout for the Next.js app.
- `SECURITY.md`: Non-technical overview of the project token model and privacy.
- `.env.example`: Copy to `.env.local` for local development once code is added.
- `.gitignore`: Node/Next/Vercel ignores.

## Quick start
1. Create a **private GitHub repo**, e.g., `keepsake-mvp`.
2. Push this bootstrap (or upload the ZIP contents) to that repo.
3. In **Vercel**, import the repo to create the project.
4. In **Vercel → Settings → Environment Variables**, add the variables from `/docs/ENVVARS.md` (copy from `.env.example` as a starting point).
5. Create your **Supabase** project and paste its URL/keys into Vercel.
6. After plan approval, application code will be pushed and Vercel will auto-deploy.

## After approval — first code push will include
- Next.js scaffold (`/app` router), Supabase client, token exchange middleware
- Upload → Transcribe → Outline → Draft → PDF endpoints
- RLS-enabled migrations and seed scripts
- Branded PDF template and basic UI

## Notes
- Keep the **Service Role Key** server-side only (Vercel server environment). Never expose it to the browser.
- Tokens are single-use in the URL; after first visit they are rotated and stored as an HttpOnly cookie.
