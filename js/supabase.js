// js/supabase.js
//
// This is the single place that creates the Supabase client. Every other JS
// file imports `supabase` from here instead of creating its own client.
//
// It reads the project URL + anon key from window.HOUSING_GUIDE_CONFIG,
// which is defined in js/config.js (gitignored — see js/config.example.js).

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.HOUSING_GUIDE_CONFIG || {};

const isPlaceholder =
  !config.SUPABASE_URL ||
  !config.SUPABASE_ANON_KEY ||
  config.SUPABASE_URL.includes("YOUR-PROJECT-REF");

if (isPlaceholder) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Housing Guide UK] Supabase is not configured yet.\n" +
      "Copy js/config.example.js to js/config.js and add your project URL + anon key.\n" +
      "See README.md → Local development."
  );
}

export const supabase = createClient(
  config.SUPABASE_URL || "https://placeholder.supabase.co",
  config.SUPABASE_ANON_KEY || "placeholder-anon-key"
);

// Name of the Supabase Storage bucket that holds review photos.
export const REVIEW_PHOTOS_BUCKET = "review-photos";

// Name of the Supabase Storage bucket that holds city images (public bucket).
export const CITY_IMAGES_BUCKET = "city-images";

// True once js/config.js has real project values in it.
export function isSupabaseConfigured() {
  return !isPlaceholder;
}

// Shows a small banner at the top of the page when Supabase isn't configured,
// so a beginner immediately knows why nothing is loading instead of staring
// at a blank page with only a console warning.
export function renderConfigWarningIfNeeded() {
  if (isSupabaseConfigured()) return;

  const banner = document.createElement("div");
  banner.style.cssText =
    "background:#b91c1c;color:#fff;padding:10px 16px;text-align:center;" +
    "font-family:-apple-system,sans-serif;font-size:0.85rem;position:sticky;" +
    "top:0;z-index:999;";
  banner.textContent =
    "Supabase is not configured. Copy js/config.example.js to js/config.js and add your project keys (see README).";
  document.body.prepend(banner);
}
