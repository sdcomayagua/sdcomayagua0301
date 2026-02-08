/* SDComayagua PRO Storefront + Admin (sin tocar código para operar) */

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function fmtMoney(value, currency="Lps.", locale="es-HN"){
  const n = Number(value || 0);
  if(!isFinite(n)) return String(value ?? "");
  try{
    return currency + " " + n.toLocaleString(locale, {minimumFractionDigits:0, maximumFractionDigits:2});
  }catch{ return currency + " " + n; }
}

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=> el.style.display="none", 1600);
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
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try{ data = JSON.parse(text); }catch{ data = { ok:false, raw:text }; }
  if(!res.ok) throw new Error(data?.error || "HTTP " + res.status);
  return data;
}

/* ===== API helpers (auto-detect only/resource modes) ===== */
async function apiGetProducts(){
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
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
      const d = await fetchJSON(u);
      if(d && d.ok && (d.productos || d.products)) return d.productos || d.products;
      // Some backends return array directly
      if(Array.isArray(d)) return d;
      lastErr = new Error("Formato no reconocido");
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error("No se pudo cargar productos");
}

async function apiPost(action, payload){
  const cfg = getConfig();
  const base = cfg.API_BASE_DEFAULT;
  const body = JSON.stringify(Object.assign({ action }, payload || {}));
  return fetchJSON(base, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body
  });
}

/* ===== Theme ===== */
function applyTheme(){
  const t = getLS("SDCO_THEME","light");
  document.documentElement.setAttribute("data-theme", t);
  $("#themeBtn")?.setAttribute("aria-pressed", t==="dark" ? "true":"false");
}
function toggleTheme(){
  const cur = getLS("SDCO_THEME","light");
  const next = cur==="dark" ? "light":"dark";
  setLS("SDCO_THEME", next);
  applyTheme();
}

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
    // allow legacy gallery_1..8
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

  // remove inactive from storefront
  const visible = items.filter(x => x.activo);

  // compute cats
  const cats = ["Todas", ...Array.from(new Set(visible.map(x=>x.categoria))).sort((a,b)=>a.localeCompare(b,"es"))];
  STATE.cats = cats;
  return visible;
}

