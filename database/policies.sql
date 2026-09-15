-- =============================================================================
-- Housing Guide UK — Row Level Security policies
-- =============================================================================
-- Run after schema.sql and functions.sql.
--
-- Security model in one sentence: the anon (public) role can read approved,
-- enabled, public-facing data and can create pending reviews/photos/contacts,
-- but can never read private data (contacts, pending photos, deleted
-- reviews) or moderate anything. Only rows in admin_users, acting through
-- an authenticated Supabase Auth session, can do those things.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_users
-- No public policies at all. Admin status is only ever read through the
-- SECURITY DEFINER is_admin() function, never by selecting this table
-- directly from the client.
-- -----------------------------------------------------------------------------
alter table public.admin_users enable row level security;

create policy "Admins can view the admin list"
  on public.admin_users for select
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- cities
-- -----------------------------------------------------------------------------
alter table public.cities enable row level security;

create policy "Anyone can view enabled cities"
  on public.cities for select
  using (enabled = true or public.is_admin());

create policy "Admins can insert cities"
  on public.cities for insert
  with check (public.is_admin());

create policy "Admins can update cities"
  on public.cities for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete cities"
  on public.cities for delete
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- reviews
-- Public: read approved only. Public: insert allowed (status is forced to
-- 'pending' by the trigger in schema.sql regardless of what's sent).
-- Only admins can update (approve/delete) or delete reviews.
-- -----------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "Anyone can view approved reviews"
  on public.reviews for select
  using (status = 'approved' or public.is_admin());

create policy "Anyone can submit a review"
  on public.reviews for insert
  with check (true);

create policy "Admins can update reviews"
  on public.reviews for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete reviews"
  on public.reviews for delete
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- review_contacts
-- Never publicly readable. Anyone can insert one contact row when
-- submitting a review (paired with the review they just created in the
-- same request); only admins can read it.
-- -----------------------------------------------------------------------------
alter table public.review_contacts enable row level security;

create policy "Admins can view review contacts"
  on public.review_contacts for select
  using (public.is_admin());

create policy "Anyone can submit contact info with a review"
  on public.review_contacts for insert
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.status = 'pending'
    )
  );

create policy "Admins can delete review contacts"
  on public.review_contacts for delete
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- review_photos
-- Public can only see photo rows belonging to approved reviews. Public can
-- only attach photos to a review that is still pending (i.e. only during
-- the original submission — not afterwards, and not to someone else's
-- already-approved review).
-- -----------------------------------------------------------------------------
alter table public.review_photos enable row level security;

create policy "Anyone can view photos of approved reviews"
  on public.review_photos for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.status = 'approved'
    )
  );

create policy "Anyone can attach photos to a pending review"
  on public.review_photos for insert
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.status = 'pending'
    )
  );

create policy "Admins can delete review photos"
  on public.review_photos for delete
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- form_fields
-- -----------------------------------------------------------------------------
alter table public.form_fields enable row level security;

create policy "Anyone can view enabled form fields"
  on public.form_fields for select
  using (enabled = true or public.is_admin());

create policy "Admins can insert form fields"
  on public.form_fields for insert
  with check (public.is_admin());

create policy "Admins can update form fields"
  on public.form_fields for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete form fields"
  on public.form_fields for delete
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- site_settings
-- Publicly readable (hero text, contact email are shown on every page load)
-- but only admins can change them.
-- -----------------------------------------------------------------------------
alter table public.site_settings enable row level security;

create policy "Anyone can view site settings"
  on public.site_settings for select
  using (true);

create policy "Admins can insert site settings"
  on public.site_settings for insert
  with check (public.is_admin());

create policy "Admins can update site settings"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- review_submission_attempts
-- No policies for anon/authenticated at all — every access goes through
-- the SECURITY DEFINER check_submission_rate_limit() function in
-- functions.sql, which bypasses RLS. With RLS enabled and zero policies,
-- direct table access is denied to everyone except the table owner.
-- -----------------------------------------------------------------------------
alter table public.review_submission_attempts enable row level security;

-- =============================================================================
-- Storage: review-photos bucket
-- =============================================================================
-- Create the bucket itself (id + name must match REVIEW_PHOTOS_BUCKET in
-- js/supabase.js). public = false is essential: photos are only ever
-- served through createSignedUrl(), which enforces the SELECT policies
-- below. If this bucket were public, anyone could guess/share a direct URL
-- and bypass RLS entirely.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  false,
  5242880, -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Object paths are always "<review_id>/<filename>", so
-- (storage.foldername(name))[1] recovers the review id.

create policy "Anyone can view photos of approved reviews in storage"
  on storage.objects for select
  using (
    bucket_id = 'review-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.reviews r
        where r.id::text = (storage.foldername(name))[1]
          and r.status = 'approved'
      )
    )
  );

create policy "Anyone can upload photos to a pending review"
  on storage.objects for insert
  with check (
    bucket_id = 'review-photos'
    and exists (
      select 1 from public.reviews r
      where r.id::text = (storage.foldername(name))[1]
        and r.status = 'pending'
    )
  );

create policy "Admins can delete review photo files"
  on storage.objects for delete
  using (bucket_id = 'review-photos' and public.is_admin());
