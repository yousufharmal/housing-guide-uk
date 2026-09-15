// js/admin.js
//
// Admin dashboard: Supabase Auth login, admin-role check, and moderation
// for reviews, form questions, cities and site settings.

import { supabase, CITY_IMAGES_BUCKET, REVIEW_PHOTOS_BUCKET } from "./supabase.js";

const loginWrap = document.getElementById("loginWrap");
const adminShell = document.getElementById("adminShell");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmailLabel = document.getElementById("adminEmailLabel");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add("show");
}

function clearLoginError() {
  loginError.textContent = "";
  loginError.classList.remove("show");
}

// ---------- Auth ----------
async function verifyAdminAndEnter(email) {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");

  if (error || !isAdmin) {
    await supabase.auth.signOut();
    showLoginError("This account does not have admin access.");
    return false;
  }

  loginWrap.style.display = "none";
  adminShell.classList.add("visible");
  adminEmailLabel.textContent = email || "";
  loadActiveTabData();
  return true;
}

async function checkExistingSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    await verifyAdminAndEnter(session.user.email);
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginError();
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showLoginError("Incorrect email or password.");
    } else {
      await verifyAdminAndEnter(data.user?.email);
    }
  } catch (networkErr) {
    showLoginError("Couldn't reach Supabase. Check your connection and config.js.");
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Log in";
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  adminShell.classList.remove("visible");
  loginWrap.style.display = "flex";
  loginForm.reset();
});

// ---------- Tabs ----------
const tabs = document.querySelectorAll(".admin-tab");
const panels = document.querySelectorAll(".admin-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-tab");
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-panel") === target));
    loadTabData(target);
  });
});

function loadActiveTabData() {
  const activeTab = document.querySelector(".admin-tab.active");
  loadTabData(activeTab ? activeTab.getAttribute("data-tab") : "pending");
}

function loadTabData(tabName) {
  if (tabName === "pending") loadReviewsByStatus("pending");
  if (tabName === "approved") loadReviewsByStatus("approved");
  if (tabName === "deleted") loadReviewsByStatus("deleted");
  if (tabName === "form") loadFormFields();
  if (tabName === "cities") loadCitiesAdmin();
  if (tabName === "settings") loadSiteSettingsForm();
}

/* =============================================================================
   Review moderation (New Submissions / Approved / Deleted)
   ============================================================================= */

const LIST_EL_BY_STATUS = {
  pending: "pendingList",
  approved: "approvedList",
  deleted: "deletedList",
};