function deriveSubcats(){
  const base = STATE.activeCat==="Todas" ? STATE.productos : STATE.productos.filter(p=>p.categoria===STATE.activeCat);
  const sub = ["Todas", ...Array.from(new Set(base.map(x=>x.subcategoria))).sort((a,b)=>a.localeCompare(b,"es"))];
  STATE.subcats = sub;
  const sel = $("#subcat");
  if(sel){
    sel.innerHTML = sub.map(s=>`<option>${escapeHtml(s)}</option>`).join("");
    sel.value = STATE.activeSubcat && sub.includes(STATE.activeSubcat) ? STATE.activeSubcat : "Todas";
    STATE.activeSubcat = sel.value;
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function applyFilters(){
  let items = [...STATE.productos];

  if(STATE.activeCat !== "Todas") items = items.filter(p=>p.categoria===STATE.activeCat);
  if(STATE.activeSubcat !== "Todas") items = items.filter(p=>p.subcategoria===STATE.activeSubcat);

  const q = STATE.q.trim().toLowerCase();
  if(q){
    items = items.filter(p =>
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.descripcion||"").toLowerCase().includes(q) ||
      (p.marca||"").toLowerCase().includes(q)
    );
  }

  // sorting
  if(STATE.sort==="precio_asc"){
    items.sort((a,b)=>Number(a.precio||0)-Number(b.precio||0));
  }else if(STATE.sort==="precio_desc"){
    items.sort((a,b)=>Number(b.precio||0)-Number(a.precio||0));
  }else{
    // relevancia: in-stock first, then name
    items.sort((a,b)=> (b.stock>0)-(a.stock>0) || a.nombre.localeCompare(b.nombre,"es"));
  }

  STATE.filtered = items;
  renderGrid();
}

function renderChips(){
  const wrap = $("#chips");
  if(!wrap) return;
  wrap.innerHTML = STATE.cats.map(c => {
    const active = c===STATE.activeCat ? "active" : "";
    return `<button class="chip ${active}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
  }).join("");
  $$(".chip", wrap).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      STATE.activeCat = btn.dataset.cat;
      STATE.activeSubcat = "Todas";
      renderChips();
      deriveSubcats();
      applyFilters();
    });
  });
}

function renderGrid(){
  const grid = $("#grid");
  const empty = $("#empty");
  if(!grid) return;

  if(!STATE.filtered.length){
    grid.innerHTML = "";
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  const cfg = getConfig();
  grid.innerHTML = STATE.filtered.map(p => {
    const priceText = (p.precio==="" || p.precio===null || p.precio===undefined) ? "Consultar" : fmtMoney(p.precio, cfg.CURRENCY, cfg.LOCALE);
    const badge = p.stock>0 ? `<span class="badge ok">Disponible</span>` : `<span class="badge bad">Agotado</span>`;
    const img = p.img || (p.gallery[0]||"");
    return `
      <article class="card" data-id="${escapeHtml(p.id)}">
        <div class="img">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.nombre)}">` : `<span class="pill">Sin imagen</span>`}</div>
        <div class="body">
          <div class="title">${escapeHtml(p.nombre)}</div>
          <div class="meta">
            ${badge}
            <span class="badge">${escapeHtml(p.categoria)}</span>
            <span class="badge">${escapeHtml(p.subcategoria)}</span>
          </div>
          <div class="price">
            <strong>${escapeHtml(priceText)}</strong>
            <button class="smallbtn" data-share="1" title="Compartir">Compartir</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  $$(".card", grid).forEach(card=>{
    card.addEventListener("click", (e)=>{
      if(e.target?.dataset?.share) return;
      const id = card.dataset.id;
      const p = STATE.filtered.find(x=>x.id===id) || STATE.productos.find(x=>x.id===id);
      if(p) openModal(p);
    });
    const shareBtn = card.querySelector("[data-share='1']");
    shareBtn?.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const id = card.dataset.id;
      const p = STATE.filtered.find(x=>x.id===id) || STATE.productos.find(x=>x.id===id);
      if(!p) return;
      const url = buildProductUrl(p);
      try{
        if(navigator.share){
          await navigator.share({ title:p.nombre, text: p.nombre, url });
        }else{
          await navigator.clipboard.writeText(url);
          toast("Link copiado");
        }
      }catch{ toast("No se pudo compartir"); }
    });
  });
}

/* ===== Modal ===== */
function buildProductUrl(p){
  const slug = (p.nombre||"producto").toLowerCase()
    .replace(/[^\wáéíóúñ]+/g, "-")
    .replace(/^-|-$/g,"")
    .slice(0,70);
  return location.origin + location.pathname + "#p=" + encodeURIComponent(p.id) + "&n=" + encodeURIComponent(slug);
}

function openModal(p){
  const cfg = getConfig();
  $("#mTitle").textContent = p.nombre;
  $("#mSub").textContent = [p.categoria, p.subcategoria].filter(Boolean).join(" • ");
  const priceText = (p.precio==="" || p.precio===null || p.precio===undefined) ? "Consultar" : fmtMoney(p.precio, cfg.CURRENCY, cfg.LOCALE);
  $("#mPrice").textContent = priceText;

  const meta = $("#mMeta");
  meta.innerHTML = `
    <span class="badge">${p.stock>0 ? "🟢 Disponible" : "🔴 Agotado"}</span>
    ${p.marca ? `<span class="badge">Marca: ${escapeHtml(p.marca)}</span>` : ""}
  `;

  $("#mDesc").textContent = (p.descripcion || "Consulta detalles por WhatsApp.");

  const gallery = (p.gallery && p.gallery.length ? p.gallery : [p.img].filter(Boolean)).filter(Boolean);
  const main = $("#mMainImg");
  main.src = gallery[0] || "";

  const thumbs = $("#mThumbs");
  thumbs.innerHTML = gallery.map((u, i)=>`
    <button class="thumb ${i===0?'active':''}" data-i="${i}" type="button">
      <img src="${escapeHtml(u)}" alt="Miniatura ${i+1}">
    </button>
  `).join("");

  $$(".thumb", thumbs).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".thumb", thumbs).forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const i = Number(btn.dataset.i||0);
      main.src = gallery[i] || gallery[0] || "";
    });
  });

  const waText = `Hola, me interesa este producto:%0A%0A${encodeURIComponent(p.nombre)}%0A${encodeURIComponent(priceText)}%0A%0A¿Está disponible?`;
  const wa = "https://wa.me/" + cfg.WHATSAPP_NUMBER + "?text=" + waText;
  $("#mWA").href = wa;

  $("#mCopy").onclick = async ()=>{
    try{ await navigator.clipboard.writeText(buildProductUrl(p)); toast("Link copiado"); }catch{ toast("No se pudo copiar"); }
  };

  $("#backdrop").style.display="flex";
  document.body.style.overflow="hidden";
}

