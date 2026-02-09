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
  console.log("[API] base:", base);

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
  const items = (list || []).map(p => {
    const price = p.precio ?? p.price ?? "";
    const stock = Number(p.stock ?? 0);
    const activo = String(p.activo ?? "1").toLowerCase() === "true" || String(p.activo ?? "1") === "1";
    const categoria = String(p.categoria ?? "Otros").trim() || "Otros";
    const subcategoria = String(p.subcategoria ?? "General").trim() || "General";
    const img = p.img || "";
    const gallery = [];
    for (let i = 1; i <= 8; i++) {
      if (p["galeria_" + i]) gallery.push(p["galeria_" + i]);
      if (p["gallery_" + i]) gallery.push(p["gallery_" + i]);
    }
    return {
      id: String(p.id ?? crypto.randomUUID()),
      nombre: String(p.nombre ?? "Producto"),
      categoria, subcategoria,
      marca: String(p.marca ?? ""),
      precio: price,
      stock: isFinite(stock) ? stock : 0,
      activo: !!activo,
      descripcion: String(p.descripcion ?? ""),
      img,
      gallery: [img, ...gallery].filter(Boolean),
      video_url: String(p.video_url ?? "")
    };
  });

  const visible = items.filter(x => x.activo);
  STATE.cats = ["Todas", ...new Set(visible.map(x => x.categoria))].sort();
  return visible;
}

async function bootStore() {
  console.log("[BOOT] Iniciando...");
  $("#loading").style.display = "inline-block";

  try {
    let productos = getCachedProducts();
    if (!productos) {
      productos = await apiGetProducts();
      setCachedProducts(productos);
    }
    STATE.productos = normalizeProducts(productos);
    console.log("[BOOT] OK - " + STATE.productos.length + " productos");

    // Render básico para probar que llega aquí
    const grid = $("#grid");
    if (grid) {
      grid.innerHTML = STATE.productos.map(p => `
        <div class="card">
          <div class="img"><img src="${p.img || 'https://via.placeholder.com/300'}" alt="${p.nombre}"></div>
          <div class="body">
            <div class="title">${p.nombre}</div>
            <div class="price"><strong>${fmtMoney(p.precio)}</strong></div>
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error("[BOOT ERROR]", err);
    toast("Error al cargar productos – revisa consola (F12)", 5000);

    const main = $("main");
    if (main) {
      main.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:#dc2626;">
          <h2>Problema al cargar el catálogo</h2>
          <p>${err.message}</p>
          <p>Prueba recargar o verifica la URL de la API en Configuración.</p>
          <button onclick="location.reload()" class="btn primary">Recargar</button>
        </div>
      `;
    }
  } finally {
    $("#loading").style.display = "none";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("[DOM] Listo – página:", document.body.getAttribute("data-page"));
  if (document.body.getAttribute("data-page") === "store") bootStore();
});
