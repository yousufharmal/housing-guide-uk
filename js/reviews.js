// js/reviews.js
//
// Public review browsing. The 3-step review submission form is added to
// this file in a later commit.

import { supabase } from "./supabase.js";

const PAGE_SIZE = 6;

const reviewGrid = document.getElementById("reviewGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const filterCity = document.getElementById("filterCity");
const filterSort = document.getElementById("filterSort");

let offset = 0;
let reachedEnd = false;

const HOUSING_TYPE_LABELS = {
  studio: "Studio",
  shared_house: "Shared house",
  shared_flat: "Shared flat",
  halls: "Halls of residence",
  private_flat: "Private flat",
  other: "Other",
};

const RENT_PERIOD_LABELS = {
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return "—";
  return `£${Number(amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function reviewCardTemplate(review) {
  const cityName = review.cities?.name ? escapeHtml(review.cities.name) : "";
  const billsText =
    Number(review.bills) === 0 ? "All bills included" : `${formatMoney(review.bills)} / month bills`;

  return `
    <article class="review-card">
      <div class="review-card-header">
        <div class="review-card-title-row">
          <div>
            <h3>${escapeHtml(review.accommodation_name)}</h3>
            <div class="review-card-meta">
              ${cityName}${review.location ? " · " + escapeHtml(review.location) : ""}
            </div>
          </div>
          <div class="rating-badge"><span class="star">&#9733;</span> ${review.overall_rating}/5</div>
        </div>
        <div class="review-tags">
          <span class="tag tag-blue">${HOUSING_TYPE_LABELS[review.housing_type] || review.housing_type}</span>
          ${review.bedrooms ? `<span class="tag">${review.bedrooms} bed</span>` : ""}
          <span class="tag tag-green">${formatMoney(review.rent)} / ${RENT_PERIOD_LABELS[review.rent_period] || review.rent_period}</span>
          <span class="tag tag-gold">${billsText}</span>
          ${review.student_type ? `<span class="tag">${escapeHtml(review.student_type)}</span>` : ""}
        </div>
      </div>

      <div class="review-card-body">
        <div class="review-detail-grid">
          <div><strong>Furnishing</strong> ${review.furnishing ?? "—"}/5</div>
          <div><strong>Facilities</strong> ${review.facilities ?? "—"}/5</div>
          <div><strong>Sound insulation</strong> ${review.sound ?? "—"}/5</div>
          <div><strong>Management</strong> ${review.management ?? "—"}/5</div>
          <div><strong>Maintenance</strong> ${review.maintenance ?? "—"}/5</div>
          <div><strong>Area &amp; services</strong> ${review.area_location_services ?? "—"}/5</div>
          <div><strong>Internet</strong> ${review.internet ?? "—"}/5</div>
          <div><strong>Would recommend</strong> ${review.recommendation === null ? "—" : review.recommendation ? "Yes" : "No"}</div>
        </div>

        ${review.pros ? `<div class="review-text-block"><h4>Pros</h4><p>${escapeHtml(review.pros)}</p></div>` : ""}
        ${review.cons ? `<div class="review-text-block"><h4>Cons</h4><p>${escapeHtml(review.cons)}</p></div>` : ""}
        ${review.advice ? `<div class="review-text-block"><h4>Advice for future students</h4><p>${escapeHtml(review.advice)}</p></div>` : ""}
      </div>
    </article>
  `;
}

function buildQuery() {
  let query = supabase
    .from("reviews")
    .select("*, cities(name)")
    .eq("status", "approved");

  if (filterCity && filterCity.value) {
    query = query.eq("city_id", filterCity.value);
  }

  const sort = filterSort ? filterSort.value : "newest";
  if (sort === "rating_high") {
    query = query.order("overall_rating", { ascending: false });
  } else if (sort === "rating_low") {
    query = query.order("overall_rating", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  return query.range(offset, offset + PAGE_SIZE - 1);
}

async function loadReviews({ reset = false } = {}) {
  if (!reviewGrid) return;

  if (reset) {
    offset = 0;
    reachedEnd = false;
    reviewGrid.innerHTML = `<div class="skeleton" style="height:280px;"></div><div class="skeleton" style="height:280px;"></div>`;
  }

  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading…";
  }

  const { data, error } = await buildQuery();

  if (error) {
    console.error(error);
    reviewGrid.innerHTML = `<p class="reviews-empty">Couldn't load reviews right now.</p>`;
    if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
    return;
  }

  const reviews = data || [];

  if (reset) {
    reviewGrid.innerHTML = "";
  }

  if (reset && reviews.length === 0) {
    reviewGrid.innerHTML = `<p class="reviews-empty">No approved reviews yet for this filter — check back soon.</p>`;
  } else {
    reviewGrid.insertAdjacentHTML("beforeend", reviews.map(reviewCardTemplate).join(""));
  }

  offset += reviews.length;
  reachedEnd = reviews.length < PAGE_SIZE;

  if (loadMoreBtn) {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Load more reviews";
    loadMoreBtn.classList.toggle("hidden", reachedEnd);
  }
}

filterCity?.addEventListener("change", () => loadReviews({ reset: true }));
filterSort?.addEventListener("change", () => loadReviews({ reset: true }));
loadMoreBtn?.addEventListener("click", () => loadReviews());

loadReviews({ reset: true });
