# Security & Privacy Overview (Non-Technical)

**Goal:** Keep each keepsake project private and easy to access without making users create accounts during the MVP.

## Project Tokens (the “private link”)
- You get a unique, hard‑to‑guess link for your project.
- The first time you open it, the system swaps that link for a **secure browser pass** (an HttpOnly cookie). The link itself becomes invalid or rotates.
- If a link is shared by mistake, you can **reset it** to lock out anyone else.

## Private Storage
- Audio and PDFs are stored in **private buckets**—they aren’t publicly reachable by URL.
- Downloads are issued as short‑lived, signed links from our server.

## Data Access
- The database enforces **Row Level Security**, which means each project can only access its own data.
- Everything is tied to a single project ID for simplicity.

## Retention & Deletion
- Projects auto‑expire after a set time (default 1 year).
- “Delete Project” removes database records and files from storage.

## Consent
- We include a quick notice to confirm you have permission to upload and process the interview audio.
