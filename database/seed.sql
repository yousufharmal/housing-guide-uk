-- =============================================================================
-- Housing Guide UK — development seed data
-- =============================================================================
-- Run this AFTER schema.sql, functions.sql and policies.sql, in the
-- Supabase SQL Editor. It is safe to re-run: cities are matched by name,
-- settings by key, and everything else only inserts if the table is empty,
-- so it will never duplicate rows or overwrite real production data.
--
-- This file is for local development / demo purposes only. City images use
-- picsum.photos placeholder images (free, no attribution required) — swap
-- in real photos via the admin City Management tab whenever you like.
-- Sample review photos likewise use placeholder image URLs directly rather
-- than real Supabase Storage uploads, since plain SQL can't upload files.
-- The frontend understands both a Storage path and a full URL in
-- review_photos.photo_path, so these display correctly either way.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cities — every one gets its own distinct image, never a shared fallback.
-- -----------------------------------------------------------------------------
insert into public.cities (name, image_url, enabled, display_order)
values
  ('Manchester', 'https://picsum.photos/seed/hg-manchester/800/600', true, 1),
  ('Edinburgh',  'https://picsum.photos/seed/hg-edinburgh/800/600',  true, 2),
  ('Glasgow',    'https://picsum.photos/seed/hg-glasgow/800/600',    true, 3),
  ('Liverpool',  'https://picsum.photos/seed/hg-liverpool/800/600',  true, 4),
  ('London',     'https://picsum.photos/seed/hg-london/800/600',     true, 5),
  ('Birmingham', 'https://picsum.photos/seed/hg-birmingham/800/600', true, 6),
  ('Leeds',      'https://picsum.photos/seed/hg-leeds/800/600',      true, 7),
  ('Nottingham', 'https://picsum.photos/seed/hg-nottingham/800/600', true, 8),
  ('Other City', 'https://picsum.photos/seed/hg-othercity/800/600',  true, 9)
on conflict (name) do update
set image_url = excluded.image_url;

-- -----------------------------------------------------------------------------
-- Site settings
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value)
values
  ('hero_title', 'Find student accommodation with confidence, not guesswork'),
  ('hero_subtitle', 'Housing Guide UK collects honest, first-hand reviews from real UK students so you can compare accommodation, costs and landlords before you sign a tenancy agreement — not after.'),
  ('contact_email', 'hello@housingguideuk.example')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Form fields — the optional review-form questions admins can toggle.
-- Core required fields (city, accommodation name, housing type, rent, rent
-- period, overall rating) are enforced at the database level and are
-- deliberately NOT listed here, so admins can't accidentally make the UI
-- disagree with a NOT NULL constraint.
-- -----------------------------------------------------------------------------
insert into public.form_fields (field_key, label, step, required, enabled, display_order)
values
  ('location', 'Location', 1, false, true, 1),
  ('bedrooms', 'Number of bedrooms', 1, false, true, 2),
  ('furnishing', 'Furnishing', 2, true, true, 1),
  ('facilities', 'Facilities', 2, true, true, 2),
  ('sound', 'Sound insulation', 2, true, true, 3),
  ('management', 'Management', 2, true, true, 4),
  ('maintenance', 'Maintenance', 2, true, true, 5),
  ('area_location_services', 'Area, location & services', 2, true, true, 6),
  ('internet', 'Internet', 2, true, true, 7),
  ('recommendation', 'Would you recommend it?', 2, false, true, 8),
  ('pros', 'Pros', 3, true, true, 1),
  ('cons', 'Cons', 3, true, true, 2),
  ('advice', 'Advice for future students', 3, false, true, 3),
  ('student_type', 'Student type', 3, false, true, 4)
on conflict (field_key) do nothing;

-- -----------------------------------------------------------------------------
-- Sample reviews + contacts + photos
-- Only runs if the reviews table is still empty, so it never touches real
-- submissions on a live site.
-- -----------------------------------------------------------------------------
do $$
declare
  v_manchester uuid;
  v_edinburgh uuid;
  v_glasgow uuid;
  v_liverpool uuid;
  v_review_id uuid;
