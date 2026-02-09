/* SDComayagua PRO Storefront + Admin - versión con depuración mejorada */

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function fmtMoney(value, currency="Lps.", locale="es-HN"){
  const n = Number(value || 0);
  if(!isFinite(n)) return String(value ?? "");
  try{
    return currency + "\u00A0" + n.toLocaleString(locale, {minimumFractionDigits:0, maximumFractionDigits:2});
  }catch{ return currency + " " + n; }
}

function toast(msg, duration=2200){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=> el.style.display="none", duration);
}

function getLS(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch{ return fallback; } }
function setLS(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} }

function getConfig(){
  const stored = getLS("SDCO_CONFIG", null);
  return Object.assign({}, window.SDCO_DEFAULTS || {}, stored || {});
}
function setConfig(patch){
  const next = Object.assign({}, getConfig(), patch);
  setLS("SDCO_CONFIG", next);
  return next;
}

async function fetchJSON(url, opts={}){
  console.log("[FETCH] →", opts.method || "GET", url);
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { ok:false, raw:text, parseError:e.message }; }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status} - ${text.slice(0,120)}...`);
    console.log("[FETCH OK]", data.ok ? "ok:true" : "ok:false", "items:", data.productos?.length || data.products?.length || "n/a");
    return data;
  } catch (err) {
    console.error("[FETCH ERROR]", err.message, url);
    throw err;
  }
}

const CACHE_KEY_PRODUCTS = "SDCO_PRODUCTS_CACHE_V1";
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedProducts(){
  try{
    const obj = JSON.parse(localStorage.getItem(CACHE_KEY_PRODUCTS) || "null");
    if(!obj || Date.now() - obj.ts > CACHE_TTL_MS) return null;
    console.log("[CACHE HIT] productos:", obj.data.length);
    return obj.data;
  }catch{ return null; }
}

function setCachedProducts(data){
  try{
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({ ts: Date.now(), data }));
    console.log("[CACHE SET] productos:", data.length);
  }catch{}
}

async function apiGetProducts(){
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  console.log("[API] Intentando base:", base);

  const tries = [
    base + "?only=productos",
    base + "?resource=productos",
    base + "?only=products",
    base + "?resource=products",
    base + ""
  ];

  let lastErr = null;
  for (const u of tries) {
    try {
      console.log("[API TRY]", u);
      const d = await fetchJSON(u);
      if (d && d.ok && (d.productos || d.products)) return d.productos || d.products;
      if (Array.isArray(d)) return d;
      lastErr = new Error("Formato desconocido en " + u);
    } catch (e) {
      console.warn("[API FAIL]", u, e.message);
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo obtener productos");
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

function normalizeProducts(list){
  const cfg = getConfig();
  const items = (list || []).map(p => {
    const price = (p.precio ?? p.price ?? p.Precio ?? "");
    const stock = Number(p.stock ?? p.Stock ?? 0);
    const activo = (String(p.activo ?? p.Activo ?? "1").toLowerCase() === "true" || String(p.activo ?? p.Activo ?? "1") === "1");
    const categoria = String(p.categoria ?? p.category ?? "Otros").trim() || "Otros";
    const subcategoria = String(p.subcategoria ?? p.subcategory ?? "General").trim() || "General";
    const img = p.img || p.imagen || p.image || p.foto || "";
    const gal = [];
    for(let i=1;i<=8;i++){
      const k = "galeria_"+i;
      if(p[k]) gal.push(p[k]);
      const k2 = "gallery_"+i;
      if(p[k2]) gal.push(p[k2]);
    }
    const gallery = [img, ...gal].filter(Boolean);
    return {
      id: String(p.id ?? p.ID ?? crypto.randomUUID?.() ?? Date.now()),
      nombre: String(p.nombre ?? p.name ?? "Producto sin nombre"),
      categoria, subcategoria,
      marca: String(p.marca ?? p.brand ?? ""),
      precio: price,
      stock: isFinite(stock) ? stock : 0,
      activo: !!activo,
      descripcion: String(p.descripcion ?? p.description ?? ""),
      img,
      gallery,
      video_url: String(p.video_url ?? p.video ?? "")
    };
  });

  const visible = items.filter(x => x.activo);
  const cats = ["Todas", ...new Set(visible.map(x=>x.categoria))].sort();
  STATE.cats = cats;
  return visible;
}

// ... (aquí iría el resto de funciones: deriveSubcats, render functions, event listeners, bootStore, bootAdmin, etc.)

// Versión simplificada de bootStore con diagnóstico fuerte
async function bootStore() {
  console.log("[BOOT] Iniciando storefront –", new Date().toLocaleString('es-HN'));

  const loadingEl = $("#loading");
  if (loadingEl) loadingEl.style.display = "inline-block";

  try {
    let productos = getCachedProducts();
    if (!productos) {
      console.log("[BOOT] No hay cache válido → consultando API");
      productos = await apiGetProducts();
      setCachedProducts(productos);
    } else {
      console.log("[BOOT] Usando cache");
    }

    console.log("[BOOT] Productos obtenidos:", productos.length);
    STATE.productos = normalizeProducts(productos);

    // Aquí irían tus llamadas a renderizar categorías, grids, slider, etc.
    // Por ahora solo mostramos que llegó hasta aquí
    if (STATE.productos.length === 0) {
      toast("No hay productos activos en el catálogo todavía", 4000);
    }

  } catch (err) {
    console.error("[BOOT ERROR]", err);
    toast("No se pudo cargar el catálogo. Revisa la consola (F12) o la configuración.", 6000);

    const main = $("main") || document.body;
    const errorDiv = document.createElement("div");
    errorDiv.innerHTML = `
      <div style="padding:50px 20px; text-align:center; color:#dc2626; background:#fef2f2; border:2px solid #dc2626; border-radius:12px; margin:30px auto; max-width:700px;">
        <h2 style="margin:0 0 16px;">Problema al cargar los productos</h2>
        <p style="font-size:1.1rem; margin:0 0 20px;">${err.message || "Error desconocido"}</p>
        <p style="margin:20px 0 10px;">Prueba lo siguiente:</p>
        <ul style="text-align:left; max-width:480px; margin:0 auto 30px; line-height:1.6;">
          <li>Recargar la página (F5 o Ctrl+R)</li>
          <li>Abrir en modo incógnito</li>
          <li>Verificar la URL de la API en el botón Configuración</li>
          <li>Asegurarte que la Web App de Google está desplegada como "Cualquiera"</li>
        </ul>
        <button class="btn primary" onclick="location.reload()" style="padding:14px 32px; font-size:1.1rem;">
          Recargar página ahora
        </button>
      </div>
    `;
    main.prepend(errorDiv);
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

window.addEventListener("DOMContentLoaded", ()=>{
  console.log("[DOM] Cargado – página:", document.body.getAttribute("data-page"));
  const page = document.body.getAttribute("data-page");
  if(page === "admin") {
    // bootAdmin();   ← descomenta si ya tienes la función bootAdmin
    console.log("[DOM] Modo admin detectado");
  } else {
    bootStore();
  }
});
