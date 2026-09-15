# Housing Guide UK

**UK Student Accommodation Guide**

Housing Guide UK helps university students find and understand student
accommodation through real student experiences and reviews. Students browse
UK cities and approved reviews without needing an account, and can submit
their own review (with optional photos) for the team to check before it goes
live. Admins log in to a separate dashboard to moderate submissions, manage
cities, manage the review form, and edit site copy.

This project is built from scratch with plain HTML/CSS/JavaScript on the
frontend and [Supabase](https://supabase.com) as the entire backend — no
custom server to run or deploy.

---

## What is Housing Guide UK?

A lot of UK student accommodation decisions get made from polished landlord
marketing pages, not from what it's actually like to live somewhere.
Housing Guide UK exists to fix that gap: every review on the public site was
written by a real student and checked by a human before it's published.

- **Public website** — browse cities, browse approved reviews, filter by
  city, see photos, and submit your own review. No account needed.
- **Admin dashboard** — a separate, authenticated area where the team
  approves/rejects submissions, manages which cities are shown (with their
  own photo each), controls which questions appear on the review form, and
  edits site copy like the homepage hero text.

---

## Technology

| Layer | What's used | Why |
|---|---|---|
| Frontend | Plain HTML, CSS, JavaScript (ES modules) | No build step — open the files and read them. No React/Next.js needed for a site this size. |
| Backend | [Supabase](https://supabase.com) | One hosted service that gives us a real Postgres database, authentication, file storage, and fine-grained security rules, without writing a custom server. |
| Database | PostgreSQL (via Supabase) | Stores cities, reviews, photos metadata, form config and site settings as proper relational tables. |
| Auth | Supabase Auth | Handles admin login (email + password) and password hashing. We never see or store a raw password ourselves. |
| File storage | Supabase Storage | Stores the actual review photo files (the database only stores a *path* to each file, never the image bytes). |
| Access control | Postgres Row Level Security (RLS) | Enforced *inside the database itself* — even if someone bypassed our frontend entirely and called the API directly, RLS still applies. |

Because there's no bundler, the frontend loads the Supabase JavaScript
library straight from a CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`)
using a standard `<script type="module">` tag — no `npm install` required.

---

## Project structure

```text
housing-guide-uk/
├── index.html              Public website (one page, sectioned by anchor: #home #cities #reviews #submit #contact)
├── admin.html               Admin dashboard (login screen + 6-tab dashboard)
├── css/
│   └── style.css            All styles — a small design system (colours/spacing) plus component + admin styles
├── js/
│   ├── supabase.js           Creates the one shared Supabase client used everywhere
│   ├── app.js                  Public site shell: mobile nav, site settings, city grid
│   ├── reviews.js              Review browsing, the 3-step submission form, photo upload, the lightbox
│   ├── admin.js                 Admin login + all 6 dashboard tabs
│   ├── config.example.js         Template for your local Supabase keys
│   └── config.js                  Your real local keys — gitignored, never committed
├── database/
│   ├── schema.sql             Tables, relationships, constraints — run this first
│   ├── functions.sql           Helper functions: is_admin(), rate limiting, set_review_status() — run second
│   ├── policies.sql             Row Level Security + Storage bucket policies — run third
│   └── seed.sql                  Development seed data (cities, sample reviews, admin setup) — run last, optional
├── .env.example                Documents the two Supabase values the site needs
└── .gitignore
```

---

## Database

Run the four files in `database/` **in order** (schema → functions →
policies → seed) in the Supabase SQL Editor. Each one is idempotent —
re-running them won't duplicate data or error out.

### `cities`
One row per city shown on the homepage. `image_url` is **per-city** — there
is no shared/global fallback image anywhere in the app. `enabled` and
`display_order` control what's shown publicly and in what order.

### `reviews`
The public-facing content of a review (accommodation details, cost,
experience ratings, written pros/cons/advice). `status` is one of
`pending` / `approved` / `deleted`. A database trigger forces every new
review to start as `pending` no matter what the client sends — only an
admin, via the `set_review_status()` function, can change it.

### `review_contacts`
The submitter's name and email, kept in a **separate table** from
`reviews` with no public read access at all. Only admins can see it. This
is what lets us show public reviews while keeping contact details private.

### `review_photos`
One row per uploaded photo (`review_id`, `photo_path`, `display_order`). A
review can have 0–5 photos (enforced by a database trigger). The table only
stores the *path* to the file in Supabase Storage — never the image itself.

### `form_fields`
Lets admins control the *optional* review-form questions (label, which of
the 3 steps it's on, required/enabled, display order) without touching code.
Core required fields (city, accommodation name, housing type, rent, rent
period, overall rating) are enforced by database `NOT NULL` constraints and
are intentionally not toggleable here, so the form can never disagree with
the database.

### `site_settings`
A simple key → value table for editable site copy: `hero_title`,
`hero_subtitle`, `contact_email`.

### `review_submission_attempts`
An anti-spam log, written only by the `check_submission_rate_limit()`
database function (max 5 submissions per email per 30 minutes). Nothing —
not even an admin — can read this table directly through the API; it's
purely an internal rate-limit counter.

### `admin_users`
Marks which Supabase Auth users are allowed into the admin dashboard. An
empty table means *nobody* is an admin, which is the safe default. See
[Authentication](#authentication) below for how someone gets added.

---

## Storage

Two Supabase Storage buckets, created by `database/policies.sql`:

- **`review-photos`** (private) — uploaded review photos. RLS policies on
  `storage.objects` only allow a photo to be viewed publicly if its review's
  `status = 'approved'`; while a review is pending, only an admin session
  can view it. The frontend never uses a raw public URL for this bucket —
  it always calls `createSignedUrl()` / `createSignedUrls()`, which itself
  enforces those same RLS rules before handing back a temporary link.
- **`city-images`** (public) — city photos. These have no privacy
  requirement (every enabled city is already public), so this bucket serves
  files through a normal public URL. Only admins can upload, replace or
  delete files in it.

---

## Authentication

Admin login uses Supabase Auth's email + password sign-in
(`supabase.auth.signInWithPassword`) — Supabase handles password hashing
and session tokens; this codebase never touches a raw password.

Signing in is not the same as being an admin, though. After a successful
sign-in, `admin.js` calls the `is_admin()` database function. If the
signed-in user's id isn't in the `admin_users` table, they're immediately
signed back out with an error. This same `is_admin()` check is what every
Row Level Security policy uses to decide what an authenticated user is
allowed to read or change — so even if someone bypassed the login screen
entirely, the database itself would still refuse to show them pending
reviews, contact details, or let them approve anything.

**No credentials are ever hardcoded in frontend JavaScript.** The Supabase
anon key in `js/config.js` is a public, restricted key — see
`.env.example` for why that's safe.

### Creating the admin test account

Supabase Auth users can only be created through Supabase Auth itself (the
Dashboard, the Admin API, or `signUp`) — plain SQL can't produce a correctly
hashed password, so this is a one-time manual step:

1. Supabase Dashboard → **Authentication → Users → Add user**
   - Email: `admin@test.com`
   - Password: `Admin123!`
   - Tick **Auto Confirm User**
2. In the SQL Editor, run the last block of `database/seed.sql` (or just
   this, which is safe to re-run):
   ```sql
   insert into public.admin_users (id, email)
   select id, email from auth.users where email = 'admin@test.com'
   on conflict (id) do nothing;
   ```

> `admin@test.com` / `Admin123!` is a **development/testing account only**.
> Don't use it (or reuse that password) for a real deployment — create a
> proper admin account the same way and delete or disable this one.

---

## Local development

You've never done this before? Here's every step.

### 1. Clone the repository
```bash
git clone https://github.com/yousufharmal/housing-guide-uk.git
cd housing-guide-uk
```

### 2. Open it in VS Code
```bash
code .
```

### 3. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. Once it's ready, open **Project Settings → API** and note down:
   - **Project URL**
   - **anon / public key**

### 4. Set up the database
In the Supabase Dashboard, open the **SQL Editor** and run these files
**in this exact order**, pasting each file's contents and clicking Run:
1. `database/schema.sql`
2. `database/functions.sql`
3. `database/policies.sql`
4. `database/seed.sql` (optional, but recommended for local development —
   adds sample cities and reviews so the site isn't empty)

### 5. Configure environment variables
```bash
cp js/config.example.js js/config.js
```
Open `js/config.js` and paste in your Project URL and anon key from step 3.
This file is gitignored, so your keys stay local.

### 6. Create the admin test account
Follow [Creating the admin test account](#creating-the-admin-test-account)
above.

### 7. Run the frontend locally
There's no build step — you just need *something* serving static files
(opening `index.html` directly with `file://` will not work, because
browsers block ES module imports over `file://`). The simplest option:
```bash
python3 -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

(Any other static server works too — e.g. the VS Code "Live Server"
extension, or `npx serve`.)

### 8. Log into the admin dashboard
Go to **http://localhost:8000/admin.html** and sign in with
`admin@test.com` / `Admin123!`.

### 9. Test submitting a review
On the public site, scroll to **Share Your Experience**, fill in the
3-step form, and submit. It won't appear on the public Reviews section yet
— it starts as `pending`. Go to the admin dashboard's **New Submissions**
tab, review it, and click **Approve**. Refresh the public site and it
should now appear under Reviews.

### 10. Test uploading photos
In the same submission form, add up to 5 JPG/PNG/WEBP photos (under 5MB
each) before submitting — you can preview and remove them before you
submit. After the admin approves that review, the photos appear in its
public review card; click one to view it larger.

---

## Security notes

- Pending and deleted reviews are never returned by the public API (RLS).
- Pending review photos are never publicly viewable — only signed URLs,
  generated after an RLS check, ever reveal them; the bucket itself is
  private.
- `review_contacts` has no public read policy at all.
- A submitter can't edit another person's review, attach photos to another
  person's review, or delete anyone's photos — RLS only allows attaching
  photos to a review that is still `pending`, and pending review ids are
  never exposed through any public listing.
- Admin pages require both a valid Supabase Auth session **and** a row in
  `admin_users` — checked both in the UI and inside every RLS policy.
- No `service_role` key, database password, or other secret ever appears in
  frontend code — only the restricted `anon` key, which can only do what
  `database/policies.sql` explicitly allows.

---

## License / status

This is a development build. Sample data in `database/seed.sql` (including
the admin test account) is for local development and demos only.
