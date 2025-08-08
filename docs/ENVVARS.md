# Environment Variables

> **Scopes:**  
> - **Server-only:** available to API routes/server functions only.  
> - **Client-exposed:** prefixed with `NEXT_PUBLIC_` and readable in the browser.

| Name | Scope | Required | Default | Purpose / Notes |
|---|---|---:|---|---|
| `OPENAI_API_KEY` | Server-only | Yes | — | Access for Whisper + GPT models. |
| `OPENAI_TRANSCRIPTION_MODEL` | Server-only | No | `whisper-1` | Transcription model name. |
| `OPENAI_MODEL_OUTLINE` | Server-only | No | `gpt-4o-mini` | Model for outline generation. |
| `OPENAI_MODEL_DRAFT` | Server-only | No | `gpt-4o` | Model for chapter drafts. |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-exposed | Yes | — | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-exposed | Yes | — | Public anon key for client reads/writes with RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Yes | — | Elevated server key for secure server-side operations only. |
| `SUPABASE_BUCKET_AUDIO` | Server-only | No | `audio` | Private bucket for audio uploads. |
| `SUPABASE_BUCKET_PDF` | Server-only | No | `pdfs` | Private bucket for generated PDFs. |
| `SUPABASE_BUCKET_IMAGES` | Server-only | No | `images` | (Optional) For future photo uploads. |
| `PROJECT_TOKEN_SECRET` | Server-only | Yes | — | Secret/salt for signing and rotating project tokens. |
| `PDF_SECRET_SALT` | Server-only | Yes | — | Salt for signing/validating secure PDF links. |
| `RETENTION_DAYS` | Server-only | No | `365` | Auto-delete projects and storage after N days. |
| `MAX_AUDIO_DURATION_SECONDS` | Server-only | No | `1800` | Hard cap on audio length (e.g., 30 minutes). |
| `MAX_AUDIO_FILE_MB` | Server-only | No | `200` | Reject oversize audio files to control cost. |
| `REGEN_LIMIT_PER_CHAPTER` | Server-only | No | `2` | Number of **regenerations** allowed per chapter. |
| `NODE_ENV` | Server-only | No | `production` | Standard Node environment variable. |
| `VERCEL` | Server-only | No | Managed | Present on Vercel runtime; used for env detection. |

## Setup

- In **Vercel → Project → Settings → Environment Variables**, add each required variable for the **Production** environment (and Preview/Development if desired).  
- Locally, copy `.env.example` to `.env.local` and fill in the values (after the code scaffold is added).
