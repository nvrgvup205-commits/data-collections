-- =====================================================================
-- Field Research dashboard — Supabase schema
-- SAFE to run in a project that already has other tables (e.g. "مينو مطعم"):
-- every object is prefixed with `fr_` and uses CREATE ... IF NOT EXISTS,
-- so it will NOT touch or overwrite your existing tables.
-- Run this whole file in: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Profiles: one row per auth user (role + which company they represent)
--    role = 'researcher' (collects data) or 'company' (views its reports)
-- ---------------------------------------------------------------------
create table if not exists public.fr_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'researcher' check (role in ('researcher', 'company')),
  company_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Sections (categories)
-- ---------------------------------------------------------------------
create table if not exists public.fr_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) Places (the field-research reports)
-- ---------------------------------------------------------------------
create table if not exists public.fr_places (
  id uuid primary key default gen_random_uuid(),
  researcher_id uuid references auth.users (id) on delete set null,
  section_id uuid references public.fr_sections (id) on delete set null,
  target_company text,               -- الشركة المقدَّم إليها التقرير
  place_name text not null,
  address text,
  address_notes text,
  lat double precision,
  lng double precision,
  manager_name text,
  manager_phone text,
  activity_type text,
  custom_activity text,
  met text,
  meeting_notes text,
  -- موقف العميل من الفكرة: purchased | rejected | objections
  deal_status text check (
    deal_status is null
    or deal_status in ('purchased', 'rejected', 'objections', 'follow_up')
  ),
  rejection_reason text,
  slug text,
  place_username text,
  place_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe re-run: add new columns if the table already existed without them
alter table public.fr_places
  add column if not exists deal_status text;
alter table public.fr_places
  add column if not exists rejection_reason text;
alter table public.fr_places
  add column if not exists slug text;
alter table public.fr_places
  add column if not exists place_username text;
alter table public.fr_places
  add column if not exists place_password text;

do $$
begin
  alter table public.fr_places
    drop constraint if exists fr_places_deal_status_check;
  alter table public.fr_places
    add constraint fr_places_deal_status_check
    check (
      deal_status is null
      or deal_status in ('purchased', 'rejected', 'objections', 'follow_up')
    );
exception when others then null;
end $$;

-- Unique slug when set (allows multiple NULLs / empty)
create unique index if not exists fr_places_slug_unique
  on public.fr_places (slug)
  where slug is not null and slug <> '';

-- ---------------------------------------------------------------------
-- 4) Photos metadata (files live in Storage bucket 'fr-place-photos')
-- ---------------------------------------------------------------------
create table if not exists public.fr_place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.fr_places (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4b) Companies (dedicated portals: slug + credentials set by researcher)
-- ---------------------------------------------------------------------
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

-- Anonymous / company clients read portal files from Storage; this table
-- is managed by researchers only.

-- ---------------------------------------------------------------------
-- 5) Helper functions (prefixed to avoid clashing with built-ins)
-- ---------------------------------------------------------------------
create or replace function public.fr_user_role() returns text
language sql stable security definer as $$
  select role from public.fr_profiles where id = auth.uid()
$$;

create or replace function public.fr_user_company() returns text
language sql stable security definer as $$
  select company_name from public.fr_profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 6) Row Level Security
-- ---------------------------------------------------------------------
alter table public.fr_profiles enable row level security;
alter table public.fr_sections enable row level security;
alter table public.fr_places enable row level security;
alter table public.fr_place_photos enable row level security;

drop policy if exists fr_profiles_self on public.fr_profiles;
create policy fr_profiles_self on public.fr_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists fr_sections_read on public.fr_sections;
create policy fr_sections_read on public.fr_sections
  for select using (auth.role() = 'authenticated');
drop policy if exists fr_sections_write on public.fr_sections;
create policy fr_sections_write on public.fr_sections
  for all using (public.fr_user_role() = 'researcher')
  with check (public.fr_user_role() = 'researcher');

-- Researchers: full access to places. Company users: read only their company's places.
drop policy if exists fr_places_researcher on public.fr_places;
create policy fr_places_researcher on public.fr_places
  for all using (public.fr_user_role() = 'researcher')
  with check (public.fr_user_role() = 'researcher');

drop policy if exists fr_places_company_read on public.fr_places;
create policy fr_places_company_read on public.fr_places
  for select using (
    public.fr_user_role() = 'company'
    and target_company = public.fr_user_company()
  );

drop policy if exists fr_photos_researcher on public.fr_place_photos;
create policy fr_photos_researcher on public.fr_place_photos
  for all using (public.fr_user_role() = 'researcher')
  with check (public.fr_user_role() = 'researcher');

drop policy if exists fr_photos_company_read on public.fr_place_photos;
create policy fr_photos_company_read on public.fr_place_photos
  for select using (
    public.fr_user_role() = 'company'
    and exists (
      select 1 from public.fr_places p
      where p.id = place_id and p.target_company = public.fr_user_company()
    )
  );

-- ---------------------------------------------------------------------
-- 7) Realtime: let the frontend receive live inserts/updates for places
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.fr_places;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.fr_place_photos;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------
-- 8) Storage bucket for photos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fr-place-photos', 'fr-place-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to read/write objects in this bucket.
drop policy if exists fr_photos_bucket_rw on storage.objects;
create policy fr_photos_bucket_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'fr-place-photos')
  with check (bucket_id = 'fr-place-photos');

-- =====================================================================
-- 9) AFTER running the SQL above, create the demo login users:
--    Supabase → Authentication → Users → "Add user" (Auto-confirm), create:
--       1111@demo.local  /  1111
--       2222@demo.local  /  2222
--       3333@demo.local  /  3333
--    Copy each user's UUID (from the Users list), then run the inserts below,
--    replacing the UUIDs:
--
-- insert into public.fr_profiles (id, full_name, role, company_name) values
--   ('<uuid-of-1111>', 'باحث ميداني',        'researcher', null),
--   ('<uuid-of-2222>', 'سعودي تريند',        'company',    'سعودي تريند'),
--   ('<uuid-of-3333>', 'شركة نخبة التسويق',  'company',    'شركة نخبة التسويق');
--
-- The frontend signs in by mapping username -> <username>@demo.local.
-- =====================================================================
