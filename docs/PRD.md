**AI-Powered Keepsake App PRD**

------------------

## 1. Project Overview

**Purpose & Vision**\
Build an AI-driven web application that captures and preserves personal stories through conversational interviews—then transforms them into a polished keepsake (coffee-table book, memoir PDF) without requiring user accounts in the MVP. The long‑term vision is a robust, multi-tenant platform offering rich features and user management.

**Background & Inspiration**\
Inspired by Storyworth’s model of weekly prompts and annual books, but elevated with real-time transcription (OpenAI Whisper), AI-generated outlines, and GPT-4 narrative drafting for a seamless, guided interview-to-publication pipeline.

**MVP Scope**

- Guest-mode (no-login) single‑tenant experience with shareable project tokens
- Audio upload (file) → Whisper transcription → JSON outline → GPT-4 chapter drafts → PDF export
- Core UI for metadata entry, transcript review, outline approval, draft preview, and PDF download

---

## 2. Objectives & Success Metrics

**Primary Objectives**

1. **Validate Core Pipeline**: Demonstrate end-to-end flow from audio to PDF keepsake.
2. **Ease of Use**: Achieve intuitive guest experience requiring minimal clicks and configuration.

**Standard Success Metrics**

| Metric                               | Target                | Notes                                |
| ------------------------------------ | --------------------- | ------------------------------------ |
| Transcription Accuracy               | ≥ 85% word error rate | Measured against manual transcript   |
| Outline Approval Rate                | ≥ 80%                 | % of outlines accepted without edits |
| Draft Generation Latency             | ≤ 30s per chapter     | Time from outline approval to draft  |
| User Satisfaction (via quick survey) | ≥ 4/5 stars           | Completed at final PDF download      |
| Conversion to PDF Download           | ≥ 50%                 | % of sessions that generate a PDF    |
|                                      |                       |                                      |

---

## 3. User Personas & Journeys

**Primary Persona**:

- **Name**: Adult Child Interviewer
- **Goal**: Preserve parent’s or grandparent’s life stories as a gift
- **Tech Comfort**: Basic (familiar with web uploads and downloads)

**Guest (MVP) Journey**

1. **Access Link**: Click unique project URL (with token)
2. **Onboard**: Enter Interviewee metadata (name, DOB, themes, desired output)
3. **Upload Audio**: Drag & drop audio file
4. **Review Transcript**: Correct minor errors inline
5. **Approve Outline**: Edit or accept AI‑generated chapter outline
6. **Review Drafts**: Read generated chapters, request regenerations as needed
7. **Download PDF**: Obtain final keepsake

**Future Auth Flow (Sketch)**

- Same steps, but gated behind login; access to project history and multi-session books.

---

## 4. User Stories

These user stories will guide Greta in building features and ensure our development aligns with real user needs. Each story follows the "As a [persona], I want [action], so that [benefit]" format.

1. **Onboard Interviewee**:\
   As an *Adult Child Interviewer*, I want to enter interviewee metadata (name, DOB, themes, output preferences), so that the AI pipeline personalizes transcripts, outlines, and drafts appropriately.

2. **Upload Audio File**:\
   As an *Adult Child Interviewer*, I want to upload an audio recording of a conversation, so that the app can transcribe and process it.

3. **Review and Correct Transcript**:\
   As an *Adult Child Interviewer*, I want to view the AI-generated transcript with time‑stamps and correct any errors inline, so that my final outline and drafts are accurate.

4. **Approve AI‑Generated Outline**:\
   As an *Adult Child Interviewer*, I want to review and edit the AI-proposed chapter outline, so that the narrative structure reflects the stories I care about.

5. **Generate and Revise Draft Chapters**:\
   As an *Adult Child Interviewer*, I want to generate a draft for each approved chapter and request regenerations if needed, so that the final writing captures the right tone and detail.

6. **Download Final Keepsake**:\
   As an *Adult Child Interviewer*, I want to download a styled PDF of the complete book, so that I can print and gift it.

## 5. Functional Requirements

1. **Onboarding & Metadata**

   - Form fields: Interviewee name, DOB, relationship, themes (free text), output type (book, single story), length (word count)

2. **Audio Handling**

   - File upload (.mp3, .wav, .m4a)
   - Store in Supabase Storage
   - Validate and enforce a maximum recording duration per session (e.g., 30 minutes); if exceeded, reject the upload and prompt the user to split the recording to manage transcription costs and storage. 

