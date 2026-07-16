-- Optional: allow follow_up classification on existing DBs
alter table public.fr_places drop constraint if exists fr_places_deal_status_check;
alter table public.fr_places
  add constraint fr_places_deal_status_check
  check (
    deal_status is null
    or deal_status in ('purchased', 'rejected', 'objections', 'follow_up')
  );
