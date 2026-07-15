-- Run this entire file in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'coauthor' check (role in ('owner','coauthor')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.paper_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content text not null default '',
  status text not null default 'not_started'
    check (status in ('not_started','drafting','review','complete')),
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.section_versions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.paper_sections(id) on delete cascade,
  content text not null,
  status text not null,
  saved_by uuid references auth.users(id),
  saved_at timestamptz not null default now()
);

create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  body text not null,
  note_type text not null default 'analysis'
    check (note_type in ('analysis','methodology','literature','question')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.research_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  decision text not null,
  rationale text,
  status text not null default 'open'
    check (status in ('open','decided','revisit')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.paper_sections enable row level security;
alter table public.section_versions enable row level security;
alter table public.research_notes enable row level security;
alter table public.research_decisions enable row level security;

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  );
$$;

create policy "members view projects"
on public.projects for select
using (public.is_project_member(id));

create policy "members view membership"
on public.project_members for select
using (user_id = auth.uid() or public.is_project_member(project_id));

create policy "members view sections"
on public.paper_sections for select
using (public.is_project_member(project_id));

create policy "members update sections"
on public.paper_sections for update
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy "members view versions"
on public.section_versions for select
using (
  exists (
    select 1 from public.paper_sections s
    where s.id = section_id and public.is_project_member(s.project_id)
  )
);

create policy "members insert versions"
on public.section_versions for insert
with check (
  exists (
    select 1 from public.paper_sections s
    where s.id = section_id and public.is_project_member(s.project_id)
  )
);

create policy "members manage notes"
on public.research_notes for all
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy "members manage decisions"
on public.research_decisions for all
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

-- Create one project and the complete manuscript outline.
insert into public.projects (title, description)
values (
  'Detecting Abnormal Trading Behavior in the Nepal Stock Exchange',
  'Full research manuscript and collaborative analysis workspace.'
);

do $$
declare
  pid uuid;
begin
  select id into pid from public.projects
  order by created_at desc limit 1;

  insert into public.paper_sections (project_id, title, sort_order) values
    (pid, 'Abstract', 1),
    (pid, '1. Introduction', 2),
    (pid, '2. Institutional Background: NEPSE', 3),
    (pid, '3. Literature Review', 4),
    (pid, '4. Data and Sample Construction', 5),
    (pid, '5. Methodology', 6),
    (pid, '6. Abnormal Event Identification', 7),
    (pid, '7. Event Study Results', 8),
    (pid, '8. Insider Trading Indicators', 9),
    (pid, '9. Pump-and-Dump Detection', 10),
    (pid, '10. Corporate Announcement Matching', 11),
    (pid, '11. Robustness Tests', 12),
    (pid, '12. Discussion and Interpretation', 13),
    (pid, '13. Regulatory and Market Implications', 14),
    (pid, '14. Limitations', 15),
    (pid, '15. Conclusion', 16),
    (pid, 'References', 17),
    (pid, 'Appendices', 18);
end $$;

-- CREATE BOTH USERS MANUALLY IN AUTHENTICATION > USERS:
-- Use Add user > Create new user, set email/password, and enable Auto confirm user.
-- Then copy their UUIDs and replace the placeholders below.
--
-- insert into public.project_members (project_id, user_id, role)
-- select id, 'YOUR_USER_UUID'::uuid, 'owner'
-- from public.projects order by created_at desc limit 1;
--
-- insert into public.project_members (project_id, user_id, role)
-- select id, 'COAUTHOR_USER_UUID'::uuid, 'coauthor'
-- from public.projects order by created_at desc limit 1;