3. **Transcription**\*\*

   - Invoke OpenAI Whisper API
   - Time‑stamped transcript storage

4. **Outline Generation**

   - Call GPT‑4 (or other model via OpenAI API) with system prompt to produce JSON outline
   - Editing UI: inline title and bullet adjustments

5. **Draft Generation**

   - For each outline node, generate \~300 words
   - Provide “Regenerate” and “Accept” controls
     - Drafts should be saved; user is allowed up to 2 regenerations (3 generations in total)

6. **Export**

   - Render final product or chapters and any uploaded photos into styled HTML
   - Generate PDF via Puppeteer
   - Offer direct download

---

## 5. Non-Functional Requirements

- **Performance**: End‑to‑end pipeline ≤ 2 minutes for a 10‑minute recording
- **Security & Privacy**:
  - All data encrypted in transit (HTTPS) and at rest
  - Unique project tokens (unguessable UUIDs)
- **Scalability**:
  - Single‑tenant MVP; architecture supports tenant\_id annotation
- **Accessibility**:
  - WCAG 2.1 AA compliance for core UI components

---

## 6. Technical Architecture

**Frontend**:

- Next.js + React + Tailwind CSS
- Pages: `/onboard`, `/session/[token]/upload`, `/session/[token]/transcript`, `/session/[token]/outline`, `/session/[token]/draft`, `/session/[token]/export`

**Backend**:

- Next.js API routes (Node.js)
- Supabase/Postgres for metadata & transcripts
- Supabase Storage for audio & PDFs

**AI Services**:

- Whisper API for transcription
- GPT-4 (or other model via OpenAI API) for outline & draft generation

**PDF Generation**:

- Puppeteer headless Chrome rendering

---

## 7. Data Model & API Contracts

**Core Tables**

- `interviewees(id UUID PK, name, dob, themes JSON, output_prefs JSON, tenant_id UUID)`
- `sessions(id UUID PK, interviewee_id FK, audio_url, transcript_id FK, tenant_id UUID)`
- `transcripts(id UUID PK, session_id FK, text TEXT, timestamps JSON, tenant_id UUID)`
- `outlines(id UUID PK, session_id FK, structure JSON, approved BOOL, tenant_id UUID)`
- `draft_chapters(id UUID PK, outline_id FK, title, content TEXT, status TEXT, tenant_id UUID)`

**Key Endpoints**

```txt
POST /api/onboard              → create interviewee
POST /api/upload-audio        → upload audio file
POST /api/transcribe          → trigger Whisper, return transcript_id
POST /api/outline             → generate & store outline JSON
POST /api/draft               → generate draft chapters
GET  /api/export-pdf          → render & return PDF
```

---

## 8. AI Prompt Specifications

### Outline Generation Prompt

```text
SYSTEM: You are a memoir outline generator. Given an interview transcript and interviewee metadata (name, themes, desired length), produce a JSON object with "chapters": [{"title": "", "bullets": [""]}]. Aim for 5–7 chapters that reflect core life moments.

USER: Transcript: <TRANSCRIPT_TEXT>  
Metadata: { name: "Jane Doe", themes: ["childhood", "career"], output: "coffee-table book" }
```

### Draft Generation Prompt

```text
SYSTEM: You are a warm, conversational memoir writer. For chapter titled "Early Adventures", draft ~300 words using these transcript excerpts: <EXCERPTS>. Maintain consistent tone and weave personal details.
```

---

## 9. UX/UI Requirements & Wireframes

- **Onboard Page**: Simple form, progress bar at top
- **Upload Page**: Drag-and-drop area, file list with upload status
- **Transcript Page**: Editable text area with timestamp markers
- **Outline Page**: Collapsible chapter list with edit icons
- **Draft Page**: Accordion for each chapter, regenerate & accept buttons
- **Export Page**: Preview thumbnail, "Download PDF" button

*Wireframes to be sketched in Figma; provide basic layout descriptions in handoff.*

---

## 10. MVP Deliverables

| Phase   | Deliverables                                        |   |
| ------- | --------------------------------------------------- | - |
| Phase 1 | Guest flow: Onboard → Upload → Transcribe → Outline |   |
| Phase 2 | Draft gen + UI controls + PDF export                |   |
| Phase 3 | Project-token auth & tenant\_id wiring              |   |