function adminReviewCardTemplate(review, status, photoUrlByPath) {
  const contact = review.review_contacts?.[0];
  const photos = (review.review_photos || [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => photoUrlByPath[p.photo_path])
    .filter(Boolean);
  const cityName = review.cities?.name ? escapeHtml(review.cities.name) : "";

  const actions = [];
  if (status === "pending") {
    actions.push(`<button class="btn btn-primary btn-sm" data-action="approve" data-id="${review.id}">Approve</button>`);
    actions.push(`<button class="btn btn-danger btn-sm" data-action="delete" data-id="${review.id}">Reject</button>`);
  } else if (status === "approved") {
    actions.push(`<button class="btn btn-danger btn-sm" data-action="delete" data-id="${review.id}">Delete</button>`);
  }

  const photosHtml = photos.length
    ? `<div class="review-photos">
        ${photos.map((url) => `<img src="${escapeHtml(url)}" alt="Submitted photo" data-lightbox-photo />`).join("")}
      </div>`
    : "";

  return `
    <article class="admin-review-card">
      <div class="admin-review-card-top">
        <div>
          <h3>${escapeHtml(review.accommodation_name)}</h3>
          <div class="admin-review-meta">
            <span class="status-pill ${status}">${status}</span>
            &nbsp;${cityName} &middot; Submitted ${formatDate(review.created_at)}
            ${photos.length ? `&middot; ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div class="admin-review-actions">${actions.join("")}</div>
      </div>

      ${photosHtml}

      <div class="admin-review-details">
        <div class="review-detail-grid">
          <div><strong>Housing type</strong> ${escapeHtml(review.housing_type)}</div>
          <div><strong>Bedrooms</strong> ${review.bedrooms ?? "—"}</div>
          <div><strong>Rent</strong> £${review.rent} / ${review.rent_period}</div>
          <div><strong>Bills</strong> ${Number(review.bills) === 0 ? "Included" : "£" + review.bills}</div>
          <div><strong>Overall rating</strong> ${review.overall_rating}/5</div>
          <div><strong>Recommend</strong> ${review.recommendation === null ? "—" : review.recommendation ? "Yes" : "No"}</div>
        </div>
        ${review.pros ? `<div class="review-text-block"><h4>Pros</h4><p>${escapeHtml(review.pros)}</p></div>` : ""}
        ${review.cons ? `<div class="review-text-block"><h4>Cons</h4><p>${escapeHtml(review.cons)}</p></div>` : ""}
        ${review.advice ? `<div class="review-text-block"><h4>Advice</h4><p>${escapeHtml(review.advice)}</p></div>` : ""}
        ${
          contact
            ? `<div class="review-text-block"><h4>Contact (private)</h4><p>${escapeHtml(contact.name)} — ${escapeHtml(contact.email)}</p></div>`
            : ""
        }
      </div>
    </article>
  `;
}

// Admins can view photos for reviews of any status (pending, approved,
// deleted) since is_admin() bypasses the storage RLS check — signing the
// URL is what actually proves that access, via the admin's session.
async function getSignedPhotoUrlsAdmin(reviews) {
  const paths = reviews.flatMap((r) => (r.review_photos || []).map((p) => p.photo_path));
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage.from(REVIEW_PHOTOS_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) {
    console.error("Could not sign review photo URLs:", error?.message);
    return {};
  }

  const map = {};
  data.forEach((entry) => {
    if (entry.signedUrl) map[entry.path] = entry.signedUrl;
  });
  return map;
}

const adminLightbox = document.getElementById("lightbox");
const adminLightboxImg = document.getElementById("lightboxImg");
document.getElementById("lightboxClose")?.addEventListener("click", () => {
  adminLightbox?.classList.remove("open");
});
adminLightbox?.addEventListener("click", (event) => {
  if (event.target === adminLightbox) adminLightbox.classList.remove("open");
});

function wireAdminLightboxClicks(listEl) {
  listEl.querySelectorAll("[data-lightbox-photo]").forEach((img) => {
    img.addEventListener("click", () => {
      if (!adminLightbox || !adminLightboxImg) return;
      adminLightboxImg.src = img.src;
      adminLightbox.classList.add("open");
    });
  });
}

async function loadReviewsByStatus(status) {
  const listEl = document.getElementById(LIST_EL_BY_STATUS[status]);
  if (!listEl) return;

  let data, error;
  try {
    ({ data, error } = await supabase
      .from("reviews")
      .select("*, cities(name), review_contacts(name, email), review_photos(id, photo_path, display_order)")
      .eq("status", status)
      .order("created_at", { ascending: false }));
  } catch (networkErr) {
    error = networkErr;
  }

  if (error) {
    listEl.innerHTML = `<p class="admin-empty-state">Couldn't load reviews: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="admin-empty-state">Nothing here yet.</p>`;
  } else {
    const photoUrlByPath = await getSignedPhotoUrlsAdmin(data);
    listEl.innerHTML = data.map((r) => adminReviewCardTemplate(r, status, photoUrlByPath)).join("");
    wireAdminLightboxClicks(listEl);
  }

  if (status === "pending") {
    document.getElementById("pendingCount").textContent = String(data?.length || 0);
  }

  listEl.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleReviewAction(btn, status));
  });
}

async function handleReviewAction(btn, currentStatus) {
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  const newStatus = action === "approve" ? "approved" : "deleted";

  btn.disabled = true;
  const { error } = await supabase.rpc("set_review_status", { p_review_id: id, p_status: newStatus });

  if (error) {
    alert(`Couldn't update this review: ${error.message}`);
    btn.disabled = false;
    return;
  }

  loadReviewsByStatus(currentStatus);
  if (currentStatus !== "pending") loadReviewsByStatus("pending");
}

/* =============================================================================
   Form Management
   ============================================================================= */

const STEP_LABELS = { 1: "1 — Accommodation", 2: "2 — Your Experience", 3: "3 — Review & Contact" };

