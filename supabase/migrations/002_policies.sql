-- Row Level Security (RLS)
alter table projects enable row level security;
alter table interviewees enable row level security;
alter table sessions enable row level security;
alter table transcripts enable row level security;
alter table outlines enable row level security;
alter table draft_chapters enable row level security;
alter table events enable row level security;

-- For MVP, block anon access (server-only via service role). Adjust later if client DB access is introduced.
create policy deny_all_projects on projects for all using (false);
create policy deny_all_interviewees on interviewees for all using (false);
create policy deny_all_sessions on sessions for all using (false);
create policy deny_all_transcripts on transcripts for all using (false);
create policy deny_all_outlines on outlines for all using (false);
create policy deny_all_draft_chapters on draft_chapters for all using (false);
create policy deny_all_events on events for all using (false);