function closeModal(){
  $("#backdrop").style.display="none";
  document.body.style.overflow="";
}

/* ===== Boot storefront ===== */
async function bootStore(){
  applyTheme();
  const cfg = getConfig();
  $("#brandName").textContent = cfg.APP_NAME;
  $("#brandSub").textContent = "Pedidos por WhatsApp • " + cfg.WHATSAPP_DISPLAY;
  $("#waTop").href = "https://wa.me/" + cfg.WHATSAPP_NUMBER;

  $("#themeBtn")?.addEventListener("click", toggleTheme);
  $("#adminBtn")?.addEventListener("click", ()=> location.href = "admin.html");
  $("#closeModal")?.addEventListener("click", closeModal);
  $("#backdrop")?.addEventListener("click", (e)=>{ if(e.target.id==="backdrop") closeModal(); });
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

  $("#q")?.addEventListener("input", (e)=>{ STATE.q = e.target.value; applyFilters(); });
  $("#sort")?.addEventListener("change", (e)=>{ STATE.sort = e.target.value; applyFilters(); });
  $("#subcat")?.addEventListener("change", (e)=>{ STATE.activeSubcat = e.target.value; applyFilters(); });

  $("#cfgBtn")?.addEventListener("click", ()=> openConfigDialog());
  $("#cfgSave")?.addEventListener("click", ()=> saveConfigFromDialog());
  $("#cfgClose")?.addEventListener("click", ()=> closeConfigDialog());
  $("#cfgBackdrop")?.addEventListener("click", (e)=>{ if(e.target.id==="cfgBackdrop") closeConfigDialog(); });

  try{
    $("#loading").style.display="inline-flex";
    const list = await apiGetProducts();
    STATE.productos = normalizeProducts(list);
    deriveSubcats();
    renderChips();
    applyFilters();
    // open product from hash
    if(location.hash.includes("#p=")){
      const params = new URLSearchParams(location.hash.slice(1));
      const id = params.get("p");
      const p = STATE.productos.find(x=>x.id===id);
      if(p) openModal(p);
    }
  }catch(e){
    console.error(e);
    $("#empty").style.display="block";
    $("#empty").innerHTML = `<strong>No se pudo cargar el catálogo.</strong><br><small>${escapeHtml(String(e.message||e))}</small>`;
  }finally{
    $("#loading").style.display="none";
  }
}

/* ===== Config Dialog (sin editar archivos) ===== */
function openConfigDialog(){
  const cfg = getConfig();
  $("#cfgApi").value = cfg.API_BASE_DEFAULT || "";
  $("#cfgWa").value = cfg.WHATSAPP_NUMBER || "";
  $("#cfgName").value = cfg.APP_NAME || "";
  $("#cfgCur").value = cfg.CURRENCY || "Lps.";
  $("#cfgBackdrop").style.display="flex";
  document.body.style.overflow="hidden";
}
function closeConfigDialog(){
  $("#cfgBackdrop").style.display="none";
  document.body.style.overflow="";
}
function saveConfigFromDialog(){
  const next = setConfig({
    API_BASE_DEFAULT: $("#cfgApi").value.trim(),
    WHATSAPP_NUMBER: $("#cfgWa").value.trim(),
    APP_NAME: $("#cfgName").value.trim(),
    CURRENCY: $("#cfgCur").value.trim() || "Lps."
  });
  toast("Configuración guardada");
  closeConfigDialog();
  // refresh brand without reload
  $("#brandName").textContent = next.APP_NAME;
  $("#brandSub").textContent = "Pedidos por WhatsApp • " + (next.WHATSAPP_DISPLAY || "");
  $("#waTop").href = "https://wa.me/" + next.WHATSAPP_NUMBER;
}

