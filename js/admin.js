// js/admin.js
//
// Admin dashboard: Supabase Auth login, admin-role check, and moderation
// for reviews, form questions and site settings. City management here is
// a basic read-only listing for now — full city CRUD (add/edit/image/
// enable/reorder) is completed in a later commit.

import { supabase } from "./supabase.js";

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

function adminReviewCardTemplate(review, status) {
  const contact = review.review_contacts?.[0];
  const photoCount = review.review_photos?.length || 0;
  const cityName = review.cities?.name ? escapeHtml(review.cities.name) : "";

  const actions = [];
  if (status === "pending") {
    actions.push(`<button class="btn btn-primary btn-sm" data-action="approve" data-id="${review.id}">Approve</button>`);
    actions.push(`<button class="btn btn-danger btn-sm" data-action="delete" data-id="${review.id}">Reject</button>`);
  } else if (status === "approved") {
    actions.push(`<button class="btn btn-danger btn-sm" data-action="delete" data-id="${review.id}">Delete</button>`);
  }

  return `
    <article class="admin-review-card">
      <div class="admin-review-card-top">
        <div>
          <h3>${escapeHtml(review.accommodation_name)}</h3>
          <div class="admin-review-meta">
            <span class="status-pill ${status}">${status}</span>
            &nbsp;${cityName} &middot; Submitted ${formatDate(review.created_at)}
            ${photoCount ? `&middot; ${photoCount} photo${photoCount > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div class="admin-review-actions">${actions.join("")}</div>
      </div>

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

async function loadReviewsByStatus(status) {
  const listEl = document.getElementById(LIST_EL_BY_STATUS[status]);
  if (!listEl) return;

  let data, error;
  try {
    ({ data, error } = await supabase
      .from("reviews")
      .select("*, cities(name), review_contacts(name, email), review_photos(id)")
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
    listEl.innerHTML = data.map((r) => adminReviewCardTemplate(r, status)).join("");
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
   City Management (basic read-only listing — full CRUD added in a later commit)
   ============================================================================= */

async function loadCitiesAdmin() {
  const tbody = document.getElementById("citiesTableBody");
  let data, error;
  try {
    ({ data, error } = await supabase.from("cities").select("*").order("display_order", { ascending: true }));
  } catch (networkErr) {
    error = networkErr;
  }

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4">Couldn't load cities: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No cities yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (city) => `
      <tr>
        <td>${city.image_url ? `<img src="${escapeHtml(city.image_url)}" alt="${escapeHtml(city.name)}" style="width:56px;height:42px;object-fit:cover;border-radius:6px;" />` : "—"}</td>
        <td>${escapeHtml(city.name)}</td>
        <td>${city.enabled ? "Yes" : "No"}</td>
        <td>${city.display_order}</td>
      </tr>
    `
    )
    .join("");
}

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
