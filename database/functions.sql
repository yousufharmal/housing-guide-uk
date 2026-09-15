-- =============================================================================
-- Housing Guide UK — database functions
-- =============================================================================
-- Run after schema.sql and before policies.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin()
-- True if the currently authenticated user (auth.uid()) is in admin_users.
-- SECURITY DEFINER so it can read admin_users even though that table itself
-- has no public select policy. Used throughout policies.sql.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- check_submission_rate_limit(identifier)
-- Anti-spam gate for the public review form. Allows at most 5 submissions
-- per identifier (we use the submitter's email, lower-cased) in a rolling
-- 30-minute window. Returns true and logs an attempt if allowed; returns
-- false (and logs nothing further) if the limit has been hit.
--
-- SECURITY DEFINER so it can write to review_submission_attempts, a table
-- the anon role has no direct INSERT/SELECT access to (see policies.sql).
-- This keeps the attempts log itself private while still letting anyone
-- call this one narrow, rate-limited function.
-- -----------------------------------------------------------------------------
create or replace function public.check_submission_rate_limit(p_identifier text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := lower(trim(p_identifier));
  v_recent_count integer;
begin
  if v_identifier is null or v_identifier = '' then
    v_identifier := 'unknown';
  end if;

  select count(*) into v_recent_count
  from public.review_submission_attempts
  where identifier = v_identifier
    and created_at > now() - interval '30 minutes';

  if v_recent_count >= 5 then
    return false;
  end if;

  insert into public.review_submission_attempts (identifier)
  values (v_identifier);

  return true;
end;
$$;

grant execute on function public.check_submission_rate_limit(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- set_review_status(review_id, new_status)
-- Admin-only helper to approve or delete/reject a review. Wrapping the
-- update in a function (rather than relying solely on a table UPDATE
-- policy) keeps the allowed status transitions in one obvious place.
-- -----------------------------------------------------------------------------
create or replace function public.set_review_status(p_review_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a review status';
  end if;

  if p_status not in ('pending', 'approved', 'deleted') then
    raise exception 'Invalid review status: %', p_status;
  end if;

  update public.reviews
  set status = p_status
  where id = p_review_id;
end;
$$;

grant execute on function public.set_review_status(uuid, text) to authenticated;