async function loadFormFields() {
  const tbody = document.getElementById("formFieldsTableBody");
  let data, error;
  try {
    ({ data, error } = await supabase
      .from("form_fields")
      .select("*")
      .order("step", { ascending: true })
      .order("display_order", { ascending: true }));
  } catch (networkErr) {
    error = networkErr;
  }

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">Couldn't load form fields: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No custom questions yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (f) => `
      <tr data-id="${f.id}">
        <td><code>${escapeHtml(f.field_key)}</code></td>
        <td>${escapeHtml(f.label)}</td>
        <td>${STEP_LABELS[f.step] || f.step}</td>
        <td><input type="checkbox" data-field="required" ${f.required ? "checked" : ""} /></td>
        <td><input type="checkbox" data-field="enabled" ${f.enabled ? "checked" : ""} /></td>
        <td>${f.display_order}</td>
        <td class="row-actions"><button class="btn btn-sm btn-outline" data-delete-field>Delete</button></td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const row = checkbox.closest("tr");
      const id = row.getAttribute("data-id");
      const field = checkbox.getAttribute("data-field");
      const { error: updateError } = await supabase
        .from("form_fields")
        .update({ [field]: checkbox.checked })
        .eq("id", id);
      if (updateError) alert(`Couldn't update: ${updateError.message}`);
    });
  });

  tbody.querySelectorAll("[data-delete-field]").forEach((deleteBtn) => {
    deleteBtn.addEventListener("click", async () => {
      const row = deleteBtn.closest("tr");
      const id = row.getAttribute("data-id");
      const { error: deleteError } = await supabase.from("form_fields").delete().eq("id", id);
      if (deleteError) {
        alert(`Couldn't delete: ${deleteError.message}`);
        return;
      }
      loadFormFields();
    });
  });
}

document.getElementById("formFieldForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    field_key: document.getElementById("ff_field_key").value.trim(),
    label: document.getElementById("ff_label").value.trim(),
    step: Number(document.getElementById("ff_step").value),
    display_order: Number(document.getElementById("ff_order").value) || 0,
    required: document.getElementById("ff_required").checked,
    enabled: document.getElementById("ff_enabled").checked,
  };

  const { error } = await supabase.from("form_fields").insert(payload);

  if (error) {
    alert(`Couldn't add question: ${error.message}`);
    return;
  }

  event.target.reset();
  document.getElementById("ff_enabled").checked = true;
  loadFormFields();
});

/* =============================================================================
   City Management
   Every city row keeps its own image_url — there is no shared/global
   fallback image anywhere in this code path.
   ============================================================================= */

function cityRowTemplate(city) {
  const thumb = city.image_url
    ? `<img src="${escapeHtml(city.image_url)}" alt="${escapeHtml(city.name)}" style="width:56px;height:42px;object-fit:cover;border-radius:6px;" />`
    : `<div style="width:56px;height:42px;border-radius:6px;background:var(--color-bg-alt);"></div>`;

  return `
    <tr data-id="${city.id}">
      <td>
        ${thumb}
        <div style="margin-top:6px;">
          <button type="button" class="btn btn-sm btn-outline" data-upload-image>Upload image</button>
          <input type="file" accept="image/jpeg,image/png,image/webp" data-image-input hidden />
        </div>
      </td>
      <td><input type="text" data-field="name" value="${escapeHtml(city.name)}" style="min-width:140px;" /></td>
      <td><input type="checkbox" data-field="enabled" ${city.enabled ? "checked" : ""} /></td>
      <td><input type="number" data-field="display_order" value="${city.display_order}" style="width:70px;" /></td>
      <td class="row-actions">
        <button type="button" class="btn btn-sm btn-primary" data-save-city>Save</button>
        <button type="button" class="btn btn-sm btn-danger" data-delete-city>Delete</button>
      </td>
    </tr>
  `;
}

async function loadCitiesAdmin() {
  const tbody = document.getElementById("citiesTableBody");
  let data, error;
  try {
    ({ data, error } = await supabase.from("cities").select("*").order("display_order", { ascending: true }));
  } catch (networkErr) {
    error = networkErr;
  }

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Couldn't load cities: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No cities yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(cityRowTemplate).join("");
  wireCityRowHandlers();
}

