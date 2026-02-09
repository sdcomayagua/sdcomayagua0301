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

/* ===== Cache local ===== */
const CACHE_KEY_PRODUCTS = "SDCO_PRODUCTS_CACHE_V1";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

/* ===== API helpers ===== */
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

/* ===== Theme ===== */
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

function deriveSubcats(){
  const cat = STATE.activeCat;
  if(cat === "Todas") return STATE.subcats = [], STATE.activeSubcat = "Todas";
  const subs = new Set(STATE.productos.filter(p=>p.categoria === cat).map(p=>p.subcategoria));
  STATE.subcats = ["Todas", ...Array.from(subs).sort()];
  STATE.activeSubcat = "Todas";
  // Render pills
  const pills = $("#subPills");
  if(pills) pills.innerHTML = STATE.subcats.map(sub => `<button class="pill" data-sub="${sub}">${sub}</button>`).join('');
}

function filterAndSort(){
  let res = STATE.productos;
  if(STATE.activeCat !== "Todas") res = res.filter(p => p.categoria === STATE.activeCat);
  if(STATE.activeSubcat !== "Todas") res = res.filter(p => p.subcategoria === STATE.activeSubcat);
  if(STATE.q.trim()){
    const q = STATE.q.toLowerCase().trim();
    res = res.filter(p => p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || p.subcategoria.toLowerCase().includes(q));
  }
  if(STATE.sort === "precio_asc") res.sort((a,b) => Number(a.precio||0) - Number(b.precio||0));
  else if(STATE.sort === "precio_desc") res.sort((a,b) => Number(b.precio||0) - Number(a.precio||0));
  STATE.filtered = res;
  console.log("[FILTER] Resultado:", res.length, "productos");
}

function renderProducts(){
  const grid = $("#grid");
  if(!grid) return console.warn("[RENDER] No se encontró #grid");
  if(STATE.filtered.length === 0){
    $("#empty").style.display = "block";
    grid.innerHTML = "";
    return console.log("[RENDER] No hay productos para mostrar");
  }
  $("#empty").style.display = "none";
  grid.innerHTML = STATE.filtered.map(p => `
    <div class="card" data-id="${p.id}" role="button" tabindex="0">
      <div class="img">
        <img src="${p.img || 'https://via.placeholder.com/300?text=Sin+imagen'}" alt="${p.nombre}" loading="lazy">
      </div>
      <div class="body">
        <div class="title">${p.nombre}</div>
        <div class="meta">${p.marca ? `<span class="badge">${p.marca}</span>` : ''} <span class="badge">${p.stock > 0 ? `Stock: ${p.stock}` : 'Agotado'}</span></div>
        <div class="price"><strong>${fmtMoney(p.precio)}</strong></div>
      </div>
    </div>
  `).join('');
  console.log("[RENDER] Tarjetas renderizadas:", STATE.filtered.length);

  // Agregar eventos para abrir modal
  $$(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const p = STATE.productos.find(prod => prod.id === id);
      if(p) openModal(p);
    });
  });
  console.log("[EVENT] Eventos de click agregados a tarjetas");
}

function openModal(p){
  if(!p) return console.warn("[MODAL] Producto no encontrado");
  $("#backdrop").style.display = "block";
  $("#mTitle").textContent = p.nombre;
  $("#mSub").textContent = p.categoria + " / " + p.subcategoria;
  $("#mMainImg").src = p.img || 'https://via.placeholder.com/600?text=Sin+imagen';
  $("#mMainImg").alt = p.nombre;
  $("#mPrice").textContent = fmtMoney(p.precio);
  $("#mDesc").textContent = p.descripcion || "Sin descripción disponible.";
  $("#mWA").href = `https://wa.me/${getConfig().WHATSAPP_NUMBER}?text=Hola, quiero comprar: ${p.nombre} (ID: ${p.id}) - Precio: ${fmtMoney(p.precio)}`;
  $("#mVideo").style.display = p.video_url ? "inline-block" : "none";
  if(p.video_url) $("#mVideo").href = p.video_url;

  const thumbs = $("#mThumbs");
  thumbs.innerHTML = p.gallery.map((g, idx) => `
    <img src="${g}" alt="Galería ${idx+1}" class="thumb" data-src="${g}">
  `).join('');
  $$(".thumb").forEach(thumb => thumb.addEventListener("click", () => $("#mMainImg").src = thumb.dataset.src));

  console.log("[MODAL] Abierto para producto ID:", p.id);
}

function renderCategories(){
  const container = $("#catGrid");
  if(!container) return console.warn("[RENDER CATS] No se encontró #catGrid");
  container.innerHTML = STATE.cats.slice(1).map(cat => `
    <div class="cat-card" data-cat="${cat}" role="button" tabindex="0">
      <div class="cat-name">${cat}</div>
    </div>
  `).join('');
  console.log("[RENDER] Categorías renderizadas:", STATE.cats.length - 1);

  $$(".cat-card").forEach(card => {
    card.addEventListener("click", () => showCatView(card.dataset.cat));
  });
}

function updateBreadcrumb(){
  $("#bcCat").textContent = STATE.activeCat;
  $("#bcSubWrap").style.display = STATE.activeSubcat !== "Todas" ? "inline" : "none";
  if(STATE.activeSubcat !== "Todas") $("#bcSub").textContent = STATE.activeSubcat;
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
  console.log("[VIEW] Mostrando categoría:", cat, sub);
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
    showCatView("Todas", "Todas"); // Vista inicial con todos

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

/* ===== Admin ===== */
function bootAdmin(){
  // Lógica de admin original (login, list, editor)
  console.log("[BOOT ADMIN] Modo administrador detectado");
  // Añade aquí tu código original de admin si es necesario, o deja para otro archivo.
}

/* ===== Router ===== */
window.addEventListener("DOMContentLoaded", ()=>{
  console.log("[INIT] DOMContentLoaded - página:", document.body.getAttribute("data-page"));
  applyTheme();

  const page = document.body.getAttribute("data-page");
  if(page==="admin") bootAdmin();
  else bootStore();

  // Eventos adicionales
  $("#goCats").addEventListener("click", ()=> showCatView("Todas"));
  $("#goAll").addEventListener("click", ()=> showCatView("Todas"));
  $("#catsBtn").addEventListener("click", ()=> showCatView("Todas"));
  $("#adminBtn").addEventListener("click", ()=> window.location.href = "admin.html");
  $("#closeModal").addEventListener("click", ()=> $("#backdrop").style.display = "none");
  $("#backdrop").addEventListener("click", e => { if(e.target === e.currentTarget) $("#backdrop").style.display = "none"; });
  $("#q").addEventListener("input", e => { STATE.q = e.target.value; filterAndSort(); renderProducts(); });
  $("#sort").addEventListener("change", e => { STATE.sort = e.target.value; filterAndSort(); renderProducts(); });
  $("#qHome").addEventListener("input", e => { STATE.q = e.target.value; showCatView("Todas"); filterAndSort(); renderProducts(); });
  $("#clearHome").addEventListener("click", () => { $("#qHome").value = ""; STATE.q = ""; filterAndSort(); renderProducts(); });
  $("#bcHome").addEventListener("click", () => { showCatView("Todas"); });
  $("#subPills").addEventListener("click", e => {
    if(e.target.dataset.sub){
      STATE.activeSubcat = e.target.dataset.sub;
      filterAndSort();
      renderProducts();
      updateBreadcrumb();
    }
  });
});
