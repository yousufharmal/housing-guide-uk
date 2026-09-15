# Housing Guide UK

**UK Student Accommodation Guide**

Housing Guide UK helps university students find and understand student
accommodation through real student experiences and reviews.

> This README is being filled in as the project is built. See the commit
> history for what's implemented so far. The full guide (technology,
> database, storage, authentication, local development, testing) is
> completed in a later commit.

## Status

- [x] Project scaffolding
- [x] Database schema
- [x] Public website (cities + review browsing)
- [x] Review submission form
- [x] Admin dashboard
- [x] City management
- [x] Review photo uploads
- [x] Photo moderation
- [x] Seed data + admin test account
- [ ] Full documentation

## Project structure

```text
housing-guide-uk/
├── index.html          Public website (single page, sectioned by anchor)
├── admin.html           Admin dashboard (requires login)
├── css/
│   └── style.css        All styles for both public site and admin dashboard
├── js/
│   ├── supabase.js       Creates the one shared Supabase client
│   ├── app.js             Public site shell: nav, site settings, cities
│   ├── reviews.js         Review browsing + the 3-step submission form
│   ├── admin.js            Admin auth + dashboard
│   ├── config.example.js    Template for your local Supabase keys
│   └── config.js             Your real local keys (gitignored, not committed)
├── database/
│   ├── schema.sql        Tables, relationships, constraints
│   ├── functions.sql      Helper functions (rate limiting, timestamps)
│   ├── policies.sql        Row Level Security + Storage policies
│   └── seed.sql              Development seed data
├── .env.example
└── .gitignore
```
