# Proposed Repository Structure (post-approval)

```
.
├─ app/                         # Next.js App Router (added after approval)
│  ├─ layout.tsx
│  ├─ page.tsx                  # Landing / Onboard
│  ├─ (project)/session/[id]/   # Upload, Transcript, Outline, Draft, Export routes
│  └─ api/                      # API routes (upload, transcribe, outline, draft, export, feedback)
├─ components/                  # Form elements, editors, toasts
├─ lib/                         # Supabase client, token utils, OpenAI clients
├─ styles/                      # Tailwind + global styles
├─ scripts/                     # Migrations, maintenance jobs
├─ supabase/                    # SQL migrations & policies (RLS)
├─ public/                      # Static assets (logos, favicons)
├─ docs/                        # PRD and technical docs (present now)
├─ .env.example                 # Example environment variables (present now)
├─ SECURITY.md                  # Token model & privacy (present now)
├─ .gitignore                   # Node/Next/Vercel ignores (present now)
└─ README.md                    # Repo overview (present now)
```

> This structure is intentionally aligned with a Next.js app-router build on Vercel. No app code is included until you approve the plan.
