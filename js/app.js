// js/app.js
//
// Shared behaviour for the public site shell: mobile navigation, active
// nav-link highlighting, site settings (hero text, contact email) and the
// city grid.

import { supabase, renderConfigWarningIfNeeded } from "./supabase.js";

renderConfigWarningIfNeeded();

// ---------- Mobile nav toggle ----------
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close the mobile menu after tapping a link.
  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ---------- Active nav-link highlighting on scroll ----------
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".main-nav a");

if (sections.length && navLinks.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
}

// ---------- Small helpers shared with reviews.js could live in their own
// module, but for a beginner-friendly codebase we keep one copy here and
// one copy in reviews.js — simple duplication beats an extra import graph
// for two one-line functions.
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

// ---------- Site settings (hero title/subtitle, contact email) ----------
async function loadSiteSettings() {
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    console.warn("Could not load site settings:", error.message);
    return;
  }

  const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));

  if (settings.hero_title) {
    const heroTitleEl = document.querySelector(".hero h1");
    if (heroTitleEl) heroTitleEl.textContent = settings.hero_title;
  }

  if (settings.hero_subtitle) {
    const heroLeadEl = document.querySelector(".hero-lead");
    if (heroLeadEl) heroLeadEl.textContent = settings.hero_subtitle;
  }

  if (settings.contact_email) {
    const contactLink = document.getElementById("contactEmailLink");
    if (contactLink) {
      contactLink.textContent = settings.contact_email;
      contactLink.href = `mailto:${settings.contact_email}`;
    }
  }
}

// ---------- Cities ----------
// Every city card image comes straight from that city's own row
// (city.image_url). There is no shared/global fallback image used here —
// if a city has no image_url set, it simply shows no photo.
function cityCardTemplate(city) {
  const safeName = escapeHtml(city.name);
  const image = city.image_url || "";
  const imageTag = image
    ? `<img src="${escapeHtml(image)}" alt="${safeName}" loading="lazy" />`
    : `<div style="position:absolute;inset:0;background:var(--color-navy-light);"></div>`;

  return `
    <button class="city-card" type="button" data-city-id="${city.id}" data-city-name="${safeName}">
      ${imageTag}
      <div class="city-card-label">
        <h3>${safeName}</h3>
        <span>View student reviews</span>
      </div>
    </button>
  `;
}

export async function loadCities() {
  const grid = document.getElementById("cityGrid");
  const filterSelect = document.getElementById("filterCity");
  if (!grid) return;

  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, name, image_url, enabled, display_order")
    .eq("enabled", true)
    .order("display_order", { ascending: true });

  if (error) {
    grid.innerHTML = `<p class="city-grid-empty">Couldn't load cities right now.</p>`;
    console.error(error);
    return;
  }

  if (!cities || cities.length === 0) {
    grid.innerHTML = `<p class="city-grid-empty">No cities have been added yet.</p>`;
    return;
  }

  grid.innerHTML = cities.map(cityCardTemplate).join("");

  if (filterSelect) {
    filterSelect.innerHTML =
      `<option value="">All cities</option>` +
      cities.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  const statCities = document.getElementById("statCities");
  if (statCities) statCities.textContent = String(cities.length);

  // Clicking a city card jumps to the reviews section, pre-filtered to
  // that city, and asks reviews.js to reload with the new filter.
  grid.querySelectorAll(".city-card").forEach((card) => {
    card.addEventListener("click", () => {
      const cityId = card.getAttribute("data-city-id");
      if (filterSelect) {
        filterSelect.value = cityId;
        filterSelect.dispatchEvent(new Event("change"));
      }
      document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

async function loadReviewCountStat() {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  const statReviews = document.getElementById("statReviews");
  if (statReviews && !error && typeof count === "number") {
    statReviews.textContent = String(count);
  }
}

loadSiteSettings();
loadCities();
loadReviewCountStat();