/* ===== Admin (se carga en admin.html) ===== */
async function bootAdmin(){
  applyTheme();
  const cfg = getConfig();
  $("#brandName").textContent = cfg.APP_NAME;
  $("#brandSub").textContent = "Panel administrador";

  $("#themeBtn")?.addEventListener("click", toggleTheme);
  $("#storeBtn")?.addEventListener("click", ()=> location.href="index.html");
  $("#logoutBtn")?.addEventListener("click", ()=>{ localStorage.removeItem("SDCO_ADMIN_KEY"); toast("Sesión cerrada"); location.reload(); });

  // config panel
  $("#cfgApiA").value = cfg.API_BASE_DEFAULT || "";
  $("#cfgWaA").value = cfg.WHATSAPP_NUMBER || "";
  $("#cfgNameA").value = cfg.APP_NAME || "";
  $("#cfgCurA").value = cfg.CURRENCY || "Lps.";
  $("#cfgSaveA")?.addEventListener("click", ()=>{
    setConfig({
      API_BASE_DEFAULT: $("#cfgApiA").value.trim(),
      WHATSAPP_NUMBER: $("#cfgWaA").value.trim(),
      APP_NAME: $("#cfgNameA").value.trim(),
      CURRENCY: $("#cfgCurA").value.trim() || "Lps."
    });
    toast("Configuración guardada");
  });

  const key = localStorage.getItem("SDCO_ADMIN_KEY");
  if(!key){
    $("#loginBox").style.display="block";
    $("#loginBtn").addEventListener("click", ()=>{
      const k = $("#adminKey").value.trim();
      if(!k) return toast("Escribe tu clave");
      localStorage.setItem("SDCO_ADMIN_KEY", k);
      location.reload();
    });
    return;
  }

  $("#loginBox").style.display="none";
  $("#adminUI").style.display="block";

  $("#reloadBtn")?.addEventListener("click", ()=>loadAdminList());
  $("#newBtn")?.addEventListener("click", ()=>openEditor(null));
  $("#saveBtn")?.addEventListener("click", ()=>saveEditor());
  $("#delBtn")?.addEventListener("click", ()=>deleteEditor());
  $("#closeEdit")?.addEventListener("click", ()=>closeEditor());
  $("#imgAddBtn")?.addEventListener("click", ()=>addGalleryField());
  $("#imgUpload")?.addEventListener("change", (e)=>uploadFiles(e.target.files));

  $("#aq")?.addEventListener("input", ()=>renderAdminTable());
  $("#afCat")?.addEventListener("change", ()=>renderAdminTable());
  $("#afActive")?.addEventListener("change", ()=>renderAdminTable());

  await loadAdminList();
}

let ADMIN = { all:[], view:[], cats:[], editing:null };

async function loadAdminList(){
  try{
    $("#aloading").style.display="inline-flex";
    const list = await apiGetProducts();
    ADMIN.all = (list||[]).map(p => {
      const stock = Number(p.stock ?? 0);
      return Object.assign({}, p, {
        id: String(p.id ?? crypto.randomUUID()),
        nombre: String(p.nombre ?? "Producto"),
        categoria: String(p.categoria ?? "Otros"),
        subcategoria: String(p.subcategoria ?? "General"),
        precio: p.precio ?? "",
        stock: isFinite(stock)?stock:0,
        activo: (String(p.activo ?? "1")==="1" || String(p.activo ?? "").toLowerCase()==="true"),
        img: p.img ?? "",
        descripcion: p.descripcion ?? ""
      });
    });

    // filters options
    const cats = ["Todas", ...Array.from(new Set(ADMIN.all.map(x=>x.categoria))).sort((a,b)=>a.localeCompare(b,"es"))];
    ADMIN.cats = cats;
    $("#afCat").innerHTML = cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");

    renderAdminTable();
    toast("Productos cargados");
  }catch(e){
    console.error(e);
    toast("Error cargando productos");
    $("#atable").innerHTML = `<tr><td colspan="6">No se pudo cargar: ${escapeHtml(String(e.message||e))}</td></tr>`;
  }finally{
    $("#aloading").style.display="none";
  }
}

