/* SDComayagua PRO Storefront + Admin (versión completa y depurada - febrero 2026) */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function fmtMoney(value, currency = "Lps.", locale = "es-HN") {
  const n = Number(value || 0);
  if (!isFinite(n)) return String(value ?? "");
  try {
    return currency + "\u00A0" + n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } catch { return currency + " " + n; }
}

function toast(msg, duration = 2200) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.style.display = "none", duration);
}

function getLS(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function setLS(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { } }

function getConfig() {
  const stored = getLS("SDCO_CONFIG", null);
  return Object.assign({}, window.SDCO_DEFAULTS || {}, stored || {});
}
function setConfig(patch) {
  const next = Object.assign({}, getConfig(), patch);
  setLS("SDCO_CONFIG", next);
  return next;
}

async function fetchJSON(url, opts = {}) {
  console.log("[FETCH] " + (opts.method || "GET") + " " + url);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { ok: false, raw: text }; }
  if (!res.ok) throw new Error(data?.error || "HTTP " + res.status);
  console.log("[FETCH OK]", data);
  return data;
}

const CACHE_KEY_PRODUCTS = "SDCO_PRODUCTS_CACHE_V1";
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedProducts() {
  try {
    const obj = JSON.parse(localStorage.getItem(CACHE_KEY_PRODUCTS) || "null");
    if (!obj || Date.now() - obj.ts > CACHE_TTL_MS) return null;
    console.log("[CACHE HIT]", obj.data.length, "productos");
    return obj.data;
  } catch { return null; }
}

function setCachedProducts(data) {
  try {
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({ ts: Date.now(), data }));
    console.log("[CACHE SET]", data.length);
  } catch { }
}

async function apiGetProducts() {
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  console.log("[API GET] Usando base:", base);

  const tries = [
    base + "?only=productos",
    base + "?resource=productos",
    base + "?only=products",
    base + "?resource=products",
    base
  ];

  let lastErr = null;
  for (const u of tries) {
    try {
      const d = await fetchJSON(u);
      if (d && d.ok && (d.productos || d.products)) return d.productos || d.products;
      if (Array.isArray(d)) return d;
      lastErr = new Error("Formato no reconocido");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No se pudo cargar productos");
}

async function apiPost(action, payload) {
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  const body = JSON.stringify(Object.assign({ action }, payload || {}));
  return fetchJSON(base, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body
  });
}

/* Theme (solo claro por ahora) */
function applyTheme() {
  try { localStorage.setItem("SDCO_THEME", "light"); } catch { }
  document.documentElement.removeAttribute("data-theme");
}

/* Storefront STATE */
let STATE = {
  productos: [],
  filtered: [],
  cats: [],
  activeCat: "Todas",
  subcats: [],
  activeSubcat: "Todas",
  q: "",
  sort: "relevancia"
};

function normalizeProducts(list) {
  const items = (list || []).map(p => ({
    id: String(p.id ?? Date.now()),
    nombre: String(p.nombre ?? "Sin nombre"),
    categoria: String(p.categoria ?? "Otros"),
    subcategoria: String(p.subcategoria ?? "General"),
    marca: String(p.marca ?? ""),
    precio: p.precio ?? "",
    stock: Number(p.stock ?? 0),
    activo: String(p.activo ?? "1") === "1" || String(p.activo ?? "").toLowerCase() === "true",
    descripcion: String(p.descripcion ?? ""),
    img: p.img || "",
    gallery: Array.from({length:8}, (_,i) => p[`galeria_${i+1}`] || p[`gallery_${i+1}`]).filter(Boolean),
    video_url: p.video_url || ""
  })).filter(x => x.activo);

  STATE.cats = ["Todas", ...new Set(items.map(x => x.categoria))].sort();
  return items;
}

function deriveSubcats() {
  if (STATE.activeCat === "Todas") {
    STATE.subcats = [];
    STATE.activeSubcat = "Todas";
    return;
  }
  const subs = new Set(STATE.productos.filter(p => p.categoria === STATE.activeCat).map(p => p.subcategoria));
  STATE.subcats = ["Todas", ...Array.from(subs).sort()];
  STATE.activeSubcat = "Todas";
}

function filterAndSort() {
  let res = STATE.productos;
  if (STATE.activeCat !== "Todas") res = res.filter(p => p.categoria === STATE.activeCat);
  if (STATE.activeSubcat !== "Todas") res = res.filter(p => p.subcategoria === STATE.activeSubcat);
  if (STATE.q.trim()) {
    const q = STATE.q.toLowerCase().trim();
    res = res.filter(p => 
      p.nombre.toLowerCase().includes(q) ||
      p.descripcion.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q)
    );
  }
  if (STATE.sort === "precio_asc") res.sort((a,b) => Number(a.precio||0) - Number(b.precio||0));
  if (STATE.sort === "precio_desc") res.sort((a,b) => Number(b.precio||0) - Number(a.precio||0));
  STATE.filtered = res;
}

