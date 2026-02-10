/* SDComayagua – Frontend PRO (Tienda + Admin) */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

/* ---------------- Image fallback ---------------- */
const IMG_FALLBACK = "assets/placeholder.svg";
function isProbablyUrl(u){
  if(!u) return false;
  const s = String(u).trim();
  if(!s) return false;
  // allow http(s) and data and relative paths
  return /^https?:\/\//i.test(s) || /^data:image\//i.test(s) || s.startsWith("assets/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("/");
}
function applyImgFallback(rootEl=document){
  const imgs = rootEl.querySelectorAll("img[data-fallback]");
  imgs.forEach(img=>{
    if(img.dataset.bound) return;
    img.dataset.bound = "1";
    img.addEventListener("error", ()=>{
      const fb = img.getAttribute("data-fallback") || IMG_FALLBACK;
      if(img.src.includes(fb)) return;
      img.src = fb;
      img.classList.add("img-fallback");
    });
  });
}

/* ---------------- Config + Theme ---------------- */
function getConfig(){
  const base = (window.SDCO_DEFAULTS || {});
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem("SDCO_CFG")||"null"); }catch{}
  return { ...base, ...(saved||{}) };
}
function apiBase(){
  const cfg = getConfig();
  return (cfg.API_BASE || cfg.API_BASE_DEFAULT || "").trim();
}
function applyTheme(theme){
  const cfg = getConfig();
  const t = theme || localStorage.getItem("SDCO_THEME") || cfg.THEME_DEFAULT || "light";
  document.body.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  const icon = $(".themeIcon");
  if(icon) icon.textContent = (t === "dark") ? "☀️" : "🌙";
  localStorage.setItem("SDCO_THEME", t);
}
function toggleTheme(){
  const cur = document.body.getAttribute("data-theme") || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
}

