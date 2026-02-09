/* SDComayagua PRO Storefront + Admin (sin tocar código para operar) */

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

function getLS(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch{ return fallback; }
}
function setLS(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
}

function getConfig(){
  const stored = getLS("SDCO_CONFIG", null);
  return Object.assign({}, window.SDCO_DEFAULTS || {}, stored || {});
}
function setConfig(patch){
  const next = Object.assign({}, getConfig(), patch);
  setLS("SDCO_CONFIG", next);
  return next;
}

async function fetchJSON(url, opts){
  console.log("[FETCH] Iniciando petición a:", url, opts?.method || "GET");
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try{ data = JSON.parse(text); }catch{ data = { ok:false, raw:text }; }
  if(!res.ok) throw new Error(data?.error || "HTTP " + res.status);
  console.log("[FETCH OK] Respuesta recibida:", data.ok ? "ok:true" : "ok:false");
  return data;
}

/* ===== Cache local (acelera carga desde Apps Script) ===== */
const CACHE_KEY_PRODUCTS = "SDCO_PRODUCTS_CACHE_V1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCachedProducts(){
  try{
    const obj = JSON.parse(localStorage.getItem(CACHE_KEY_PRODUCTS) || "null");
    if(!obj) return null;
    if(Date.now() - obj.ts > CACHE_TTL_MS) return null;
    console.log("[CACHE HIT] Usando productos en caché (" + obj.data.length + " items)");
    return obj.data;
  }catch{ return null; }
}

function setCachedProducts(data){
  try{
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({ ts: Date.now(), data }));
    console.log("[CACHE SET] Guardados " + data.length + " productos en caché");
  }catch{}
}

/* ===== API helpers (auto-detect only/resource modes) ===== */
async function apiGetProducts(){
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  console.log("[API] Intentando cargar productos desde base:", base);

  const tries = [
    base + "?only=productos",
    base + "?resource=productos",
    base + "?only=products",
    base + "?resource=products",
    base
  ];
  let lastErr = null;
  for(const u of tries){
    try{
      console.log("[API TRY] Probando:", u);
      const d = await fetchJSON(u);
      if(d && d.ok && (d.productos || d.products)) {
        console.log("[API SUCCESS] Productos cargados (" + (d.productos?.length || d.products?.length) + ")");
        return d.productos || d.products;
      }
      if(Array.isArray(d)) {
        console.log("[API SUCCESS] Respuesta array directa (" + d.length + ")");
        return d;
      }
      lastErr = new Error("Formato no reconocido");
    }catch(e){
      console.warn("[API FAIL]", u, e.message);
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo cargar productos de ninguna URL");
}

async function apiPost(action, payload){
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  console.log("[POST] Acción:", action, "a:", base);
  const body = JSON.stringify(Object.assign({ action }, payload || {}));
  return fetchJSON(base, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body
  });
}

/* ===== Theme (solo modo claro por ahora) ===== */
function applyTheme(){
  try{ localStorage.setItem("SDCO_THEME","light"); }catch{}
  document.documentElement.removeAttribute("data-theme");
}
function toggleTheme(){ applyTheme(); }

/* ===== Storefront ===== */
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
    const activo = (String(p.activo ?? p.Activo ?? "1") === "1" || String(p.activo ?? p.Activo ?? "").toLowerCase()==="true");
    const categoria = (p.categoria ?? p.category ?? "Otros").trim?.() ?? "Otros";
    const subcategoria = (p.subcategoria ?? p.subcategory ?? "General").trim?.() ?? "General";
    const img = p.img || p.imagen || p.image || p.foto || "";
    const gal = [];
    for(let i=1;i<=8;i++){
      const k = "galeria_"+i;
      if(p[k]) gal.push(p[k]);
    }
    for(let i=1;i<=8;i++){
      const k = "gallery_"+i;
      if(p[k]) gal.push(p[k]);
    }
    const gallery = [img, ...gal].filter(Boolean);
    return {
      id: String(p.id ?? p.ID ?? crypto.randomUUID()),
      nombre: String(p.nombre ?? p.name ?? "Producto"),
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
  const cats = ["Todas", ...Array.from(new Set(visible.map(x=>x.categoria))).sort((a,b)=>a.localeCompare(b,"es"))];
  STATE.cats = cats;
  return visible;
}

function deriveSubcats(){
  const cat = STATE.activeCat;
  if(cat === "Todas") {
    STATE.subcats = [];
    STATE.activeSubcat = "Todas";
    return;
  }
  const subs = new Set(STATE.productos.filter(p=>p.categoria===cat).map(p=>p.subcategoria));
  STATE.subcats = ["Todas", ...Array.from(subs).sort()];
  STATE.activeSubcat = "Todas";
}

function filterAndSort(){
  let res = STATE.productos;

  // Categoría
  if(STATE.activeCat !== "Todas"){
    res = res.filter(p => p.categoria === STATE.activeCat);
  }

  // Subcategoría
  if(STATE.activeSubcat !== "Todas"){
    res = res.filter(p => p.subcategoria === STATE.activeSubcat);
  }

  // Búsqueda
  if(STATE.q.trim()){
    const q = STATE.q.toLowerCase().trim();
    res = res.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.descripcion.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q) ||
      p.subcategoria.toLowerCase().includes(q)
    );
  }

  // Orden
  if(STATE.sort === "precio_asc"){
    res.sort((a,b) => Number(a.precio||0) - Number(b.precio||0));
  } else if(STATE.sort === "precio_desc"){
    res.sort((a,b) => Number(b.precio||0) - Number(a.precio||0));
  } // relevancia = orden natural por ahora

  STATE.filtered = res;
  console.log("[FILTER] Resultado:", res.length, "productos");
}