*No hard launch date; iterative demos to stakeholder (you) after each phase.*

---

## 11. Risks, Assumptions & Dependencies

- **Risks**:
  - Whisper transcription accuracy varies by audio quality
  - OpenAI rate limits & cost overruns
- **Assumptions**:
  - Users can provide reasonably clear audio files
- **Dependencies**:
  - OpenAI API access
  - Hosting (netlify or similar)
  - PDF rendering service (Puppeteer)

---

## 12. Out‑of‑Scope for MVP

- Full user account management & permissions
- Live in-browser recording (only file uploads)
- Rich photo layout & design beyond simple inline images

---

## 13. Future Enhancements

These features are planned for post-MVP once core functionality is validated:

- **Live In‑Browser Recording**:

  - **Description**: Enable users to record audio directly via the browser using the MediaRecorder API instead of uploading files.
  - **Complexity**: Moderate—requires a React `<Recorder>` component to capture audio streams, a backend endpoint to accept Blob uploads, and UI controls for start/stop/pause.
  - **Estimated Effort**: 1–2 developer days when added post-MVP.
  - **Integration Considerations**: Leverages existing file‑upload and transcription pipeline; minimal schema changes if audio blob uploads map to the same storage endpoint.

- **Multi-Session Interview Series**:

  - Allow chaining multiple recording sessions into a single project book.

- **Rich Photo Layouts**:

  - Advanced page design and image galleries within the PDF export.

---

## 14. Branding Guidelines Branding Guidelines

- **Mood**: Warmth, familiarity, contentedness
- **Color Palette**:
  - Soft Beige: `#F5E1DA`
  - Terracotta Accent: `#D98880`
  - Warm Brown Text: `#5A3E36`
- **Typography**:
  - Headings: Serif (e.g., Merriweather)
  - Body: Sans-serif (e.g., Lato)
- **Imagery**: Organic shapes, subtle gradients, minimal icons

---

## 14. Compliance & Data Retention

- **Data Retention**: Default retention of user data for 1 year
- **Privacy**: Provide users a “Delete Project” button
- **Regulations**: CCPA readiness (notice & deletion requests)

---

## Building Steps

Here are some specific building and architecture steps to help guide you:

Building steps:

-------------

1. **Project scaffold**  
   - Create a new Next.js + Tailwind CSS project  
   - Install/configure Supabase (Postgres) and Supabase Storage  
   - Install OpenAI SDK and Puppeteer  

2. **Define folder & file structure**  
   - `/pages` with routes: `/onboard`, `/session/[token]/upload`, `/session/[token]/transcript`, `/session/[token]/outline`, `/session/[token]/draft`, `/session/[token]/export`  
   - `/components`: shared form elements, `<Recorder>` stub  
   - `/lib`: Supabase client, OpenAI client, tenant/token middleware  
   - `/api`: API routes, one per PRD endpoint  

3. **Scaffold “Onboard” feature**  
   - Page UI: form fields per PRD (name, DOB, themes, output prefs)  
   - API route `POST /api/onboard` to insert into `interviewees` table  

4. **Scaffold “Audio Upload” feature**  
   - Page UI: drag’n’drop file uploader, max-duration enforcement  
   - API route `POST /api/upload-audio` to store file in Supabase Storage and return URL  

5. **Transcription pipeline**  
   - API route `POST /api/transcribe` that fetches the audio URL, calls OpenAI Whisper, and writes to `transcripts` table  

6. **Outline generation**  
   - API route `POST /api/outline` that retrieves transcript text + metadata and calls GPT-4 using the PRD’s outline prompt spec  
   - Save JSON outline to `outlines` table  

7. **Draft generation**  
   - API route `POST /api/draft` that loops through outline nodes, calls GPT-4 with the PRD’s draft prompt, and saves to `draft_chapters` table  

8. **PDF export**  
   - API route `GET /api/export-pdf` that renders a styled HTML template of chapters + photos, then uses Puppeteer to return a PDF buffer  

9. **Middleware & shared utilities**  
   - Tenant/token resolution middleware that reads `tenant_id` or `projectToken` from req  
   - Database helper functions wrapping Supabase queries with tenant scoping  

10. **Basic styling & branding**  
   - Apply PRD’s color palette (Soft Beige, Terracotta, Warm Brown), font choices, and simple responsive layout  

-----------------------------


