/* SDComayagua – Frontend (vanilla JS) */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

function getConfig(){
  const saved = (()=>{ try { return JSON.parse(localStorage.getItem("SDCO_CFG")||"null"); } catch{ return null; } })();
  const base = (window.SDCO_DEFAULTS || {});
  return { ...base, ...(saved||{}) };
}

function apiBase(){
  const cfg = getConfig();
  return (cfg.API_BASE || cfg.API_BASE_DEFAULT || "").trim();
}

function fmtMoney(n){
  const cfg = getConfig();
  const cur = cfg.CURRENCY || "Lps.";
  const val = Number(n || 0);
  return `${cur} ${val.toLocaleString(cfg.LOCALE || "es-HN")}`;
}

function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> t.style.display="none", 2200);
}

async function fetchJSON(url, opts){
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchProducts(){
  const base = apiBase();
  if(!base) throw new Error("API_BASE vacío");
  const url = `${base}?only=productos`;
  const json = await fetchJSON(url);
  return Array.isArray(json.productos) ? json.productos : [];
}

function normalizeProd(p){
  const cat = (p.categoria || "").trim();
  const sub = (p.subcategoria || "").trim();
  const stock = Number(p.stock ?? 0);
  const active = (String(p.activo ?? "1").trim() !== "0");
  const price = Number(p.precio ?? 0);
  const imgs = [];
  if(p.img) imgs.push(String(p.img).trim());
  for(let i=1;i<=8;i++){
    const k = `galeria_${i}`;
    if(p[k]) imgs.push(String(p[k]).trim());
  }
  const uniqueImgs = Array.from(new Set(imgs.filter(Boolean)));
  return {
    raw: p,
    id: String(p.id ?? "").trim() || cryptoRandomId(),
    nombre: String(p.nombre || "").trim() || "Producto",
    categoria: cat || "Sin categoría",
    subcategoria: sub || "",
    precio: isFinite(price) ? price : 0,
    stock: isFinite(stock) ? stock : 0,
    activo: !!active,
    descripcion: String(p.descripcion || "").trim(),
    imgs: uniqueImgs.length ? uniqueImgs : ["https://via.placeholder.com/800x600?text=Producto"],
    video_url: String(p.video_url || "").trim(),
  };
}

function cryptoRandomId(){
  try{
    return crypto.getRandomValues(new Uint32Array(2)).join("-");
  }catch{
    return String(Date.now()) + "-" + Math.floor(Math.random()*1e9);
  }
}

function buildCatalog(products){
  const list = products.map(normalizeProd)
    .filter(p => p.activo); // controla disponibilidad por "activo" + stock
  const cats = new Map(); // cat -> {count, subs: Map(sub->count)}
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
    q: $("#q"),
    sort: $("#sort"),
    catTitle: $("#catTitle"),
    grid: $("#grid"),
    empty: $("#empty"),
    pills: $("#subPills"),
    catsBtn: $("#catsBtn"),
    goCats: $("#goCats"),
    goAll: $("#goAll"),
    adminBtn: $("#adminBtn"),
    backdrop: $("#backdrop"),
    closeModal: $("#closeModal"),
    mTitle: $("#mTitle"),
    mSub: $("#mSub"),
    mMainImg: $("#mMainImg"),
    mThumbs: $("#mThumbs"),
    mPrice: $("#mPrice"),
    mDesc: $("#mDesc"),
    mWA: $("#mWA"),
    mVideo: $("#mVideo"),
    catModal: $("#catModal"),
    catList: $("#catList"),
    closeCatModal: $("#closeCatModal"),
  };

  const state = {
    all: [],
    view: [],
    cats: new Map(),
    activeCat: "Todos",
    activeSub: "",
    q: "",
    sort: "relevancia",
  };

  function syncSearch(val){
    state.q = (val||"").trim().toLowerCase();
    if(els.qTop && els.qTop.value !== val) els.qTop.value = val;
    if(els.q && els.q.value !== val) els.q.value = val;
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
    // bonus por match de palabras
    for(const w of q.split(/\s+/).filter(Boolean)){
      if(name.includes(w)) s += 12;
      if(desc.includes(w)) s += 4;
    }
    return s;
  }

  function apply(){
    const q = state.q;
    let items = [...state.all];

    // filtro categoría
    if(state.activeCat !== "Todos"){
      items = items.filter(p => p.categoria === state.activeCat);
    }
    // filtro subcategoría
    if(state.activeSub){
      items = items.filter(p => p.subcategoria === state.activeSub);
    }
    // filtro por búsqueda
    if(q){
      items = items.filter(p=>{
        const t = (p.nombre + " " + p.categoria + " " + p.subcategoria + " " + (p.descripcion||"")).toLowerCase();
        return t.includes(q);
      });
    }

    // sorting
    const s = state.sort;
    if(s === "precio_asc"){
      items.sort((a,b)=> (a.precio||0)-(b.precio||0));
    }else if(s === "precio_desc"){
      items.sort((a,b)=> (b.precio||0)-(a.precio||0));
    }else{
      // relevancia: si hay q, por score; si no, por stock desc y nombre
      if(q){
        items.sort((a,b)=> scoreRelevancia(b,q)-scoreRelevancia(a,q));
      }else{
        items.sort((a,b)=> (b.stock||0)-(a.stock||0) || a.nombre.localeCompare(b.nombre, "es"));
      }
    }

    // mueve agotados al final
    items.sort((a,b)=> (b.stock>0)-(a.stock>0));

    state.view = items;
    render();
  }

  function shareProduct(p){
    const url = new URL(location.href);
    url.hash = `p=${encodeURIComponent(p.id)}`;
    const shareData = { title: p.nombre, text: `Mirá: ${p.nombre} – ${fmtMoney(p.precio)}`, url: url.toString() };
    if(navigator.share){
      navigator.share(shareData).catch(()=>{});
    }else{
      navigator.clipboard?.writeText(url.toString()).then(()=>toast("Link copiado ✅")).catch(()=>toast("No se pudo copiar el link"));
    }
  }

  function openModal(p){
    if(!els.backdrop) return;

    els.mTitle.textContent = p.nombre;
    els.mSub.textContent = `${p.categoria}${p.subcategoria ? " • " + p.subcategoria : ""}`;
    els.mPrice.textContent = fmtMoney(p.precio);
    els.mDesc.textContent = p.descripcion || "Sin descripción.";

    const wa = getConfig().WHATSAPP_NUMBER || "50431517755";
    const msg = `Hola, quiero comprar: ${p.nombre} (${fmtMoney(p.precio)}).`;
    els.mWA.href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

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
    const imgs = p.imgs || [];
    let active = imgs[0];
    els.mMainImg.src = active;
    els.mThumbs.innerHTML = imgs.map((src, i)=>`
      <button class="thumb ${i===0?"active":""}" data-src="${encodeURIComponent(src)}" title="Ver imagen">
        <img src="${src}" alt="thumb">
      </button>
    `).join("");

    $$(".thumb", els.mThumbs).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const src = decodeURIComponent(btn.getAttribute("data-src"));
        els.mMainImg.src = src;
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

  function render(){
    // title
    if(els.catTitle){
      const base = state.activeCat === "Todos" ? "Todos los productos" : state.activeCat;
      const sub = state.activeSub ? ` — ${state.activeSub}` : "";
      els.catTitle.textContent = base + sub;
    }

    // pills (subcats)
    if(els.pills){
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
      if(show){
        els.pills.innerHTML = [
          {name:"Todo", count: state.cats.get(state.activeCat)?.count || 0, all:true},
          ...subs
        ].map(o=>{
          const active = (o.all && !state.activeSub) || (!o.all && state.activeSub===o.name);
          return `<button class="pill ${active?"active":""}" data-sub="${encodeURIComponent(o.all?"":o.name)}">
            ${o.name} <span class="small">(${o.count})</span>
          </button>`;
        }).join("");

        $$(".pill", els.pills).forEach(b=>{
          b.addEventListener("click", ()=>{
            state.activeSub = decodeURIComponent(b.getAttribute("data-sub")||"");
            apply();
          });
        });
      }
    }

    // grid
    if(!els.grid) return;
    const items = state.view;
    if(!items.length){
      els.grid.innerHTML = "";
      if(els.empty) els.empty.style.display = "block";
      return;
    }
    if(els.empty) els.empty.style.display = "none";

    els.grid.innerHTML = items.map(p=>{
      const agotado = p.stock <= 0;
      const badge = agotado ? `<div class="badge">Agotado</div>` : "";
      const img = p.imgs?.[0] || "https://via.placeholder.com/800x600?text=Producto";
      return `
        <article class="card" data-id="${encodeURIComponent(p.id)}">
          <button class="card-media" data-open="1" aria-label="Ver ${escapeHtml(p.nombre)}">
            <img loading="lazy" src="${img}" alt="${escapeHtml(p.nombre)}">
            ${badge}
          </button>
          <div class="card-body">
            <h4 class="card-title">${escapeHtml(p.nombre)}</h4>
            <div class="price">${fmtMoney(p.precio)}</div>
            <div class="stock">${agotado ? "Sin stock" : `Stock: ${p.stock}`}</div>
          </div>
          <div class="card-actions">
            <a class="btn primary" href="${buildWA(p)}" target="_blank" rel="noopener">Comprar</a>
            <button class="btn icon iconbtn" data-share="1" title="Compartir" aria-label="Compartir">
              ${shareIcon()}
            </button>
          </div>
        </article>
      `;
    }).join("");

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

  function buildWA(p){
    const wa = getConfig().WHATSAPP_NUMBER || "50431517755";
    const msg = `Hola, quiero comprar: ${p.nombre} (${fmtMoney(p.precio)}).`;
    return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
  }

  function openCatModal(){
    if(!els.catModal) return;
    els.catModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  function closeCatModal(){
    if(!els.catModal) return;
    els.catModal.style.display = "none";
    document.body.style.overflow = "";
  }

  function renderCatModal(){
    if(!els.catList) return;
    const entries = Array.from(state.cats.entries())
      .sort((a,b)=> b[1].count-a[1].count || a[0].localeCompare(b[0],"es"));
    els.catList.innerHTML = [
      `<button class="pill ${state.activeCat==="Todos"?"active":""}" data-cat="Todos">Todos <span class="small">(${state.all.length})</span></button>`,
      ...entries.map(([name, info])=>(
        `<button class="pill ${state.activeCat===name?"active":""}" data-cat="${encodeURIComponent(name)}">${escapeHtml(name)} <span class="small">(${info.count})</span></button>`
      ))
    ].join("");

    $$(".pill", els.catList).forEach(b=>{
      b.addEventListener("click", ()=>{
        const v = b.getAttribute("data-cat");
        state.activeCat = v === "Todos" ? "Todos" : decodeURIComponent(v);
        state.activeSub = "";
        closeCatModal();
        apply();
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
    // config on UI
    const cfg = getConfig();
    // set WA on fab
    const fab = $(".fab-wa");
    if(fab){
      const wa = cfg.WHATSAPP_NUMBER || "50431517755";
      fab.href = `https://wa.me/${wa}`;
    }

    try{
      const raw = await fetchProducts();
      const { list, cats } = buildCatalog(raw);
      state.all = list;
      state.cats = cats;

      renderCatModal();
      apply();
      routeFromHash();
    }catch(err){
      console.error(err);
      els.grid.innerHTML = `<div class="section" style="grid-column:1/-1">
        <b>No se pudieron cargar productos.</b>
        <div class="small">Revisá tu API_BASE o el Apps Script. Error: ${escapeHtml(String(err.message||err))}</div>
      </div>`;
    }
  }

  // listeners
  els.qTop?.addEventListener("input", e=> syncSearch(e.target.value));
  els.q?.addEventListener("input", e=> syncSearch(e.target.value));
  els.sort?.addEventListener("change", e=>{ state.sort = e.target.value; apply(); });

  els.adminBtn?.addEventListener("click", ()=> location.href="admin.html");
  els.catsBtn?.addEventListener("click", openCatModal);
  els.goCats?.addEventListener("click", openCatModal);
  els.goAll?.addEventListener("click", ()=>{
    state.activeCat="Todos"; state.activeSub=""; renderCatModal(); apply();
    toast("Mostrando todo");
  });

  els.closeModal?.addEventListener("click", closeModal);
  els.backdrop?.addEventListener("click", (e)=>{ if(e.target === els.backdrop) closeModal(); });
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape"){ closeModal(); closeCatModal(); } });

  els.closeCatModal?.addEventListener("click", closeCatModal);
  els.catModal?.addEventListener("click", (e)=>{ if(e.target === els.catModal) closeCatModal(); });

  window.addEventListener("hashchange", routeFromHash);

  boot();
}

/* ---------------- Admin (solo UI básico) ---------------- */
function adminInit(){
  const storeBtn = $("#storeBtn");
  const loginBox = $("#loginBox");
  const adminUI = $("#adminUI");
  const keyInput = $("#adminKey");
  const loginBtn = $("#loginBtn");
  const logoutBtn = $("#logoutBtn");
  const tableBody = $("#atable");

  storeBtn?.addEventListener("click", ()=> location.href="index.html");

  function setLoggedIn(v){
    if(v){
      loginBox.style.display="none";
      adminUI.style.display="block";
      toast("Sesión iniciada ✅");
      loadTable();
    }else{
      loginBox.style.display="block";
      adminUI.style.display="none";
    }
  }

  function getKey(){
    return localStorage.getItem("SDCO_ADMIN_KEY") || "";
  }

  function loadKeyToInput(){
    if(keyInput) keyInput.value = getKey();
  }

  async function loadTable(){
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" class="small">Cargando productos…</td></tr>`;
    try{
      const raw = await fetchProducts();
      const list = raw.map(normalizeProd);
      tableBody.innerHTML = list.map(p=>`
        <tr>
          <td>
            <div class="mini">
              <img src="${p.imgs?.[0]||"https://via.placeholder.com/80"}" alt="">
              <div>
                <div style="font-weight:850">${escapeHtml(p.nombre)}</div>
                <div class="small">${escapeHtml(p.categoria)}${p.subcategoria? " • "+escapeHtml(p.subcategoria):""}</div>
              </div>
            </div>
          </td>
          <td>${fmtMoney(p.precio)}</td>
          <td>${p.stock}</td>
          <td>${p.activo ? "Activo" : "Inactivo"}</td>
          <td class="small">Edición avanzada: en tu Apps Script (doPost) / panel premium</td>
        </tr>
      `).join("");
    }catch(err){
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="5" style="color:#b91c1c">Error: ${escapeHtml(String(err.message||err))}</td></tr>`;
    }
  }

  loginBtn?.addEventListener("click", ()=>{
    const k = (keyInput?.value||"").trim();
    if(!k){ toast("Ingresá tu clave ADMIN"); return; }
    localStorage.setItem("SDCO_ADMIN_KEY", k);
    setLoggedIn(true);
  });

  logoutBtn?.addEventListener("click", ()=>{
    localStorage.removeItem("SDCO_ADMIN_KEY");
    toast("Sesión cerrada");
    setLoggedIn(false);
  });

  loadKeyToInput();
  setLoggedIn(!!getKey());
}

/* ---------------- Utilities ---------------- */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function shareIcon(){
  return `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-7.2 4.11a3 3 0 0 0-1.97-.72 3 3 0 1 0 1.97 5.28l7.2 4.11a3 3 0 0 0-.17 1 3 3 0 1 0 3-3 2.99 2.99 0 0 0-1.97.72l-7.2-4.11a3 3 0 0 0 0-2l7.2-4.11A2.99 2.99 0 0 0 18 8Z" fill="currentColor"/>
  </svg>`;
}

document.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body.getAttribute("data-page");
  if(page === "store") storeInit();
  if(page === "admin") adminInit();
});