function wireCityRowHandlers() {
  const tbody = document.getElementById("citiesTableBody");

  tbody.querySelectorAll("[data-upload-image]").forEach((btn) => {
    const row = btn.closest("tr");
    const fileInput = row.querySelector("[data-image-input]");
    btn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => uploadCityImage(row, fileInput.files[0]));
  });

  tbody.querySelectorAll("[data-save-city]").forEach((btn) => {
    btn.addEventListener("click", () => saveCityRow(btn.closest("tr")));
  });

  tbody.querySelectorAll("[data-delete-city]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCityRow(btn.closest("tr")));
  });
}

async function uploadCityImage(row, file) {
  if (!file) return;
  const id = row.getAttribute("data-id");
  const uploadBtn = row.querySelector("[data-upload-image]");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading…";

  try {
    const extension = file.name.split(".").pop();
    const path = `${id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(CITY_IMAGES_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(CITY_IMAGES_BUCKET).getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("cities")
      .update({ image_url: publicUrlData.publicUrl })
      .eq("id", id);

    if (updateError) throw updateError;

    loadCitiesAdmin();
  } catch (err) {
    alert(`Couldn't upload image: ${err.message}`);
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload image";
  }
}

async function saveCityRow(row) {
  const id = row.getAttribute("data-id");
  const saveBtn = row.querySelector("[data-save-city]");
  saveBtn.disabled = true;

  const payload = {
    name: row.querySelector('[data-field="name"]').value.trim(),
    enabled: row.querySelector('[data-field="enabled"]').checked,
    display_order: Number(row.querySelector('[data-field="display_order"]').value) || 0,
  };

  const { error } = await supabase.from("cities").update(payload).eq("id", id);

  saveBtn.disabled = false;
  if (error) {
    alert(`Couldn't save city: ${error.message}`);
  } else {
    loadCitiesAdmin();
  }
}

async function deleteCityRow(row) {
  const id = row.getAttribute("data-id");
  const name = row.querySelector('[data-field="name"]').value;

  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;

  const { error } = await supabase.from("cities").delete().eq("id", id);

  if (error) {
    // Most likely blocked by the foreign key on reviews.city_id (ON DELETE RESTRICT) —
    // i.e. this city still has reviews attached, so deleting isn't safe.
    alert(
      `Couldn't delete "${name}". It most likely still has reviews attached — disable it instead of deleting it.`
    );
    return;
  }

  loadCitiesAdmin();
}

document.getElementById("cityAddForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("city_new_name").value.trim(),
    enabled: document.getElementById("city_new_enabled").checked,
    display_order: Number(document.getElementById("city_new_order").value) || 0,
  };

  const { error } = await supabase.from("cities").insert(payload);

  if (error) {
    alert(`Couldn't add city: ${error.message}`);
    return;
  }

  event.target.reset();
  document.getElementById("city_new_enabled").checked = true;
  loadCitiesAdmin();
});

/* =============================================================================
   Website Management
   ============================================================================= */

async function loadSiteSettingsForm() {
  let data, error;
  try {
    ({ data, error } = await supabase.from("site_settings").select("key, value"));
  } catch (networkErr) {
    error = networkErr;
  }
  if (error || !data) return;

  const settings = Object.fromEntries(data.map((row) => [row.key, row.value]));
  document.getElementById("setting_hero_title").value = settings.hero_title || "";
  document.getElementById("setting_hero_subtitle").value = settings.hero_subtitle || "";
  document.getElementById("setting_contact_email").value = settings.contact_email || "";
}

document.getElementById("siteSettingsForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const messageEl = document.getElementById("settingsMessage");

  const updates = [
    { key: "hero_title", value: document.getElementById("setting_hero_title").value.trim() },
    { key: "hero_subtitle", value: document.getElementById("setting_hero_subtitle").value.trim() },
    { key: "contact_email", value: document.getElementById("setting_contact_email").value.trim() },
  ];

  const { error } = await supabase.from("site_settings").upsert(updates, { onConflict: "key" });

  messageEl.className = "form-message show " + (error ? "error" : "success");
  messageEl.textContent = error ? `Couldn't save: ${error.message}` : "Settings saved.";
});

checkExistingSession();
