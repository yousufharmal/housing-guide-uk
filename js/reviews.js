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

/* =============================================================================
   3-step review submission form
   ============================================================================= */

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const form = document.getElementById("submitReviewForm");

if (form) {
  const steps = Array.from(form.querySelectorAll(".form-step"));
  const stepIndicators = Array.from(document.querySelectorAll("[data-step-indicator]"));
  const formCard = form.closest(".form-card");
  const formMessage = document.getElementById("formMessage");
  const successPanel = document.getElementById("formSuccessPanel");
  const cityField = document.getElementById("field_city");
  const housingTypeField = document.getElementById("field_housing_type");
  const bedroomsField = document.getElementById("field_bedrooms");
  const bedroomsWrapper = document.getElementById("bedroomsField");
  const billsField = document.getElementById("field_bills");
  const billsIncludedCheckbox = document.getElementById("field_bills_included");
  const overallStars = document.getElementById("overallStars");
  const photoDropzone = document.getElementById("photoDropzone");
  const photoInput = document.getElementById("photoInput");
  const photoPreviewGrid = document.getElementById("photoPreviewGrid");
  const photoError = document.getElementById("photoError");
  const submitBtn = document.getElementById("submitReviewBtn");
  const submitAnotherBtn = document.getElementById("submitAnotherBtn");

  let currentStep = 1;
  const ratingValues = {}; // { furnishing: 4, facilities: 3, ... }
  let recommendationValue = null; // true | false | null
  let overallRatingValue = 0;
  let selectedPhotos = []; // { file, previewUrl }

  // ---------- Populate the city dropdown (same source as the city grid) ----------
  async function populateCitySelect() {
    const { data: cities, error } = await supabase
      .from("cities")
      .select("id, name")
      .eq("enabled", true)
      .order("display_order", { ascending: true });

    if (error || !cities) return;

    cityField.innerHTML =
      `<option value="">Select a city…</option>` +
      cities.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  // ---------- Apply admin-configured form fields (enabled/required/label) ----------
  async function applyFormFieldsConfig() {
    const { data: fields, error } = await supabase
      .from("form_fields")
      .select("field_key, label, required, enabled, step")
      .eq("enabled", true);

    if (error || !fields) return;

    const byKey = Object.fromEntries(fields.map((f) => [f.field_key, f]));

    form.querySelectorAll("[data-field]").forEach((wrapper) => {
      const key = wrapper.getAttribute("data-field");
      const config = byKey[key];
      const input = wrapper.querySelector("input, select, textarea");
      const labelText = wrapper.querySelector(".label-text");
      const requiredMark = wrapper.querySelector(".required-mark");

      // A field with no matching row keeps its coded default (still shown).
      // A field explicitly disabled by an admin is hidden and skipped in validation.
      if (config === undefined) return;

      if (labelText && config.label) labelText.textContent = config.label;

      if (input) {
        input.toggleAttribute("required", Boolean(config.required));
      }
      requiredMark?.classList.toggle("hidden", !config.required);
    });

    // Fields that ARE in form_fields but were not returned because they're
    // disabled (enabled = false) should be hidden entirely.
    const enabledKeys = new Set(fields.map((f) => f.field_key));
    const { data: allFields } = await supabase.from("form_fields").select("field_key");
    (allFields || [])
      .filter((f) => !enabledKeys.has(f.field_key))
      .forEach((f) => {
        const wrapper = form.querySelector(`[data-field="${f.field_key}"]`);
        wrapper?.classList.add("hidden");
      });
  }

  // ---------- Step navigation ----------
  function showStep(stepNumber) {
    currentStep = stepNumber;
    steps.forEach((stepEl) => {
      stepEl.classList.toggle("active", Number(stepEl.getAttribute("data-step")) === stepNumber);
    });
    stepIndicators.forEach((indicator) => {
      const n = Number(indicator.getAttribute("data-step-indicator"));
      indicator.classList.toggle("active", n === stepNumber);
      indicator.classList.toggle("complete", n < stepNumber);
    });
    formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (validateStep(currentStep)) {
        showStep(Math.min(currentStep + 1, steps.length));
      }
    });
  });

  form.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Math.max(currentStep - 1, 1)));
  });

  // ---------- Studio logic: hide/disable bedrooms when housing type is Studio ----------
  housingTypeField?.addEventListener("change", () => {
    const isStudio = housingTypeField.value === "studio";
    bedroomsWrapper?.classList.toggle("hidden", isStudio);
    if (isStudio && bedroomsField) {
      bedroomsField.value = "";
      bedroomsField.disabled = true;
    } else if (bedroomsField) {
      bedroomsField.disabled = false;
    }
  });

  // ---------- Bills logic: "all bills included" clears + disables the amount ----------
  billsIncludedCheckbox?.addEventListener("change", () => {
    if (billsIncludedCheckbox.checked) {
      billsField.value = "0";
      billsField.disabled = true;
    } else {
      billsField.disabled = false;
      billsField.value = "";
    }
  });

  // ---------- Rating scale buttons (1-5) ----------
  form.querySelectorAll(".rating-scale[data-rating]").forEach((scale) => {
    const key = scale.getAttribute("data-rating");
    scale.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        ratingValues[key] = Number(btn.getAttribute("data-value"));
        scale.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        scale.closest(".form-field")?.classList.remove("invalid");
      });
    });
  });

  // ---------- Recommendation yes/no ----------
  const recommendationScale = form.querySelector("[data-recommendation]");
  recommendationScale?.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      recommendationValue = btn.getAttribute("data-value") === "true";
      recommendationScale.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  // ---------- Overall star rating ----------
  function paintStars(value) {
    overallStars?.querySelectorAll(".star").forEach((star) => {
      star.classList.toggle("on", Number(star.getAttribute("data-value")) <= value);
    });
  }

  overallStars?.querySelectorAll(".star").forEach((star) => {
    star.addEventListener("click", () => {
      overallRatingValue = Number(star.getAttribute("data-value"));
      paintStars(overallRatingValue);
      star.closest(".form-field")?.classList.remove("invalid");
    });
  });

  // ---------- Photo selection, preview and removal ----------
  photoDropzone?.addEventListener("click", () => photoInput?.click());

  photoDropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    photoDropzone.classList.add("dragover");
  });
  photoDropzone?.addEventListener("dragleave", () => photoDropzone.classList.remove("dragover"));
  photoDropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    photoDropzone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  photoInput?.addEventListener("change", () => {
    handleFiles(photoInput.files);
    photoInput.value = ""; // allow re-selecting the same file after removal
  });

  function handleFiles(fileList) {
    photoError.textContent = "";
    const incoming = Array.from(fileList || []);

    for (const file of incoming) {
      if (selectedPhotos.length >= MAX_PHOTOS) {
        photoError.textContent = `You can upload a maximum of ${MAX_PHOTOS} photos.`;
        break;
      }
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        photoError.textContent = `"${file.name}" isn't a supported file type. Use JPG, PNG or WEBP.`;
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        photoError.textContent = `"${file.name}" is larger than 5MB.`;
        continue;
      }
      selectedPhotos.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    renderPhotoPreviews();
  }

  function renderPhotoPreviews() {
    photoPreviewGrid.innerHTML = selectedPhotos
      .map(
        (p, index) => `
        <div class="photo-preview" data-index="${index}">
          <img src="${p.previewUrl}" alt="Selected photo ${index + 1}" />
          <button type="button" data-remove-photo="${index}" aria-label="Remove photo">&times;</button>
        </div>
      `
      )
      .join("");

    photoPreviewGrid.querySelectorAll("[data-remove-photo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-remove-photo"));
        URL.revokeObjectURL(selectedPhotos[index].previewUrl);
        selectedPhotos.splice(index, 1);
        renderPhotoPreviews();
      });
    });

    photoDropzone.classList.toggle("hidden", selectedPhotos.length >= MAX_PHOTOS);
  }

  // ---------- Validation ----------
  function fieldIsVisible(wrapper) {
    return !wrapper.classList.contains("hidden") && wrapper.offsetParent !== null;
  }

  function markInvalid(wrapper, invalid) {
    wrapper.classList.toggle("invalid", invalid);
  }

  function validateStep(stepNumber) {
    const stepEl = steps.find((s) => Number(s.getAttribute("data-step")) === stepNumber);
    if (!stepEl) return true;
    let valid = true;

    stepEl.querySelectorAll(".form-field[data-field]").forEach((wrapper) => {
      if (wrapper.classList.contains("hidden")) return;
      const key = wrapper.getAttribute("data-field");
      const input = wrapper.querySelector("input:not([type=checkbox]), select, textarea");

      if (key === "bedrooms" && housingTypeField.value === "studio") return; // studio: skip

      if (key === "bills" && billsIncludedCheckbox?.checked) return; // covered by checkbox

      if (["furnishing", "facilities", "sound", "management", "maintenance", "area_location_services", "internet"].includes(key)) {
        const requiredMark = wrapper.querySelector(".required-mark");
        const isRequired = requiredMark && !requiredMark.classList.contains("hidden");
        if (isRequired && ratingValues[key] === undefined) {
          markInvalid(wrapper, true);
          valid = false;
        } else {
          markInvalid(wrapper, false);
        }
        return;
      }

      if (key === "overall_rating") {
        if (!overallRatingValue) {
          markInvalid(wrapper, true);
          valid = false;
        } else {
          markInvalid(wrapper, false);
        }
        return;
      }

      if (!input) return;

      const isRequired = input.hasAttribute("required");
      const isEmpty = !input.value || !input.value.trim();

      if (isRequired && isEmpty) {
        markInvalid(wrapper, true);
        valid = false;
      } else {
        markInvalid(wrapper, false);
      }
    });

    // Step 3 also has the fixed name/email fields (not admin-configurable).
    if (stepNumber === 3) {
      const nameInput = document.getElementById("field_name");
      const emailInput = document.getElementById("field_email");
      [nameInput, emailInput].forEach((input) => {
        const wrapper = input.closest(".form-field");
        const isValid =
          input.type === "email"
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())
            : input.value.trim().length > 0;
        markInvalid(wrapper, !isValid);
        if (!isValid) valid = false;
      });
    }

    return valid;
  }

  // ---------- Form message helper ----------
  function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message show ${type}`;
  }

  function clearMessage() {
    formMessage.className = "form-message";
    formMessage.textContent = "";
  }

  // ---------- Submit ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      showMessage("Please fill in the required fields before submitting.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const email = document.getElementById("field_email").value.trim().toLowerCase();

      const { data: allowed, error: rateLimitError } = await supabase.rpc(
        "check_submission_rate_limit",
        { p_identifier: email }
      );

      if (rateLimitError) throw rateLimitError;
      if (allowed === false) {
        showMessage(
          "You've submitted several reviews recently. Please try again in a little while.",
          "error"
        );
        return;
      }

      const isStudio = housingTypeField.value === "studio";
      const billsIncluded = Boolean(billsIncludedCheckbox?.checked);

      const reviewPayload = {
        city_id: cityField.value,
        accommodation_name: document.getElementById("field_accommodation_name").value.trim(),
        location: document.getElementById("field_location").value.trim() || null,
        housing_type: housingTypeField.value,
        bedrooms: isStudio ? null : bedroomsField.value ? Number(bedroomsField.value) : null,
        rent: Number(document.getElementById("field_rent").value),
        rent_period: document.getElementById("field_rent_period").value,
        bills: billsIncluded ? 0 : Number(billsField.value || 0),
        furnishing: ratingValues.furnishing ?? null,
        facilities: ratingValues.facilities ?? null,
        sound: ratingValues.sound ?? null,
        management: ratingValues.management ?? null,
        maintenance: ratingValues.maintenance ?? null,
        area_location_services: ratingValues.area_location_services ?? null,
        internet: ratingValues.internet ?? null,
        recommendation: recommendationValue,
        overall_rating: overallRatingValue,
        pros: document.getElementById("field_pros").value.trim() || null,
        cons: document.getElementById("field_cons").value.trim() || null,
        advice: document.getElementById("field_advice").value.trim() || null,
        student_type: document.getElementById("field_student_type").value || null,
      };

      const { data: insertedReview, error: reviewError } = await supabase
        .from("reviews")
        .insert(reviewPayload)
        .select("id")
        .single();

      if (reviewError) throw reviewError;

      const { error: contactError } = await supabase.from("review_contacts").insert({
        review_id: insertedReview.id,
        name: document.getElementById("field_name").value.trim(),
        email,
      });

      if (contactError) throw contactError;

      if (selectedPhotos.length > 0 && typeof window.uploadReviewPhotos === "function") {
        await window.uploadReviewPhotos(insertedReview.id, selectedPhotos);
      }

      form.classList.add("hidden");
      document.querySelector(".form-steps")?.classList.add("hidden");
      successPanel.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showMessage("Something went wrong submitting your review. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit review";
    }
  });

  submitAnotherBtn?.addEventListener("click", () => {
    form.reset();
    Object.keys(ratingValues).forEach((k) => delete ratingValues[k]);
    recommendationValue = null;
    overallRatingValue = 0;
    paintStars(0);
    form.querySelectorAll(".rating-scale button.selected").forEach((b) => b.classList.remove("selected"));
    selectedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    selectedPhotos = [];
    renderPhotoPreviews();
    form.querySelectorAll(".form-field.invalid").forEach((w) => w.classList.remove("invalid"));
    form.classList.remove("hidden");
    document.querySelector(".form-steps")?.classList.remove("hidden");
    successPanel.classList.add("hidden");
    showStep(1);
  });

  populateCitySelect();
  applyFormFieldsConfig();
}