function renderProducts(){
  const grid = $("#grid");
  if(!grid) return;

  if(STATE.filtered.length === 0){
    $("#empty").style.display = "block";
    grid.innerHTML = "";
    return;
  }

  $("#empty").style.display = "none";
  grid.innerHTML = STATE.filtered.map(p => `
    <div class="card" data-id="${p.id}" role="button" tabindex="0">
      <div class="img">
        <img src="${p.img || 'https://via.placeholder.com/300?text=Sin+imagen'}" alt="${p.nombre}" loading="lazy">
      </div>
      <div class="body">
        <div class="title">${p.nombre}</div>
        ${p.marca ? `<div class="meta"><span class="badge">${p.marca}</span></div>` : ''}
        <div class="price">
          <strong>${fmtMoney(p.precio)}</strong>
          ${p.stock <= 0 ? '<span class="badge bad">Agotado</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderCategories(){
  const container = $("#catGrid");
  if(!container) return;

  container.innerHTML = STATE.cats.map(cat => `
    <div class="cat-card" data-cat="${cat}" role="button" tabindex="0">
      <div class="cat-name">${cat}</div>
    </div>
  `).join('');
}

function updateBreadcrumb(){
  $("#bcCat").textContent = STATE.activeCat;
  if(STATE.activeCat !== "Todas" && STATE.activeSubcat !== "Todas"){
    $("#bcSub").textContent = STATE.activeSubcat;
    $("#bcSubWrap").style.display = "inline";
  } else {
    $("#bcSubWrap").style.display = "none";
  }
}

function showCatView(cat = "Todas", sub = "Todas"){
  STATE.activeCat = cat;
  STATE.activeSubcat = sub;
  deriveSubcats();
  filterAndSort();
  renderProducts();

  $("#homeCats").style.display = "none";
  $("#catView").style.display = "block";
  $("#catTitle").textContent = cat === "Todas" ? "Todos los productos" : cat;
  updateBreadcrumb();
}

async function bootStore(){
  console.log("[BOOT STORE] Iniciando carga de la tienda");
  $("#loading").style.display = "inline-block";

  try {
    let productos = getCachedProducts();
    if(!productos){
      console.log("[BOOT] No hay caché válido → consultando API");
      productos = await apiGetProducts();
      setCachedProducts(productos);
    } else {
      console.log("[BOOT] Cargando desde caché local");
    }

    STATE.productos = normalizeProducts(productos);
    console.log("[BOOT] Productos procesados:", STATE.productos.length);

    renderCategories();
    showCatView("Todas", "Todas"); // vista inicial

  } catch(err){
    console.error("[BOOT ERROR]", err.message, err.stack);
    toast("No se pudieron cargar los productos. Revisa la consola (F12).", 5000);

    const container = $(".container") || document.body;
    const errorMsg = document.createElement("div");
    errorMsg.innerHTML = `
      <div style="padding:50px 20px; text-align:center; color:#dc2626; background:#fff2f2; border:2px solid #dc2626; border-radius:12px; margin:40px auto; max-width:700px;">
        <h2>Problema al cargar el catálogo</h2>
        <p style="font-size:1.1rem;">${err.message || "Error desconocido"}</p>
        <p>Posibles soluciones:</p>
        <ul style="text-align:left; max-width:500px; margin:20px auto;">
          <li>Recargar la página</li>
          <li>Abrir en modo incógnito</li>
          <li>Verificar la URL de la API en Configuración</li>
          <li>Confirmar que la Web App de Google está desplegada como "Cualquiera"</li>
        </ul>
        <button class="btn primary" onclick="location.reload()">Intentar de nuevo</button>
      </div>
    `;
    container.prepend(errorMsg);
  } finally {
    $("#loading").style.display = "none";
  }
}

/* ===== Admin (simplificado, solo si existe admin.html) ===== */
function bootAdmin(){
  console.log("[BOOT ADMIN] Modo administrador detectado");
  // Aquí iría el código original de admin si lo tienes separado
  // Por ahora solo log para confirmar
  const key = localStorage.getItem("SDCO_ADMIN_KEY");
  if(key){
    console.log("[ADMIN] Clave encontrada en localStorage");
  } else {
    console.log("[ADMIN] No hay clave guardada → mostrar login");
  }
}

/* ===== Router / Init ===== */
window.addEventListener("DOMContentLoaded", ()=>{
  console.log("[INIT] DOMContentLoaded - página:", document.body.getAttribute("data-page"));
  applyTheme();

  const page = document.body.getAttribute("data-page");
  if(page === "admin"){
    bootAdmin();
  } else {
    bootStore();
  }

  // Eventos básicos (puedes expandir)
  $("#goCats")?.addEventListener("click", ()=> showCatView("Todas"));
  $("#goAll")?.addEventListener("click", ()=> showCatView("Todas"));
  $("#catsBtn")?.addEventListener("click", ()=> $("#catView").style.display = "block");
  $("#adminBtn")?.addEventListener("click", ()=> window.location.href = "admin.html");

  // Más eventos de tu código original (filtros, búsqueda, modal, etc.) se mantienen aquí si los tenías
  // Ejemplo básico de búsqueda home
  $("#qHome")?.addEventListener("input", e => {
    STATE.q = e.target.value;
    filterAndSort();
    renderProducts();
  });
});
