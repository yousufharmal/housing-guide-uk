-- =============================================================================
-- Housing Guide UK — database schema
-- =============================================================================
-- Run this file once in the Supabase SQL Editor (or via `supabase db push`)
-- on a fresh project, before functions.sql, policies.sql and seed.sql.
--
-- Order matters: schema.sql -> functions.sql -> policies.sql -> seed.sql
-- =============================================================================

create extension if not exists "pgcrypto"; -- gives us gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Shared helper: keeps `updated_at` current on every UPDATE.
-- Defined here (schema.sql) because the triggers that use it are created
-- right next to the tables they belong to.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- admin_users
-- Marks which Supabase Auth users are allowed into the admin dashboard.
-- One row per admin, keyed by their auth.users id. There is no public
-- "role" column on a shared users table — an empty admin_users table means
-- nobody is an admin, which is the safe default.
-- =============================================================================
create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- cities
-- Every city has its OWN image_url. There is no global/shared fallback
-- image anywhere in this schema — each row is independent.
-- =============================================================================
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cities_name_unique unique (name)
);

create trigger cities_set_updated_at
  before update on public.cities
  for each row
  execute function public.set_updated_at();

create index if not exists cities_enabled_order_idx
  on public.cities (enabled, display_order);

-- =============================================================================
-- reviews
-- The public-facing review content. Deliberately holds NO personal contact
-- information — that lives in review_contacts, a separate, private table.
-- =============================================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete restrict,

  -- Accommodation
  accommodation_name text not null,
  location text,
  housing_type text not null
    check (housing_type in ('studio', 'shared_house', 'shared_flat', 'halls', 'private_flat', 'other')),
  bedrooms integer
    check (bedrooms is null or bedrooms >= 0),

  -- Costs
  rent numeric(10, 2) not null check (rent >= 0),
  rent_period text not null default 'monthly'
    check (rent_period in ('weekly', 'monthly', 'yearly')),
  bills numeric(10, 2) not null default 0 check (bills >= 0),

  -- Experience (1-5 rating scales unless noted)
  furnishing integer check (furnishing between 1 and 5),
  facilities integer check (facilities between 1 and 5),
  sound integer check (sound between 1 and 5),
  management integer check (management between 1 and 5),
  maintenance integer check (maintenance between 1 and 5),
  area_location_services integer check (area_location_services between 1 and 5),
  internet integer check (internet between 1 and 5),
  recommendation boolean,
  overall_rating integer not null check (overall_rating between 1 and 5),

  -- Written review
  pros text,
  cons text,
  advice text,
  student_type text
    check (student_type is null or student_type in ('undergraduate', 'postgraduate', 'international', 'exchange', 'other')),

  -- Moderation
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'deleted')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

-- A brand new review must always start out pending, no matter what the
-- client sends. Defence in depth alongside the RLS insert policy.
create or replace function public.force_review_status_pending()
returns trigger
language plpgsql
as $$
begin
  new.status = 'pending';
  return new;
end;
$$;

create trigger reviews_force_pending_on_insert
  before insert on public.reviews
  for each row
  execute function public.force_review_status_pending();

create index if not exists reviews_status_idx on public.reviews (status);
create index if not exists reviews_city_id_idx on public.reviews (city_id);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- =============================================================================
-- review_contacts
-- Personal contact info, kept in its own table with no public read access.
-- One-to-one with reviews.
-- =============================================================================
create table if not exists public.review_contacts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- review_photos
-- One review can have zero, one, or many photos (max 5 enforced in the app
-- and by the trigger below). photo_path stores the Supabase Storage object
-- path (bucket: review-photos), never the raw image bytes.
-- =============================================================================
create table if not exists public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  photo_path text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists review_photos_review_id_idx on public.review_photos (review_id);

create or replace function public.enforce_max_five_photos()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.review_photos where review_id = new.review_id) >= 5 then
    raise exception 'A review can have a maximum of 5 photos';
  end if;
  return new;
end;
$$;

create trigger review_photos_max_five
  before insert on public.review_photos
  for each row
  execute function public.enforce_max_five_photos();

-- =============================================================================
-- form_fields
-- Lets admins control which review-form questions are shown, whether they
-- are required, which step they appear on, and their order — without
-- needing a schema change. field_key matches a known review column name.
-- =============================================================================
create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label text not null,
  step integer not null check (step between 1 and 4),
  required boolean not null default false,
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger form_fields_set_updated_at
  before update on public.form_fields
  for each row
  execute function public.set_updated_at();

create index if not exists form_fields_step_order_idx
  on public.form_fields (step, display_order);

-- =============================================================================
-- site_settings
-- Simple key/value store for editable website copy (hero title, hero
-- subtitle, contact email, ...).
-- =============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- review_submission_attempts
-- Anti-spam / rate-limiting log. Rows are written by the
-- check_submission_rate_limit() function in functions.sql, never inserted
-- directly by the client. No public read access (see policies.sql).
-- =============================================================================
create table if not exists public.review_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_submission_attempts_identifier_idx
  on public.review_submission_attempts (identifier, created_at);
