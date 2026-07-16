-- =====================================================================
-- RUN THIS in Supabase → SQL Editor (safe to re-run)
-- Creates fr_companies for company portals (slug + username + password)
-- =====================================================================

create table if not exists public.fr_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  username text not null,
  password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  unique (name)
);

alter table public.fr_companies enable row level security;

drop policy if exists fr_companies_researcher on public.fr_companies;
create policy fr_companies_researcher on public.fr_companies
  for all using (public.fr_user_role() = 'researcher')
  with check (public.fr_user_role() = 'researcher');

-- Optional seed for known demo companies:
insert into public.fr_companies (name, slug, username, password)
values
  ('سعودي تريند', 'saudi-trend', '2222', '222222'),
  ('شركة نخبة التسويق', 'nokhba', '3333', '333333')
on conflict (slug) do update set
  username = excluded.username,
  password = excluded.password,
  name = excluded.name,
  updated_at = now();
