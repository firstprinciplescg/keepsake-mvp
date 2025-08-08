-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Core tables
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  token_used_at timestamptz,
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tenant_id uuid
);

create table if not exists interviewees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  dob date,
  relationship text,
  themes jsonb default '[]'::jsonb,
  output_prefs jsonb default '{}'::jsonb,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  interviewee_id uuid references interviewees(id) on delete set null,
  audio_url text,
  duration_seconds int,
  transcript_id uuid,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  text text,
  segments jsonb default '[]'::jsonb,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists outlines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  structure jsonb not null,
  approved boolean not null default false,
  approved_at timestamptz,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists draft_chapters (
  id uuid primary key default gen_random_uuid(),
  outline_id uuid not null references outlines(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'generated',
  regen_count int not null default 0,
  version int not null default 1,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