function renderAdminTable(){
  const q = ($("#aq").value||"").trim().toLowerCase();
  const cat = $("#afCat").value || "Todas";
  const act = $("#afActive").value || "todos";

  let items = [...ADMIN.all];
  if(cat!=="Todas") items = items.filter(x=>x.categoria===cat);
  if(act==="activos") items = items.filter(x=>String(x.activo)===String(true));
  if(act==="inactivos") items = items.filter(x=>!x.activo);
  if(q) items = items.filter(x =>
    String(x.nombre||"").toLowerCase().includes(q) ||
    String(x.descripcion||"").toLowerCase().includes(q) ||
    String(x.categoria||"").toLowerCase().includes(q) ||
    String(x.subcategoria||"").toLowerCase().includes(q)
  );

  ADMIN.view = items;

  const cfg = getConfig();
  const tbody = $("#atable");
  tbody.innerHTML = items.map(p=>{
    const priceText = (p.precio==="" || p.precio===null || p.precio===undefined) ? "Consultar" : fmtMoney(p.precio, cfg.CURRENCY, cfg.LOCALE);
    return `
      <tr>
        <td><strong>${escapeHtml(p.nombre)}</strong><br><small>${escapeHtml(p.categoria)} • ${escapeHtml(p.subcategoria)}</small></td>
        <td>${escapeHtml(priceText)}</td>
        <td>${escapeHtml(String(p.stock||0))}</td>
        <td>${p.activo ? "<span class='badge ok'>Activo</span>" : "<span class='badge bad'>Inactivo</span>"}</td>
        <td class="tr-actions">
          <button class="btn" data-edit="${escapeHtml(p.id)}">Editar</button>
        </td>
      </tr>
    `;
  }).join("");

  $$("[data-edit]", tbody).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const p = ADMIN.all.find(x=>x.id===btn.dataset.edit);
      openEditor(p);
    });
  });
}

/* ===== Editor ===== */
function openEditor(p){
  ADMIN.editing = p ? JSON.parse(JSON.stringify(p)) : {
    id: crypto.randomUUID(),
    nombre:"",
    categoria:"Otros",
    subcategoria:"General",
    marca:"",
    precio:"",
    stock: 1,
    activo: true,
    descripcion:"",
    img:"",
    video_url:"",
    galeria_1:"",
    galeria_2:"",
    galeria_3:"",
    galeria_4:"",
    galeria_5:"",
    galeria_6:"",
    galeria_7:"",
    galeria_8:""
  };

  $("#eid").value = ADMIN.editing.id;
  $("#enombre").value = ADMIN.editing.nombre || "";
  $("#ecat").value = ADMIN.editing.categoria || "Otros";
  $("#esub").value = ADMIN.editing.subcategoria || "General";
  $("#emarca").value = ADMIN.editing.marca || "";
  $("#eprecio").value = ADMIN.editing.precio ?? "";
  $("#estock").value = ADMIN.editing.stock ?? 0;
  $("#eactivo").checked = !!ADMIN.editing.activo;
  $("#edesc").value = ADMIN.editing.descripcion || "";
  $("#eimg").value = ADMIN.editing.img || "";
  $("#evideo").value = ADMIN.editing.video_url || "";

  // gallery
  const g = $("#galleryFields");
  g.innerHTML = "";
  for(let i=1;i<=8;i++){
    const k = "galeria_"+i;
    const val = ADMIN.editing[k] || "";
    g.insertAdjacentHTML("beforeend", galleryFieldHtml(i, val));
  }
  bindGalleryButtons();

  $("#editorTitle").textContent = p ? "Editar producto" : "Nuevo producto";
  $("#delBtn").style.display = p ? "inline-flex" : "none";
  $("#editBackdrop").style.display="flex";
  document.body.style.overflow="hidden";
}

function closeEditor(){
  $("#editBackdrop").style.display="none";
  document.body.style.overflow="";
}