/* ---------------- UI helpers ---------------- */
function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> t.style.display="none", 2200);
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function fmtMoney(n){
  const cfg = getConfig();
  const cur = cfg.CURRENCY || "Lps.";
  const val = Number(n || 0);
  return `${cur} ${val.toLocaleString(cfg.LOCALE || "es-HN")}`;
}
async function fetchJSON(url, opts){
  const res = await fetch(url, opts);
  const txt = await res.text();
  let json = null;
  try{ json = JSON.parse(txt); }catch{}
  if(!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  if(json === null) throw new Error("Respuesta no-JSON del backend");
  return json;
}
function shareIcon(){
  return `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.2 4.11a3 3 0 0 0-1.97-.72 3 3 0 1 0 1.97 5.28l7.2 4.11a3 3 0 0 0-.17 1 3 3 0 1 0 3-3 2.99 2.99 0 0 0-1.97.72l-7.2-4.11a3 3 0 0 0 0-2l7.2-4.11A2.99 2.99 0 0 0 18 8Z" fill="currentColor"/>
  </svg>`;
}

/* ---------------- Data: products ---------------- */
function cryptoId(){
  try{
    return crypto.getRandomValues(new Uint32Array(2)).join("-");
  }catch{
    return String(Date.now()) + "-" + Math.floor(Math.random()*1e9);
  }
}
function parseOffer(ofertas_json, basePrice){
  if(!ofertas_json) return null;
  let obj = null;
  try{
    obj = typeof ofertas_json === "string" ? JSON.parse(ofertas_json) : ofertas_json;
  }catch{ return null; }
  if(!obj || typeof obj !== "object") return null;

  const badge = String(obj.badge || obj.tag || "OFERTA").toUpperCase();
  const percent = Number(obj.percent ?? obj.descuento ?? NaN);
  const precio_oferta = Number(obj.precio_oferta ?? obj.price ?? NaN);
  let finalPrice = null;

  if(Number.isFinite(precio_oferta) && precio_oferta > 0){
    finalPrice = precio_oferta;
  }else if(Number.isFinite(percent) && percent > 0 && percent < 100){
    finalPrice = Math.max(0, Math.round(Number(basePrice || 0) * (1 - percent/100)));
  }

  if(finalPrice === null) return null;

  return { badge, percent: Number.isFinite(percent)?percent:null, precio_oferta: Number.isFinite(precio_oferta)?precio_oferta:null, finalPrice };
}
function normalizeProd(p){
  const stock = Number(p.stock ?? 0);
  const active = (String(p.activo ?? "1").trim() !== "0");
  const basePrice = Number(p.precio ?? 0);
  const imgs = [];
  if(p.img) imgs.push(String(p.img).trim());
  for(let i=1;i<=8;i++){
    const k = `galeria_${i}`;
    if(p[k]) imgs.push(String(p[k]).trim());
  }
  const uniqueImgs = Array.from(new Set(imgs.filter(Boolean)));
  const offer = parseOffer(p.ofertas_json, basePrice);

  return {
    raw: p,
    id: String(p.id ?? "").trim() || cryptoId(),
    nombre: String(p.nombre || "").trim() || "Producto",
    categoria: String(p.categoria || "").trim() || "Sin categoría",
    subcategoria: String(p.subcategoria || "").trim(),
    marca: String(p.marca || "").trim(),
    precio_base: Number.isFinite(basePrice) ? basePrice : 0,
    precio_final: offer ? offer.finalPrice : (Number.isFinite(basePrice)?basePrice:0),
    offer,
    stock: Number.isFinite(stock) ? stock : 0,
    activo: !!active,
    descripcion: String(p.descripcion || "").trim(),
    imgs: uniqueImgs.length ? uniqueImgs : ["https://via.placeholder.com/800x600?text=Producto"],
    video_url: String(p.video_url || "").trim(),
    ofertas_json: String(p.ofertas_json || "").trim(),
    // keep gallery fields for admin editing
    img: String(p.img || "").trim(),
    ...Object.fromEntries(Array.from({length:8}, (_,i)=>[`galeria_${i+1}`, String(p[`galeria_${i+1}`]||"").trim()])),
  };
}
async function fetchProducts(){
  const base = apiBase();
  if(!base) throw new Error("API_BASE vacío (assets/config.js)");
  const url = `${base}?only=productos`;
  const json = await fetchJSON(url);
  return Array.isArray(json.productos) ? json.productos : [];
}
function buildCatalog(products){
  const list = products.map(normalizeProd).filter(p=>p.activo);
  const cats = new Map(); // cat -> {count, subs: Map}
  for(const p of list){
    const c = p.categoria || "Sin categoría";
    if(!cats.has(c)) cats.set(c, {count:0, subs:new Map()});
    const obj = cats.get(c);
    obj.count++;
    if(p.subcategoria){
      obj.subs.set(p.subcategoria, (obj.subs.get(p.subcategoria)||0)+1);
    }
  }
  return { list, cats };
}

/* ---------------- Store ---------------- */
function storeInit(){
  const els = {
    qTop: $("#qHome"),
    clearSearch: $("#clearSearch"),
    q: $("#q"),
    sort: $("#sort"),
    catTitle: $("#catTitle"),
    countMeta: $("#countMeta"),
    grid: $("#grid"),
    empty: $("#empty"),
    pills: $("#subPills"),
    catsBtn: $("#catsBtn"),
    goCats: $("#goCats"),
    goAll: $("#goAll"),
    adminBtn: $("#adminBtn"),
    themeBtn: $("#themeBtn"),
    quickChips: $("#quickChips"),

    backdrop: $("#backdrop"),
    closeModal: $("#closeModal"),
    mTitle: $("#mTitle"),
    mSub: $("#mSub"),
    mMainImg: $("#mMainImg"),
    mThumbs: $("#mThumbs"),
    mPrice: $("#mPrice"),
    mOldPrice: $("#mOldPrice"),
    mStock: $("#mStock"),
    mBadges: $("#mBadges"),
    mDesc: $("#mDesc"),
    mWA: $("#mWA"),
    mShare: $("#mShare"),
    mVideo: $("#mVideo"),

    catModal: $("#catModal"),
    catList: $("#catList"),
    closeCatModal: $("#closeCatModal"),
    fab: $("#fabWA"),
  };

  const state = {
    all: [],
    view: [],
    cats: new Map(),
    activeCat: "Todos",
    activeSub: "",
    q: "",
    sort: "relevancia",
    quick: "all" // all | instock | offers
  };

  function syncSearch(val){
    const v = String(val||"");
    state.q = v.trim().toLowerCase();
    if(els.qTop && els.qTop.value !== v) els.qTop.value = v;
    if(els.q && els.q.value !== v) els.q.value = v;
    if(els.clearSearch) els.clearSearch.style.display = state.q ? "block" : "none";
    apply();
  }

  function scoreRelevancia(p, q){
    if(!q) return 0;
    const name = p.nombre.toLowerCase();
    const desc = (p.descripcion||"").toLowerCase();
    let s = 0;
    if(name === q) s += 100;
    if(name.includes(q)) s += 40;
    if(desc.includes(q)) s += 10;
    for(const w of q.split(/\s+/).filter(Boolean)){
      if(name.includes(w)) s += 12;
      if(desc.includes(w)) s += 4;
    }
    return s;
  }

  function apply(){
    const q = state.q;
    let items = [...state.all];

    // Quick chips
    if(state.quick === "instock") items = items.filter(p=>p.stock > 0);
    if(state.quick === "offers") items = items.filter(p=>!!p.offer);

    // Category
    if(state.activeCat !== "Todos") items = items.filter(p=>p.categoria === state.activeCat);
    // Subcategory
    if(state.activeSub) items = items.filter(p=>p.subcategoria === state.activeSub);

    // Search
    if(q){
      items = items.filter(p=>{
        const t = (p.nombre+" "+p.categoria+" "+p.subcategoria+" "+(p.descripcion||"")).toLowerCase();
        return t.includes(q);
      });
    }

    // Sort
    const s = state.sort;
    if(s === "precio_asc") items.sort((a,b)=> (a.precio_final||0)-(b.precio_final||0));
    else if(s === "precio_desc") items.sort((a,b)=> (b.precio_final||0)-(a.precio_final||0));
    else if(s === "stock_desc") items.sort((a,b)=> (b.stock||0)-(a.stock||0));
    else{
      if(q) items.sort((a,b)=> scoreRelevancia(b,q)-scoreRelevancia(a,q));
      else items.sort((a,b)=> (b.stock||0)-(a.stock||0) || a.nombre.localeCompare(b.nombre,"es"));
    }

    // agotados al final
    items.sort((a,b)=> (b.stock>0)-(a.stock>0));

    state.view = items;
    render();
  }

  function buildWA(p){
    const wa = getConfig().WHATSAPP_NUMBER || "50431517755";
    const priceText = fmtMoney(p.precio_final);
    const url = new URL(location.href);
    url.hash = `p=${encodeURIComponent(p.id)}`;
    const stockText = (p.stock>0) ? String(p.stock) : "Agotado";
    const catText = `${p.categoria}${p.subcategoria ? " / " + p.subcategoria : ""}`;
    const msg =
`¡Hola! 👋

Quiero comprar este producto de SD-Comayagua:

• Producto: ${p.nombre}
• Precio: ${priceText}
• Stock: ${stockText}
• Categoría: ${catText}

Link del producto: ${url.toString()}

¿Me confirmás disponibilidad y el tiempo de entrega? Gracias 😊`;
    return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
  }

  function shareProduct(p){
    const url = new URL(location.href);
    url.hash = `p=${encodeURIComponent(p.id)}`;
    const shareData = { title: p.nombre, text: `Mirá: ${p.nombre} – ${fmtMoney(p.precio_final)}`, url: url.toString() };
    if(navigator.share){
      navigator.share(shareData).catch(()=>{});
    }else{
      navigator.clipboard?.writeText(url.toString())
        .then(()=>toast("Link copiado ✅"))
        .catch(()=>toast("No se pudo copiar el link"));
    }
  }

  function openModal(p){
    if(!els.backdrop) return;

    els.mTitle.textContent = p.nombre;
    els.mSub.textContent = `${p.categoria}${p.subcategoria ? " • " + p.subcategoria : ""}`;

    els.mPrice.textContent = fmtMoney(p.precio_final);
    if(p.offer && p.precio_final !== p.precio_base){
      els.mOldPrice.style.display = "block";
      els.mOldPrice.textContent = fmtMoney(p.precio_base);
    }else{
      els.mOldPrice.style.display = "none";
    }

    // badges
    els.mBadges.innerHTML = "";
    if(p.offer){
      els.mBadges.innerHTML += `<div class="badge offer">${escapeHtml(p.offer.badge)}</div>`;
    }
    if(p.stock <= 0){
      els.mBadges.innerHTML += `<div class="badge out">Agotado</div>`;
    }

    // stock line
    if(p.stock > 0) {
      els.mStock.textContent = `Stock disponible: ${p.stock}`;
      els.mStock.style.color = "";
    } else {
      els.mStock.textContent = "Sin stock por ahora";
      els.mStock.style.color = "";
    }

    els.mDesc.textContent = p.descripcion || "Sin descripción.";

    els.mWA.href = buildWA(p);
    els.mWA.toggleAttribute("disabled", p.stock <= 0);
    if(p.stock <= 0){
      els.mWA.classList.add("disabled");
      els.mWA.style.pointerEvents = "none";
      els.mWA.style.opacity = ".6";
    }else{
      els.mWA.classList.remove("disabled");
      els.mWA.style.pointerEvents = "";
      els.mWA.style.opacity = "";
    }

    // share
    if(els.mShare){
      const iconWrap = $(".iconwrap", els.mShare);
      if(iconWrap) iconWrap.innerHTML = shareIcon();
      els.mShare.onclick = ()=> shareProduct(p);
    }

    // video
    if(els.mVideo){
      if(p.video_url){
        els.mVideo.href = p.video_url;
        els.mVideo.style.display = "inline-flex";
      }else{
        els.mVideo.style.display = "none";
      }
    }

    // gallery
    const imgs = (p.imgs || []).filter(Boolean);
    const first = imgs[0] && isProbablyUrl(imgs[0]) ? imgs[0] : IMG_FALLBACK;
    els.mMainImg.src = first;
    els.mMainImg.setAttribute("data-fallback", IMG_FALLBACK);
    els.mMainImg.alt = p.nombre;

    els.mThumbs.innerHTML = imgs.map((src, i)=>`
      <button class="thumb ${i===0?"active":""}" data-src="${encodeURIComponent(src)}" type="button" title="Ver imagen">
        <img src="${src}" data-fallback="${IMG_FALLBACK}" alt="thumb">
      </button>
    `).join("");

    applyImgFallback(els.mThumbs);
    applyImgFallback(els.backdrop);

    $$(".thumb", els.mThumbs).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const src = decodeURIComponent(btn.getAttribute("data-src"));
        els.mMainImg.src = isProbablyUrl(src) ? src : IMG_FALLBACK;
        $$(".thumb", els.mThumbs).forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    els.backdrop.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal(){
    if(!els.backdrop) return;
    els.backdrop.style.display = "none";
    document.body.style.overflow = "";
  }

  function openCatModal(){
    els.catModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  function closeCatModal(){
    els.catModal.style.display = "none";
    document.body.style.overflow = "";
  }

  function renderChips(){
    if(!els.quickChips) return;
    const chips = [
      {k:"all", t:"Todo"},
      {k:"instock", t:"Con stock"},
      {k:"offers", t:"Ofertas"},
    ];
    els.quickChips.innerHTML = chips.map(c=>`
      <button class="chip ${state.quick===c.k?"active":""}" data-k="${c.k}" type="button">${c.t}</button>
    `).join("");
    $$(".chip", els.quickChips).forEach(b=>{
      b.addEventListener("click", ()=>{
        state.quick = b.getAttribute("data-k");
        renderChips();
        apply();
      });
    });
  }

  function renderCatModal(){
    const entries = Array.from(state.cats.entries())
      .sort((a,b)=> b[1].count-a[1].count || a[0].localeCompare(b[0],"es"));

    const items = [
      {name:"Todos", count: state.all.length}
      ,...entries.map(([name, info])=>({name, count: info.count}))
    ];
    els.catList.innerHTML = items.map(o=>{
      const active = (o.name==="Todos" && state.activeCat==="Todos") || (o.name===state.activeCat);
      return `<button class="catCard" data-cat="${encodeURIComponent(o.name)}" type="button">
        <span>${escapeHtml(o.name)}</span>
        <span class="count">${o.count}</span>
      </button>`;
    }).join("");

    $$(".catCard", els.catList).forEach(b=>{
      b.addEventListener("click", ()=>{
        const v = decodeURIComponent(b.getAttribute("data-cat"));
        state.activeCat = v;
        state.activeSub = "";
        closeCatModal();
        apply();
      });
    });
  }

  function renderPills(){
    if(!els.pills) return;
    let subs = [];
    if(state.activeCat !== "Todos"){
      const info = state.cats.get(state.activeCat);
      if(info){
        subs = Array.from(info.subs.entries())
          .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0],"es"))
          .map(([name, count])=>({name, count}));
      }
    }
    const show = subs.length > 0;
    els.pills.style.display = show ? "flex" : "none";
    if(!show) return;

    els.pills.innerHTML = [
      {name:"Todo", count: state.cats.get(state.activeCat)?.count || 0, all:true},
      ...subs
    ].map(o=>{
      const active = (o.all && !state.activeSub) || (!o.all && state.activeSub===o.name);
      return `<button class="pill ${active?"active":""}" data-sub="${encodeURIComponent(o.all?"":o.name)}" type="button">
        ${escapeHtml(o.name)} <span class="small">(${o.count})</span>
      </button>`;
    }).join("");

    $$(".pill", els.pills).forEach(b=>{
      b.addEventListener("click", ()=>{
        state.activeSub = decodeURIComponent(b.getAttribute("data-sub")||"");
        apply();
      });
    });
  }

  function render(){
    // title + count
    const base = state.activeCat === "Todos" ? "Todos los productos" : state.activeCat;
    const sub = state.activeSub ? ` — ${state.activeSub}` : "";
    els.catTitle.textContent = base + sub;

    const total = state.all.length;
    const shown = state.view.length;
    if(els.countMeta){
      let extra = "";
      if(state.quick === "instock") extra = " • Con stock";
      if(state.quick === "offers") extra = " • Ofertas";
      els.countMeta.textContent = `Mostrando ${shown} de ${total}${extra}`;
    }

    renderPills();

    // grid
    const items = state.view;
    if(!items.length){
      els.grid.innerHTML = "";
      els.empty.style.display = "block";
      return;
    }
    els.empty.style.display = "none";

    els.grid.innerHTML = items.map(p=>{
      const agotado = p.stock <= 0;
      const imgRaw = p.imgs?.[0] || "";
      const img = isProbablyUrl(imgRaw) ? imgRaw : IMG_FALLBACK;

      const badges = [
        p.offer ? `<div class="badge offer">${escapeHtml(p.offer.badge)}</div>` : "",
        agotado ? `<div class="badge out">Agotado</div>` : ""
      ].join("");

      const price = fmtMoney(p.precio_final);
      const old = (p.offer && p.precio_final !== p.precio_base)
        ? `<div class="oldPrice">${fmtMoney(p.precio_base)}</div>`
        : "";

      const stockClass = agotado ? "bad" : "good";
      const stockText = agotado ? "Sin stock" : `Stock: ${p.stock}`;

      return `
        <article class="card" data-id="${encodeURIComponent(p.id)}">
          <button class="card-media" data-open="1" type="button" aria-label="Ver ${escapeHtml(p.nombre)}">
            <img loading="lazy" src="${img}" data-fallback="${IMG_FALLBACK}" alt="${escapeHtml(p.nombre)}">
            ${badges}
          </button>

          <div class="card-body">
            <h4 class="card-title">${escapeHtml(p.nombre)}</h4>
            <div class="priceRow">
              <div class="price">${price}</div>
              ${old}
            </div>
            <div class="stock ${stockClass}">${stockText}</div>
          </div>

          <div class="card-actions">
            <a class="btn primary" ${agotado ? "aria-disabled='true' style='pointer-events:none;opacity:.6'" : ""} href="${buildWA(p)}" target="_blank" rel="noopener">Comprar</a>
            <button class="btn icon iconbtn" data-share="1" type="button" title="Compartir" aria-label="Compartir">
              ${shareIcon()}
            </button>
          </div>
        </article>
      `;
    }).join("");

    applyImgFallback(els.grid);

    // events
    $$(".card [data-open='1']", els.grid).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = decodeURIComponent(btn.closest(".card").getAttribute("data-id"));
        const p = state.all.find(x=>x.id===id);
        if(p) openModal(p);
      });
    });
    $$(".card [data-share='1']", els.grid).forEach(btn=>{
      btn.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        const id = decodeURIComponent(btn.closest(".card").getAttribute("data-id"));
        const p = state.all.find(x=>x.id===id);
        if(p) shareProduct(p);
      });
    });
  }

  function routeFromHash(){
    const h = location.hash || "";
    const m = h.match(/p=([^&]+)/);
    if(m){
      const id = decodeURIComponent(m[1]);
      const p = state.all.find(x=>x.id===id);
      if(p) openModal(p);
    }
  }

  async function boot(){
    applyTheme(); // set theme early
    els.themeBtn?.addEventListener("click", toggleTheme);

    const cfg = getConfig();
    if(els.fab){
      const wa = cfg.WHATSAPP_NUMBER || "50431517755";
      els.fab.href = `https://wa.me/${wa}`;
    }

    try{
      const raw = await fetchProducts();
      const { list, cats } = buildCatalog(raw);
      state.all = list;
      state.cats = cats;

      renderChips();
      renderCatModal();

      apply();
      routeFromHash();
    }catch(err){
      console.error(err);
      els.grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <div class="empty-title">No se pudieron cargar productos</div>
        <div class="small">Revisá tu API_BASE o el Apps Script. Error: ${escapeHtml(String(err.message||err))}</div>
      </div>`;
      els.countMeta.textContent = "Error";
    }
  }

  // listeners
  els.qTop?.addEventListener("input", e=> syncSearch(e.target.value));
  els.q?.addEventListener("input", e=> syncSearch(e.target.value));
  els.clearSearch?.addEventListener("click", ()=> syncSearch(""));

  els.sort?.addEventListener("change", e=>{ state.sort = e.target.value; apply(); });

  els.adminBtn?.addEventListener("click", ()=> location.href="admin.html");
  els.catsBtn?.addEventListener("click", openCatModal);
  els.goCats?.addEventListener("click", openCatModal);
  els.goAll?.addEventListener("click", ()=>{
    state.activeCat="Todos"; state.activeSub=""; state.quick="all";
    renderChips();
    renderCatModal();
    apply();
    toast("Mostrando todo");
  });

  els.closeModal?.addEventListener("click", closeModal);
  els.backdrop?.addEventListener("click", (e)=>{ if(e.target === els.backdrop) closeModal(); });
  els.closeCatModal?.addEventListener("click", ()=>closeCatModal());
  els.catModal?.addEventListener("click", (e)=>{ if(e.target === els.catModal) closeCatModal(); });

  window.addEventListener("keydown", (e)=>{
    if(e.key==="Escape"){
      closeModal();
      closeCatModal();
    }
  });
  window.addEventListener("hashchange", routeFromHash);

  boot();
}

/* ---------------- Admin ---------------- */
async function postUpdateProduct(adminKey, product){
  const base = apiBase();
  if(!base) throw new Error("API_BASE vacío");
  const payload = { action: "updateProduct", adminKey, product };

  // Try JSON body
  try{
    const json = await fetchJSON(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json;
  }catch(err){
    // fallback form-encoded
    const form = new URLSearchParams();
    form.set("action", "updateProduct");
    form.set("adminKey", adminKey);
    form.set("product", JSON.stringify(product));
    const json = await fetchJSON(base, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
    });
    return json;
  }
}

function adminInit(){
  applyTheme();
  $("#themeBtn")?.addEventListener("click", toggleTheme);

  const storeBtn = $("#storeBtn");
  const loginBox = $("#loginBox");
  const adminUI = $("#adminUI");
  const keyInput = $("#adminKey");
  const loginBtn = $("#loginBtn");
  const logoutBtn = $("#logoutBtn");
  const tableBody = $("#atable");
  const cardsWrap = $("#acards");
  const meta = $("#adminMeta");
  const aSearch = $("#aSearch");
  const aFilter = $("#aFilter");
  const newBtn = $("#newBtn");

  // modal
  const aModal = $("#aModal");
  const aClose = $("#aClose");
  const aTitle = $("#aTitle");
  const aSubtitle = $("#aSubtitle");
  const aForm = $("#aForm");
  const saveBtn = $("#saveBtn");
  const dupBtn = $("#dupBtn");
  const deactBtn = $("#deactBtn");
  const cancelBtn = $("#cancelBtn");

  let rawList = [];
  let list = [];
  let current = null;

  storeBtn?.addEventListener("click", ()=> location.href="index.html");

  function getKey(){ return localStorage.getItem("SDCO_ADMIN_KEY") || ""; }
  function setKey(v){ localStorage.setItem("SDCO_ADMIN_KEY", v); }

  function setLoggedIn(v){
    loginBox.style.display = v ? "none" : "block";
    adminUI.style.display = v ? "block" : "none";
  }

  function openEditor(p, mode="edit"){
    current = p;
    aTitle.textContent = mode === "new" ? "Nuevo producto" : "Editar producto";
    aSubtitle.textContent = p ? `ID: ${p.id}` : "";
    aModal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // default tabs
    setActiveTab("basic");

    // fill form
    const data = p || normalizeProd({ id: cryptoId(), activo: "1", stock: 0, precio: 0 });
    aForm.reset();
    for(const [k,v] of Object.entries(data)){
      const el = aForm.elements.namedItem(k);
      if(el) el.value = (v ?? "");
    }
    // ensure ofertas_json original string
    const o = aForm.elements.namedItem("ofertas_json");
    if(o) o.value = data.ofertas_json || "";

    // show/hide deactivate
    deactBtn.style.display = (mode === "new") ? "none" : "inline-flex";
  }

  function closeEditor(){
    aModal.style.display = "none";
    document.body.style.overflow = "";
    current = null;
  }

  function setActiveTab(tab){
    $$(".tab").forEach(b=> b.classList.toggle("active", b.getAttribute("data-tab")===tab));
    $$(".tabpane").forEach(p=> p.classList.toggle("active", p.getAttribute("data-pane")===tab));
  }

  $$(".tab").forEach(b=>{
    b.addEventListener("click", ()=> setActiveTab(b.getAttribute("data-tab")));
  });

  aClose?.addEventListener("click", closeEditor);
  cancelBtn?.addEventListener("click", closeEditor);
  aModal?.addEventListener("click", (e)=>{ if(e.target === aModal) closeEditor(); });
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeEditor(); });

  function filterList(){
    const q = (aSearch?.value || "").trim().toLowerCase();
    const f = (aFilter?.value || "all");
    let items = [...list];

    if(q){
      items = items.filter(p => (p.nombre+" "+p.categoria+" "+p.subcategoria).toLowerCase().includes(q));
    }
    if(f === "active") items = items.filter(p => p.activo);
    if(f === "inactive") items = items.filter(p => !p.activo);
    if(f === "instock") items = items.filter(p => p.stock > 0);
    if(f === "out") items = items.filter(p => p.stock <= 0);

    renderTable(items);
  }

  function renderTable(items){
    if(meta) meta.textContent = `Mostrando ${items.length} de ${list.length}`;

    // --- Móvil: tarjetas para evitar scroll horizontal ---
    if(cardsWrap){
      cardsWrap.innerHTML = items.map(p=>{
        const status = p.activo ? "Activo" : "Inactivo";
        const out = p.stock <= 0;
        const imgRaw = p.imgs?.[0] || "";
        const img = isProbablyUrl(imgRaw) ? imgRaw : IMG_FALLBACK;
        const price = fmtMoney(p.precio_final);
        const chipCls = p.activo ? "good" : "bad";
        return `
          <div class="acard" data-id="${encodeURIComponent(p.id)}">
            <div class="thumb"><img src="${img}" data-fallback="${IMG_FALLBACK}" alt=""></div>
            <div class="info">
              <div class="name">${escapeHtml(p.nombre)}</div>
              <div class="meta">${escapeHtml(p.categoria)}${p.subcategoria?" • "+escapeHtml(p.subcategoria):""}</div>
              <div class="row">
                <span class="chip">${price}</span>
                ${(p.offer && p.precio_final!==p.precio_base)?`<span class="chip" style="text-decoration:line-through;opacity:.7">${fmtMoney(p.precio_base)}</span>`:""}
                <span class="chip ${out?"bad":"good"}">${out?"Sin stock":"Stock: "+p.stock}</span>
                <span class="chip ${chipCls}">${status}</span>
              </div>
              <div class="actions">
                <button class="btn" data-act="edit" type="button">Editar</button>
                <button class="btn" data-act="dup" type="button">Duplicar</button>
                <button class="btn danger" data-act="deact" type="button">Desactivar</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
      applyImgFallback(cardsWrap);
      $$('button[data-act]', cardsWrap).forEach(b=>{
        b.addEventListener('click', async ()=>{
          const wrap = b.closest('.acard');
          const id = decodeURIComponent(wrap.getAttribute('data-id'));
          const p = list.find(x=>x.id===id);
          const act = b.getAttribute('data-act');
          if(!p) return;

          if(act === 'edit'){
            openEditor(p, 'edit');
          }else if(act === 'dup'){
            const clone = deepClone(p);
            clone.id = cryptoId();
            clone.nombre = `${clone.nombre} (copia)`;
            openEditor(clone, 'new');
          }else if(act === 'deact'){
            if(!confirm('¿Desactivar este producto? (Se ocultará en la tienda)')) return;
            await doDeactivate(p);
          }
        });
      });
    }

    // --- Desktop/PC: tabla ---
    if(!tableBody) return;

    tableBody.innerHTML = items.map(p=>{
      const status = p.activo ? "Activo" : "Inactivo";
      const out = p.stock <= 0;
      const imgRaw = p.imgs?.[0] || "";
      const img = isProbablyUrl(imgRaw) ? imgRaw : IMG_FALLBACK;
      const price = fmtMoney(p.precio_final);

      return `
        <tr data-id="${encodeURIComponent(p.id)}">
          <td>
            <div class="mini">
              <img src="${img}" data-fallback="${IMG_FALLBACK}" alt="">
              <div>
                <div style="font-weight:950">${escapeHtml(p.nombre)}</div>
                <div class="small">${escapeHtml(p.categoria)}${p.subcategoria? " • "+escapeHtml(p.subcategoria):""}</div>
              </div>
            </div>
          </td>
          <td>${price}${(p.offer && p.precio_final!==p.precio_base)?`<div class="small" style="text-decoration:line-through">${fmtMoney(p.precio_base)}</div>`:""}</td>
          <td>${p.stock}${out?` <span class="small" style="color:var(--bad)">• sin stock</span>`:""}</td>
          <td>${status}</td>
          <td>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" data-act="edit" type="button">Editar</button>
              <button class="btn" data-act="dup" type="button">Duplicar</button>
              <button class="btn danger" data-act="deact" type="button">Desactivar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    applyImgFallback(tableBody);

    $$("button[data-act]", tableBody).forEach(b=>{
      b.addEventListener("click", async ()=>{
        const tr = b.closest("tr");
        const id = decodeURIComponent(tr.getAttribute("data-id"));
        const p = list.find(x=>x.id===id);
        const act = b.getAttribute("data-act");
        if(!p) return;

        if(act === "edit"){
          openEditor(p, "edit");
        }else if(act === "dup"){
          const clone = deepClone(p);
          clone.id = cryptoId();
          clone.nombre = `${clone.nombre} (copia)`;
          openEditor(clone, "new");
        }else if(act === "deact"){
          if(!confirm("¿Desactivar este producto? (Se ocultará en la tienda)")) return;
          await doDeactivate(p);
        }
      });
    });
  }

  function deepClone(o){
    return JSON.parse(JSON.stringify(o));
  }

  function readForm(){
    const data = {};
    const fd = new FormData(aForm);
    for(const [k,v] of fd.entries()){
      data[k] = String(v ?? "");
    }
    // coerce
    data.precio = Number(data.precio || 0);
    data.stock = Number(data.stock || 0);
    data.activo = String(data.activo || "1");
    // ensure ID
    data.id = data.id || cryptoId();
    return data;
  }

  async function saveProduct(){
    const adminKey = getKey();
    if(!adminKey){ toast("Falta ADMIN_KEY"); return; }
    const data = readForm();

    // Basic validation
    if(!data.nombre.trim()){ toast("Nombre requerido"); return; }
    if(!data.categoria.trim()){ toast("Categoría requerida"); return; }

    // ofertas_json validate
    if(String(data.ofertas_json||"").trim()){
      try{ JSON.parse(String(data.ofertas_json)); }catch{ toast("ofertas_json inválido (JSON)"); return; }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try{
      const res = await postUpdateProduct(adminKey, data);
      if(res && res.ok){
        toast("Guardado ✅");
        closeEditor();
        await reload();
      }else{
        throw new Error(res?.error || "No se pudo guardar");
      }
    }catch(err){
      console.error(err);
      toast("Error: " + (err.message||err));
    }finally{
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  }

  async function doDeactivate(p){
    const adminKey = getKey();
    const data = deepClone(p.raw || p);
    data.activo = "0";
    try{
      const res = await postUpdateProduct(adminKey, data);
      if(res && res.ok){
        toast("Desactivado ✅");
        await reload();
      }else{
        throw new Error(res?.error || "No se pudo desactivar");
      }
    }catch(err){
      console.error(err);
      toast("Error: " + (err.message||err));
    }
  }

  async function reload(){
    if(meta) meta.textContent = "Cargando…";
    try{
      rawList = await fetchProducts();
      // Admin needs ALL, including inactive
      list = rawList.map(normalizeProd);
      filterList();
    }catch(err){
      console.error(err);
      if(meta) meta.textContent = "Error al cargar";
      tableBody.innerHTML = `<tr><td colspan="5" style="color:var(--bad)">Error: ${escapeHtml(String(err.message||err))}</td></tr>`;
    }
  }

  // Login
  loginBtn?.addEventListener("click", ()=>{
    const k = (keyInput?.value||"").trim();
    if(!k){ toast("Ingresá tu clave ADMIN"); return; }
    setKey(k);
    setLoggedIn(true);
    toast("Sesión iniciada ✅");
    reload();
  });

  logoutBtn?.addEventListener("click", ()=>{
    localStorage.removeItem("SDCO_ADMIN_KEY");
    toast("Sesión cerrada");
    setLoggedIn(false);
  });

  // Filters
  aSearch?.addEventListener("input", filterList);
  aFilter?.addEventListener("change", filterList);

  // New
  newBtn?.addEventListener("click", ()=>{
    openEditor(null, "new");
  });

  // Save form
  aForm?.addEventListener("submit", (e)=>{
    e.preventDefault();
    saveProduct();
  });

  dupBtn?.addEventListener("click", ()=>{
    const data = readForm();
    data.id = cryptoId();
    data.nombre = `${data.nombre} (copia)`;
    // update form
    for(const [k,v] of Object.entries(data)){
      const el = aForm.elements.namedItem(k);
      if(el) el.value = String(v ?? "");
    }
    toast("Copia lista — Guardá para crearla ✅");
  });

  deactBtn?.addEventListener("click", async ()=>{
    if(!current) return;
    if(!confirm("¿Desactivar este producto?")) return;
    await doDeactivate(current);
    closeEditor();
  });

  // init state
  if(keyInput) keyInput.value = getKey();
  const logged = !!getKey();
  setLoggedIn(logged);
  if(logged) reload();
}

/* ---------------- Boot ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // Theme early
  applyTheme();

  const page = document.body.getAttribute("data-page");
  if(page === "store") storeInit();
  if(page === "admin") adminInit();
});
