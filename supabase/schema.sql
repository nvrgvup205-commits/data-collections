-- =====================================================================
-- Supabase schema for the Field Research dashboard
-- Run this in your Supabase project's SQL editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles: one row per auth user, holds role + company mapping.
-- role = 'researcher' (collects data) or 'company' (views its reports).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'researcher' check (role in ('researcher', 'company')),
  company_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Sections (categories) — e.g. مطاعم وكافيهات، شركات ...
-- ---------------------------------------------------------------------
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Places: the field-research reports.
-- ---------------------------------------------------------------------
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  researcher_id uuid references auth.users (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  target_company text,            -- الشركة المقدَّم إليها التقرير
  place_name text not null,
  address text,
  address_notes text,
  lat double precision,
  lng double precision,
  manager_name text,
  manager_phone text,
  activity_type text,
  custom_activity text,
  met text check (met in ('yes', 'no', '')),
  meeting_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Photos: metadata; the file itself lives in Storage bucket 'place-photos'.
-- ---------------------------------------------------------------------
create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places (id) on delete cascade,
  storage_path text not null,     -- path within the 'place-photos' bucket
  captured_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.places enable row level security;
alter table public.place_photos enable row level security;

-- Helper: current user's profile role/company.
create or replace function public.current_role() returns text
language sql stable as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_company() returns text
language sql stable as $$ select company_name from public.profiles where id = auth.uid() $$;

-- Profiles: a user can read/update only their own profile.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Sections: readable by any authenticated user; writable by researchers.
drop policy if exists sections_read on public.sections;
create policy sections_read on public.sections
  for select using (auth.role() = 'authenticated');
drop policy if exists sections_write on public.sections;
create policy sections_write on public.sections
  for all using (public.current_role() = 'researcher')
  with check (public.current_role() = 'researcher');

-- Places:
--   researchers: full access.
--   company users: read only the places whose target_company = their company.
drop policy if exists places_researcher on public.places;
create policy places_researcher on public.places
  for all using (public.current_role() = 'researcher')
  with check (public.current_role() = 'researcher');

drop policy if exists places_company_read on public.places;
create policy places_company_read on public.places
  for select using (
    public.current_role() = 'company'
    and target_company = public.current_company()
  );

-- Photos: follow the same visibility as their parent place.
drop policy if exists photos_researcher on public.place_photos;
create policy photos_researcher on public.place_photos
  for all using (public.current_role() = 'researcher')
  with check (public.current_role() = 'researcher');

drop policy if exists photos_company_read on public.place_photos;
create policy photos_company_read on public.place_photos
  for select using (
    public.current_role() = 'company'
    and exists (
      select 1 from public.places p
      where p.id = place_id and p.target_company = public.current_company()
    )
  );

-- ---------------------------------------------------------------------
-- Storage bucket for photos (create in the Storage UI or below).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', false)
on conflict (id) do nothing;

-- =====================================================================
-- Demo accounts (create via Dashboard → Authentication → Users, then set profile):
--   Researcher: email 1111@demo.local  password 1111
--   Company:    email 2222@demo.local  password 2222  (company_name = 'شركة نخبة التسويق')
-- After creating each user, insert their profile, e.g.:
--   insert into public.profiles (id, full_name, role, company_name)
--   values ('<auth-user-uuid>', 'باحث ميداني', 'researcher', null);
--   insert into public.profiles (id, full_name, role, company_name)
--   values ('<auth-user-uuid>', 'شركة نخبة التسويق', 'company', 'شركة نخبة التسويق');
-- The frontend maps the username to <username>@demo.local when signing in.
-- =====================================================================