function galleryFieldHtml(i, val){
  return `
    <div class="kv" style="grid-template-columns:1fr auto; align-items:end; gap:8px">
      <div>
        <label>Galería ${i} (URL)</label>
        <input class="input" id="g${i}" placeholder="https://..." value="${escapeHtml(val)}">
      </div>
      <button class="btn" type="button" data-clear="g${i}">Borrar</button>
    </div>
  `;
}

function bindGalleryButtons(){
  $$("[data-clear]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.clear;
      const el = document.getElementById(id);
      if(el) el.value = "";
    });
  });
}

function readEditor(){
  const p = ADMIN.editing;
  p.id = $("#eid").value.trim();
  p.nombre = $("#enombre").value.trim();
  p.categoria = $("#ecat").value.trim();
  p.subcategoria = $("#esub").value.trim();
  p.marca = $("#emarca").value.trim();
  p.precio = $("#eprecio").value.trim();
  p.stock = Number($("#estock").value || 0);
  p.activo = $("#eactivo").checked ? 1 : 0;
  p.descripcion = $("#edesc").value.trim();
  p.img = $("#eimg").value.trim();
  p.video_url = $("#evideo").value.trim();
  for(let i=1;i<=8;i++){
    p["galeria_"+i] = (document.getElementById("g"+i).value||"").trim();
  }
  return p;
}

async function saveEditor(){
  try{
    const key = localStorage.getItem("SDCO_ADMIN_KEY");
    if(!key) return toast("Inicia sesión");
    const p = readEditor();

    if(!p.nombre) return toast("Falta el nombre");
    // Call backend action updateProduct (premium backend)
    const resp = await apiPost("updateProduct", { adminKey: key, product: p });
    if(resp && resp.ok){
      toast("Guardado");
      closeEditor();
      await loadAdminList();
    }else{
      throw new Error(resp?.error || "No se pudo guardar");
    }
  }catch(e){
    console.error(e);
    toast("Error: " + (e.message||e));
  }
}

async function deleteEditor(){
  try{
    const key = localStorage.getItem("SDCO_ADMIN_KEY");
    if(!key) return toast("Inicia sesión");
    const id = $("#eid").value.trim();
    if(!id) return toast("Sin ID");
    if(!confirm("¿Eliminar este producto?")) return;

    const resp = await apiPost("deleteProduct", { adminKey: key, id });
    if(resp && resp.ok){
      toast("Eliminado");
      closeEditor();
      await loadAdminList();
    }else{
      throw new Error(resp?.error || "No se pudo eliminar");
    }
  }catch(e){
    console.error(e);
    toast("Error: " + (e.message||e));
  }
}

/* ===== Image upload (opcional) =====
   Requiere que el backend tenga action=uploadImage (lo incluyo en el archivo Code.gs).
*/
async function uploadFiles(files){
  const key = localStorage.getItem("SDCO_ADMIN_KEY");
  if(!key) return toast("Inicia sesión");
  if(!files || !files.length) return;

  toast("Subiendo imagen...");
  for(const file of files){
    const b64 = await fileToBase64(file, 1400, 0.86);
    try{
      const resp = await apiPost("uploadImage", { adminKey:key, filename:file.name, contentType:file.type||"image/jpeg", base64:b64 });
      if(resp?.ok && resp.url){
        // Put into first empty field (main image first)
        const main = $("#eimg");
        if(main && !main.value){
          main.value = resp.url;
        }else{
          for(let i=1;i<=8;i++){
            const el = document.getElementById("g"+i);
            if(el && !el.value){
              el.value = resp.url;
              break;
            }
          }
        }
        toast("Imagen subida");
      }else{
        throw new Error(resp?.error || "upload falló");
      }
    }catch(e){
      console.error(e);
      toast("No se pudo subir. Pega una URL.");
      break;
    }
  }
}

function fileToBase64(file, maxSize=1400, quality=0.86){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const fr = new FileReader();
    fr.onload = ()=>{ img.src = fr.result; };
    fr.onerror = reject;
    img.onload = ()=>{
      const canvas = document.createElement("canvas");
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxSize / Math.max(w,h));
      w = Math.round(w*scale); h = Math.round(h*scale);
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0,0,w,h);
      const out = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      resolve(out);
    };
    img.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ===== Router ===== */
window.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body.getAttribute("data-page");
  if(page==="admin") bootAdmin();
  else bootStore();
});