function renderProducts() {
  const grid = $("#grid");
  if (!grid) return;
  if (STATE.filtered.length === 0) {
    $("#empty").style.display = "block";
    grid.innerHTML = "";
    return;
  }
  $("#empty").style.display = "none";
  grid.innerHTML = STATE.filtered.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="img"><img src="${p.img || 'https://via.placeholder.com/300'}" alt="${p.nombre}" loading="lazy"></div>
      <div class="body">
        <div class="title">${p.nombre}</div>
        ${p.marca ? `<div class="meta">${p.marca}</div>` : ''}
        <div class="price">${fmtMoney(p.precio)}</div>
        <div class="stock">${p.stock > 0 ? `Stock: ${p.stock}` : '<span style="color:#dc2626">Agotado</span>'}</div>
      </div>
    </div>
  `).join('');

  $$(".card").forEach(card => {
    card.addEventListener("click", () => openModal(STATE.filtered.find(prod => prod.id === card.dataset.id)));
  });
}

function openModal(p) {
  if (!p) return;
  $("#backdrop").style.display = "flex";
  $("#mTitle").textContent = p.nombre;
  $("#mSub").textContent = p.categoria + " • " + p.subcategoria;
  $("#mMainImg").src = p.img || 'https://via.placeholder.com/600';
  $("#mPrice").textContent = fmtMoney(p.precio);
  $("#mDesc").textContent = p.descripcion || "Sin descripción.";
  $("#mWA").href = `https://wa.me/50431517755?text=Hola,%20quiero%20comprar%20${encodeURIComponent(p.nombre)}%20(ID:%20${p.id})%20a%20${fmtMoney(p.precio)}`;
  $("#mVideo").style.display = p.video_url ? "inline-block" : "none";
  if (p.video_url) $("#mVideo").href = p.video_url;

  const thumbs = $("#mThumbs");
  thumbs.innerHTML = p.gallery.map(g => `<img src="${g}" alt="galería" class="thumb">`).join('');
  $$(".thumb").forEach(t => t.addEventListener("click", () => $("#mMainImg").src = t.src));
}

function renderCategories() {
  const catGrid = $("#catGrid");
  if (!catGrid) return;
  catGrid.innerHTML = STATE.cats.map(cat => `
    <div class="cat-card" data-cat="${cat}">
      <div class="cat-name">${cat}</div>
    </div>
  `).join('');
  $$(".cat-card").forEach(c => c.addEventListener("click", () => showCatView(c.dataset.cat)));
}

function showCatView(cat = "Todas") {
  STATE.activeCat = cat;
  deriveSubcats();
  filterAndSort();
  renderProducts();
  $("#homeCats").style.display = "none";
  $("#catView").style.display = "block";
  $("#catTitle").textContent = cat === "Todas" ? "Todos los productos" : cat;
}

async function bootStore() {
  console.log("[STORE] Iniciando...");
  $("#loading").style.display = "inline-block";
  try {
    let prods = getCachedProducts();
    if (!prods) {
      prods = await apiGetProducts();
      setCachedProducts(prods);
    }
    STATE.productos = normalizeProducts(prods);
    renderCategories();
    showCatView("Todas");
  } catch (err) {
    console.error("[STORE ERROR]", err);
    toast("Error cargando productos. Revisa consola.", 5000);
  } finally {
    $("#loading").style.display = "none";
  }
}

/* ===== ADMIN ===== */
function bootAdmin() {
  console.log("[ADMIN] Iniciando panel");
  const loginBox = $("#loginBox");
  const adminUI = $("#adminUI");
  const key = localStorage.getItem("SDCO_ADMIN_KEY");

  if (key) {
    loadAdminProducts(key);
    if (adminUI) adminUI.style.display = "flex";
    if (loginBox) loginBox.style.display = "none";
  } else {
    if (loginBox) loginBox.style.display = "block";
    if (adminUI) adminUI.style.display = "none";
  }

  $("#loginBtn")?.addEventListener("click", () => {
    const k = $("#adminKey").value.trim();
    if (!k) return toast("Ingresa la clave");
    localStorage.setItem("SDCO_ADMIN_KEY", k);
    location.reload();
  });

  $("#logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("SDCO_ADMIN_KEY");
    location.reload();
  });
}

async function loadAdminProducts(key) {
  $("#aloading").style.display = "inline";
  try {
    const prods = await apiGetProducts();
    const tbody = $("#atable");
    if (!tbody) return console.error("[ADMIN] Tabla #atable no encontrada");
    tbody.innerHTML = prods.map(p => `
      <tr>
        <td>${p.nombre}</td>
        <td>${fmtMoney(p.precio)}</td>
        <td>${p.stock}</td>
        <td>${p.activo ? 'Activo' : 'Inactivo'}</td>
        <td><button class="btn small edit" data-id="${p.id}">Editar</button></td>
      </tr>
    `).join('');
    console.log("[ADMIN] Lista cargada con", prods.length, "productos");
  } catch (err) {
    console.error("[ADMIN ERROR]", err);
    toast("No se cargó la lista. Verifica clave.", 5000);
  } finally {
    $("#aloading").style.display = "none";
  }
}

/* Init */
window.addEventListener("DOMContentLoaded", () => {
  console.log("[INIT] Página:", document.body.getAttribute("data-page"));
  applyTheme();
  const page = document.body.getAttribute("data-page");
  if (page === "admin") bootAdmin();
  else bootStore();
});
