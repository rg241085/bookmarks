// ===================== Firebase (v10) =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, push, update, remove, set,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAaNxUWGa_x57I5IX8IVn8-uFBgDcVb6UM",
  authDomain: "bookmarks-8e531.firebaseapp.com",
  databaseURL: "https://bookmarks-8e531-default-rtdb.firebaseio.com",
  projectId: "bookmarks-8e531",
  storageBucket: "bookmarks-8e531.firebasestorage.app",
  messagingSenderId: "804620888663",
  appId: "1:804620888663:web:04ce2c01528cfe901d5112",
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getDatabase(fbApp);

// ===================== Helpers =====================
const $ = (id) => document.getElementById(id);
const esc = (v) =>
  (v ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const firstChar = (s) => (Array.from((s || "").trim())[0] || "?").toUpperCase();

const GENERIC_HOSTS = [
  "netlify.app", "github.io", "vercel.app", "herokuapp.com", "web.app",
  "firebaseapp.com", "pages.dev", "onrender.com", "glitch.me", "blogspot.com",
];
const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5", "#dc2626", "#ca8a04", "#0d9488"];

const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

// URL ko saaf karke sahi format mein lata hai. Galat ho to null.
function normalizeUrl(raw) {
  let s = (raw || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!["http:", "https:"].includes(u.protocol)) return null; // javascript: jaise link band
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
  return u.href;
}
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isGeneric = (host) => GENERIC_HOSTS.some((h) => host === h || host.endsWith("." + h));
const sameUrl = (a, b) => {
  const k = (u) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();
  return k(a) === k(b);
};

// URL se naam ka andaaza: "onlinesbi.sbi" -> "Onlinesbi", "x.github.io/shipping-label-app" -> "Shipping label app"
function guessName(url) {
  const host = hostOf(url);
  if (!host) return "";
  let core;
  if (isGeneric(host)) {
    const seg = (() => { try { return new URL(url).pathname.split("/").filter(Boolean)[0]; } catch { return ""; } })();
    core = seg ? decodeURIComponent(seg).replace(/[-_]+/g, " ") : host.split(".")[0];
  } else {
    const parts = host.split(".");
    const sld = ["co", "com", "org", "gov", "net", "ac", "edu", "nic"];
    core = parts.length > 2 && sld.includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
  }
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : "";
}

function colorFor(text) {
  let h = 0;
  for (const ch of text || "") h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function faviconUrl(url) {
  const host = hostOf(url);
  if (!host || isGeneric(host)) return null; // github.io jaise sites par rangeen letter icon
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=128`;
}

function iconHtml(name, url, extra = "") {
  const fav = faviconUrl(url);
  return `<div class="tile-icon ${extra}" style="--c:${colorFor(name || url)}">
    <span>${esc(firstChar(name || hostOf(url)))}</span>
    ${fav ? `<img src="${esc(fav)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}
  </div>`;
}

// Favicon load na ho, ya bahut chhota/dhundhla ho, to letter wala icon dikhe
document.addEventListener("error", (e) => {
  if (e.target?.matches?.(".tile-icon img")) e.target.remove();
}, true);
document.addEventListener("load", (e) => {
  const img = e.target;
  if (!img?.matches?.(".tile-icon img")) return;
  if (img.naturalWidth < 16) img.remove();
  else img.parentElement.classList.add("has-img");
}, true);

// "sbi" -> "Sbi" (sirf dikhane ke liye)
const displayName = (s) => { const a = Array.from(s || ""); return a.length ? a[0].toUpperCase() + a.slice(1).join("") : ""; };

function toast(msg, { type = "info", action, onAction, duration } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : ""}`;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
  $("toasts").appendChild(el);
  const close = () => { el.classList.add("hide"); setTimeout(() => el.remove(), 250); };
  if (action) el.querySelector("button").onclick = () => { close(); onAction?.(); };
  setTimeout(close, duration ?? (action ? 5000 : type === "error" ? 4500 : 2200));
}

function fbError(e, prefix = "Error") {
  console.error(prefix, e);
  const msg = e?.code === "PERMISSION_DENIED" || /permission/i.test(e?.message || "")
    ? "Permission nahi hai (Database rules check karein)"
    : e?.message || String(e);
  toast(`${prefix}: ${msg}`, { type: "error" });
}

// ===================== State =====================
const state = {
  user: null,
  items: [],        // [{key, name, url, order, createdAt}]
  pending: null,    // arrange mode ke dauran aaya naya data
  loaded: false,
  arranging: false,
  editKey: null,
  nameTouched: false,
  unsub: null,
  sortable: null,
  installPrompt: null,
};
const listPath = () => `users/${state.user.uid}/bookmarks`;
const itemRef = (key) => ref(db, `${listPath()}/${key}`);
const cacheKey = (uid) => `bm_cache_${uid}`;
const findItem = (key) => state.items.find((i) => i.key === key);

function toItems(val) {
  return Object.entries(val || {})
    .map(([key, v]) => ({
      key,
      name: (v?.name || "").toString(),
      url: (v?.url || "").toString(),
      order: typeof v?.order === "number" ? v.order : Infinity, // 0 bhi sahi chalega (purana bug)
      createdAt: typeof v?.createdAt === "number" ? v.createdAt : 0,
    }))
    .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt) || a.key.localeCompare(b.key));
}

// ===================== Render =====================
function visibleItems() {
  const q = $("search").value.trim().toLowerCase();
  if (!q) return state.items;
  return state.items.filter((i) => i.name.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
}

function tileHtml(item) {
  return `<div class="tile" data-id="${esc(item.key)}">
    <a class="tile-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" title="${esc(item.name)}">
      ${iconHtml(item.name, item.url)}
      <div class="tile-text">
        <div class="tile-name">${esc(displayName(item.name))}</div>
        <div class="tile-domain">${esc(hostOf(item.url))}</div>
      </div>
    </a>
    <div class="tile-actions">
      <button type="button" class="mini-btn" data-act="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
      <button type="button" class="mini-btn danger" data-act="delete" title="Delete" aria-label="Delete">${ICONS.trash}</button>
    </div>
    <button type="button" class="tile-remove" data-act="delete" aria-label="Delete">${ICONS.x}</button>
  </div>`;
}

const skeletonHtml = () =>
  Array.from({ length: 8 }, () =>
    `<div class="tile skeleton"><div class="tile-link"><div class="tile-icon"></div><div class="tile-text"><div class="sk-line"></div><div class="sk-line short"></div></div></div></div>`
  ).join("");

function render() {
  const grid = $("grid");
  const q = $("search").value.trim();

  if (!state.loaded) {
    grid.innerHTML = skeletonHtml();
    $("empty").hidden = true;
    $("countText").textContent = "Load ho raha hai...";
    return;
  }

  const list = visibleItems();
  grid.innerHTML = list.map(tileHtml).join("");

  const n = state.items.length;
  $("countText").textContent = n ? `${n} website${n > 1 ? "s" : ""} saved` : "Shuru karte hain";
  $("arrangeBtn").disabled = !!q || n < 2;

  const empty = $("empty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    const searching = n > 0;
    $("emptyArt").textContent = searching ? "🔍" : "🔖";
    $("emptyTitle").textContent = searching ? `"${q}" se kuch nahi mila` : "Abhi koi website nahi hai";
    $("emptyText").textContent = searching ? "Doosra naam try karein" : "Apni pehli pasandida website jodein";
    $("emptyAddBtn").hidden = searching;
  }
}

function setItems(items) {
  if (state.arranging) {
    state.pending = items; // arrange khatam hone par dikhayenge
    return;
  }
  state.items = items;
  state.loaded = true;
  render();
}

// ===================== Arrange mode =====================
function startArrange() {
  if ($("search").value.trim() || state.items.length < 2 || !window.Sortable) return;
  state.arranging = true;
  $("grid").classList.add("arranging");
  $("arrangeBar").hidden = false;
  $("fab").hidden = true;
  state.sortable = window.Sortable.create($("grid"), {
    animation: 180,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    filter: ".tile-remove",
    preventOnFilter: false,
    delay: 120,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
  });
}

function endArrange(save) {
  if (!state.arranging) return;
  if (save) {
    const ids = [...$("grid").querySelectorAll(".tile")].map((t) => t.dataset.id);
    const updates = {};
    ids.forEach((id, i) => {
      const it = findItem(id);
      if (it && it.order !== i) updates[`${id}/order`] = i;
    });
    if (Object.keys(updates).length) {
      // turant naya order dikhao, Firebase baad mein confirm karega
      state.items = ids.map((id, i) => ({ ...findItem(id), order: i })).filter((x) => x.key);
      state.pending = null;
      update(ref(db, listPath()), updates)
        .then(() => toast("Naya order save ho gaya ✓"))
        .catch((e) => fbError(e, "Order save nahi hua"));
    }
  }
  state.sortable?.destroy();
  state.sortable = null;
  state.arranging = false;
  $("grid").classList.remove("arranging");
  $("arrangeBar").hidden = true;
  $("fab").hidden = false;
  if (state.pending) {
    state.items = state.pending;
    state.pending = null;
  }
  render();
}

// ===================== Add / Edit sheet =====================
function openSheet(key = null) {
  const it = key ? findItem(key) : null;
  state.editKey = it ? key : null;
  state.nameTouched = !!it;
  $("formTitle").textContent = it ? "Website edit karein" : "Nayi website jodein";
  $("urlInput").value = it?.url || "";
  $("nameInput").value = it?.name || "";
  $("deleteBtn").hidden = !it;
  $("saveBtn").textContent = it ? "Update" : "Save";
  showFormError("");
  updateFormPreview();
  closeMenu();
  $("sheet").hidden = false;
  setTimeout(() => (it ? $("nameInput") : $("urlInput")).focus(), 60);
}

function closeSheet() {
  $("sheet").hidden = true;
  state.editKey = null;
}

function showFormError(msg, field) {
  $("formError").textContent = msg;
  $("formError").hidden = !msg;
  $("urlInput").classList.toggle("invalid", field === "url");
  $("nameInput").classList.toggle("invalid", field === "name");
}

function updateFormPreview() {
  const url = normalizeUrl($("urlInput").value);
  if (url && !state.nameTouched) $("nameInput").value = guessName(url);
  const name = $("nameInput").value.trim() || (url ? guessName(url) : "");
  $("formIcon").innerHTML = iconHtml(name || "?", url || "", "lg");
  $("previewName").textContent = name || "Website ka naam";
  $("previewDomain").textContent = url ? hostOf(url) : "website.com";
}

function submitForm(e) {
  e.preventDefault();
  const url = normalizeUrl($("urlInput").value);
  if (!url) {
    showFormError("Sahi website address daalein (jaise google.com)", "url");
    $("urlInput").focus();
    return;
  }
  const name = $("nameInput").value.trim() || guessName(url);
  if (!name) {
    showFormError("Naam likhein", "name");
    $("nameInput").focus();
    return;
  }
  const dup = state.items.find((i) => i.key !== state.editKey && sameUrl(i.url, url));
  if (dup) {
    showFormError(`Ye website pehle se "${dup.name}" naam se saved hai`, "url");
    return;
  }

  const key = state.editKey;
  closeSheet();
  // Realtime DB turant screen par dikhata hai; server confirm hone par message
  if (key) {
    update(itemRef(key), { name, url })
      .then(() => toast("Update ho gaya ✓"))
      .catch((err) => fbError(err, "Update nahi hua"));
  } else {
    const orders = state.items.map((i) => i.order).filter(Number.isFinite);
    const order = orders.length ? Math.max(...orders) + 1 : state.items.length;
    push(ref(db, listPath()), { name, url, order, createdAt: Date.now() })
      .then(() => toast(`"${name}" jud gaya ✓`))
      .catch((err) => fbError(err, "Save nahi hua"));
  }
}

// Delete + Undo (confirm box ki zaroorat nahi)
function deleteItem(key) {
  const it = findItem(key);
  if (!it) return;
  const backup = { name: it.name, url: it.url, createdAt: it.createdAt || Date.now() };
  if (Number.isFinite(it.order)) backup.order = it.order;

  if (state.arranging) $("grid").querySelector(`.tile[data-id="${CSS.escape(key)}"]`)?.remove();
  if (state.editKey === key) closeSheet();

  remove(itemRef(key)).catch((e) => fbError(e, "Delete nahi hua"));
  toast(`"${it.name}" delete ho gaya`, {
    action: "Undo",
    onAction: () => set(itemRef(key), backup)
      .then(() => toast("Wapas aa gaya ✓"))
      .catch((e) => fbError(e, "Undo nahi hua")),
  });
}

// ===================== Account =====================
function greetingText(user) {
  const h = new Date().getHours();
  const hello = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const first = (user.displayName || "").split(" ")[0];
  return `${hello}${first ? ", " + first : ""} 👋`;
}

function showApp(user) {
  state.user = user;
  $("loginView").hidden = true;
  $("appView").hidden = false;

  $("greeting").textContent = greetingText(user);
  $("userName").textContent = user.displayName || "User";
  $("userEmail").textContent = user.email || "";
  const btn = $("userBtn");
  btn.textContent = firstChar(user.displayName || user.email);
  if (user.photoURL) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.alt = "";
    img.onload = () => { btn.textContent = ""; btn.appendChild(img); };
    img.src = user.photoURL;
  }

  // Pehle cache se turant dikhao, phir Firebase se taaza data
  state.loaded = false;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(user.uid)) || "null");
    if (cached && typeof cached === "object") {
      state.items = toItems(cached);
      state.loaded = true;
    }
  } catch { /* ignore */ }
  render();

  state.unsub?.();
  state.unsub = onValue(
    ref(db, listPath()),
    (snap) => {
      const val = snap.val();
      try { localStorage.setItem(cacheKey(user.uid), JSON.stringify(val || {})); } catch { /* ignore */ }
      setItems(toItems(val));
    },
    (err) => {
      fbError(err, "Bookmarks load nahi hue");
      state.loaded = true;
      render();
    }
  );
}

function showLogin() {
  state.unsub?.();
  state.unsub = null;
  if (state.arranging) endArrange(false);
  closeSheet();
  closeMenu();
  state.user = null;
  state.items = [];
  state.loaded = false;
  $("appView").hidden = true;
  $("loginView").hidden = false;
}

async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const btn = $("loginBtn");
  btn.disabled = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const redirectCodes = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"];
    if (redirectCodes.includes(e?.code)) return signInWithRedirect(auth, provider);
    if (e?.code !== "auth/popup-closed-by-user") fbError(e, "Login nahi hua");
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  const uid = state.user?.uid;
  closeMenu();
  try {
    await signOut(auth);
    if (uid) localStorage.removeItem(cacheKey(uid)); // shared computer par data na rahe
  } catch (e) {
    fbError(e, "Logout nahi hua");
  }
}

const closeMenu = () => ($("userMenu").hidden = true);

// ===================== Events =====================
function bindEvents() {
  $("loginBtn").onclick = login;
  $("logoutBtn").onclick = logout;
  $("userBtn").onclick = (e) => {
    e.stopPropagation();
    $("userMenu").hidden = !$("userMenu").hidden;
  };
  document.addEventListener("click", (e) => {
    if (!$("userMenu").hidden && !e.target.closest("#userMenu")) closeMenu();
  });

  // Search
  $("search").addEventListener("input", () => {
    if (state.arranging) endArrange(false);
    render();
  });

  // Add buttons
  [$("addBtnTop"), $("fab"), $("emptyAddBtn")].forEach((b) => (b.onclick = () => openSheet()));

  // Tiles (event delegation)
  $("grid").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile:not(.skeleton)");
    if (!tile) return;
    const id = tile.dataset.id;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act) {
      e.preventDefault();
      if (act === "edit") openSheet(id);
      else deleteItem(id);
      return;
    }
    if (state.arranging) {
      e.preventDefault();
      openSheet(id);
    }
  });
  $("grid").addEventListener("contextmenu", (e) => {
    if (state.arranging) e.preventDefault();
  });

  // Arrange
  $("arrangeBtn").onclick = startArrange;
  $("arrangeDone").onclick = () => endArrange(true);
  $("arrangeCancel").onclick = () => endArrange(false);

  // Sheet
  $("form").addEventListener("submit", submitForm);
  $("urlInput").addEventListener("input", () => { showFormError(""); updateFormPreview(); });
  $("nameInput").addEventListener("input", () => {
    state.nameTouched = $("nameInput").value.trim() !== "";
    showFormError("");
    updateFormPreview();
  });
  $("closeSheet").onclick = closeSheet;
  $("cancelBtn").onclick = closeSheet;
  $("deleteBtn").onclick = () => state.editKey && deleteItem(state.editKey);
  $("sheet").addEventListener("click", (e) => e.target === $("sheet") && closeSheet());

  // Keyboard: "/" = search, Esc = band
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === "/" && !typing && state.user && $("sheet").hidden) {
      e.preventDefault();
      $("search").focus();
    } else if (e.key === "Escape") {
      if (!$("sheet").hidden) closeSheet();
      else if (!$("userMenu").hidden) closeMenu();
      else if (state.arranging) endArrange(false);
      else if (document.activeElement === $("search") && $("search").value) {
        $("search").value = "";
        render();
      }
    }
  });

  // Scroll par topbar ke neeche line
  addEventListener("scroll", () => $("topbar").classList.toggle("scrolled", scrollY > 4), { passive: true });

  // App install
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPrompt = e;
    $("installBtn").hidden = false;
  });
  $("installBtn").onclick = async () => {
    closeMenu();
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => {});
    state.installPrompt = null;
    $("installBtn").hidden = true;
  };
  addEventListener("appinstalled", () => toast("App install ho gaya 🎉"));
}

// ===================== Start =====================
bindEvents();

onAuthStateChanged(auth, (user) => {
  $("splash").hidden = true;
  user ? showApp(user) : showLogin();
});

if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW error", e));
  });
}