begin
  if exists (select 1 from public.reviews limit 1) then
    raise notice 'Reviews table is not empty — skipping sample review seed data.';
    return;
  end if;

  select id into v_manchester from public.cities where name = 'Manchester';
  select id into v_edinburgh from public.cities where name = 'Edinburgh';
  select id into v_glasgow from public.cities where name = 'Glasgow';
  select id into v_liverpool from public.cities where name = 'Liverpool';

  -- 1. Approved review with MULTIPLE photos.
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_manchester, 'The Pepper Mill', 'Northern Quarter', 'shared_flat', 2, 650, 'monthly', 0,
    4, 4, 3, 5, 4, 5, 4,
    true, 4, 'Great location right in the Northern Quarter, super friendly management team, and all bills genuinely included with no surprises.', 'Walls are a little thin so you can hear neighbours some evenings.', 'Book early — this place fills up fast for September intake.', 'undergraduate', 'pending'
  ) returning id into v_review_id;
  update public.reviews set status = 'approved' where id = v_review_id; -- bypass the pending-on-insert trigger for seed data
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Amelia Clarke', 'amelia.clarke@example.com');
  insert into public.review_photos (review_id, photo_path, display_order) values
    (v_review_id, 'https://picsum.photos/seed/hg-review-pepper-1/600/450', 0),
    (v_review_id, 'https://picsum.photos/seed/hg-review-pepper-2/600/450', 1),
    (v_review_id, 'https://picsum.photos/seed/hg-review-pepper-3/600/450', 2);

  -- 2. Approved review with ONE photo.
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_edinburgh, 'Haymarket Yard', 'Haymarket', 'studio', null, 235, 'weekly', 0,
    5, 5, 4, 4, 4, 5, 5,
    true, 5, 'Brand new building, excellent gym and study spaces, five minutes from the tram.', 'Slightly pricier than other options nearby.', 'Ask for a room on a higher floor for a better view and less street noise.', 'postgraduate', 'pending'
  ) returning id into v_review_id;
  update public.reviews set status = 'approved' where id = v_review_id;
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Noah Fraser', 'noah.fraser@example.com');
  insert into public.review_photos (review_id, photo_path, display_order) values
    (v_review_id, 'https://picsum.photos/seed/hg-review-haymarket-1/600/450', 0);

  -- 3. Approved review with NO photos.
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_edinburgh, 'Prestige Student Living Haymarket Yards', 'Haymarket', 'shared_house', 4, 210, 'weekly', 15,
    3, 4, 3, 3, 3, 4, 4,
    false, 3, 'Decent size rooms and a good kitchen for a shared house.', 'Maintenance requests took a while to get sorted.', 'Check the contract carefully for what "bills" actually covers.', 'undergraduate', 'pending'
  ) returning id into v_review_id;
  update public.reviews set status = 'approved' where id = v_review_id;
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Isla MacDonald', 'isla.macdonald@example.com');

  -- 4. PENDING review with one photo (awaiting moderation).
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_manchester, 'Prestige Student Living Straits Meadow', 'Fallowfield', 'shared_flat', 3, 180, 'weekly', 0,
    4, 3, 4, 4, 3, 4, 3,
    true, 4, 'Close to campus and the Fallowfield nightlife.', 'Could use better bike storage.', 'Get renters insurance for your room, worth the peace of mind.', 'international', 'pending'
  ) returning id into v_review_id;
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Yuki Tanaka', 'yuki.tanaka@example.com');
  insert into public.review_photos (review_id, photo_path, display_order) values
    (v_review_id, 'https://picsum.photos/seed/hg-review-straits-1/600/450', 0);

  -- 5. DELETED / rejected review (should never be publicly visible).
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_glasgow, 'Example Rejected Listing', 'City Centre', 'private_flat', 1, 500, 'monthly', 40,
    2, 2, 2, 1, 2, 3, 2,
    false, 2, 'Test submission used to demonstrate the moderation workflow.', 'This is placeholder/demo content.', 'This review was rejected in the seed data on purpose.', 'other', 'pending'
  ) returning id into v_review_id;
  update public.reviews set status = 'deleted' where id = v_review_id;
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Test Submitter', 'test.rejected@example.com');

  -- 6. Approved review with NO photos, different city, for variety in the feed.
  insert into public.reviews (
    id, city_id, accommodation_name, location, housing_type, bedrooms, rent, rent_period, bills,
    furnishing, facilities, sound, management, maintenance, area_location_services, internet,
    recommendation, overall_rating, pros, cons, advice, student_type, status
  ) values (
    gen_random_uuid(), v_liverpool, 'Baltic Triangle Student Lofts', 'Baltic Triangle', 'shared_flat', 2, 155, 'weekly', 0,
    4, 4, 3, 4, 4, 5, 4,
    true, 4, 'Really creative area to live in, loads of cafes and independent shops nearby.', 'Can be noisy at weekends given the local nightlife.', 'Great if you want to be near the music/arts scene, less so if you want total quiet.', 'exchange', 'pending'
  ) returning id into v_review_id;
  update public.reviews set status = 'approved' where id = v_review_id;
  insert into public.review_contacts (review_id, name, email) values (v_review_id, 'Priya Patel', 'priya.patel@example.com');

  raise notice 'Sample review seed data inserted.';
end $$;

-- -----------------------------------------------------------------------------
-- Admin test account
-- -----------------------------------------------------------------------------
-- Supabase Auth users are created through Supabase Auth itself (Dashboard,
-- Admin API, or supabase.auth.signUp) — plain SQL cannot produce a
-- correctly-hashed password, so this step can't be fully automated here.
--
-- 1. Supabase Dashboard -> Authentication -> Users -> "Add user"
--      Email:    admin@test.com
--      Password: Admin123!
--    Tick "Auto Confirm User" so no email confirmation step is required.
--    (This is a development/testing account only — see README.md.)
--
-- 2. Then run this (safe to re-run; does nothing if already granted, and
--    does nothing if that email doesn't exist yet):
insert into public.admin_users (id, email)
select id, email from auth.users where email = 'admin@test.com'
on conflict (id) do nothing;
