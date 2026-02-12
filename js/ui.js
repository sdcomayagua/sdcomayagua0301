(function(){
  const CFG = window.SDCO_CONFIG;
  const Api = window.SDCO_Api;
  const els = {};
  const state = {
    productos: [],
    taxonomia: [],
    loading: true,
    q: "",
    category: "all",
    theme: "dark"
  };
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }
  function norm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,""); }
  function fmtLps(n){const num=Number(n);if(!isFinite(num))return "";return CFG.CURRENCY+" "+new Intl.NumberFormat(CFG.LOCALE,{maximumFractionDigits:0}).format(num);}).format(num).replace("HNL", CFG.CURRENCY);
  }
  function isSeparator(p){
    const id = String(p.id||"");
    const name = String(p.nombre||"");
    return id.toUpperCase().startsWith("SEP_") || /^[-—–].*[-—–]$/.test(name.trim()) || name.includes("—");
  }
  function categoryEmoji(name){
    const n = norm(name);
    if (!n) return "🛍️";
    const rules = [
      ["gamer", "🎮"],
      ["pc", "🖥️"],
      ["comput", "🖥️"],
      ["móvil", "📱"],
      ["movil", "📱"],
      ["cel", "📱"],
      ["hogar", "🏠"],
      ["cocina", "🍳"],
      ["tecn", "💻"],
      ["veh", "🏍️"],
      ["moto", "🏍️"],
      ["auto", "🏍️"],
      ["power", "🔋"],
      ["bater", "🔋"],
      ["stream", "📺"],
      ["tv", "📺"]
    ];
    for (const [k, e] of rules){
      if (n.includes(k)) return e;
    }
    return "🛍️";
  }
  function toast(title, msg){
    let t = document.querySelector(".toast");
    if (!t){
      t = document.createElement("div");
      t.className = "toast";
      t.innerHTML = '<div class="toast__title" id="tTitle"></div><div class="toast__msg" id="tMsg"></div>';
      document.body.appendChild(t);
    }
    t.querySelector("#tTitle").textContent = title || "";
    t.querySelector("#tMsg").textContent = msg || "";
    t.classList.add("toast--show");
    clearTimeout(toast._id);
    toast._id = setTimeout(() => t.classList.remove("toast--show"), 2600);
  }
  function setStatus(visible, title, sub, canRetry){
    els.status.hidden = !visible;
    els.grid.hidden = visible;
    els.btnRetry.hidden = !canRetry;
    if (title) els.status.querySelector(".status__title").textContent = title;
    if (sub) $("#statusSub").textContent = sub;
  }
  function setTheme(theme){
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("SDCO_THEME", state.theme);
    // update icon (moon/sun-ish)
    const icon = $("#themeIcon");
    if (!icon) return;
    if (state.theme === "light"){
      icon.innerHTML = '<path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" fill="currentColor"/>';
    } else {
      icon.innerHTML = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor"/>';
    }
  }
  function getBaseUrl(){
    // GitHub Pages friendly: https://domain/repo/ + #p=ID
    const { origin, pathname } = window.location;
    return origin + pathname;
  }
  function productLink(id){
    return getBaseUrl() + "#p=" + encodeURIComponent(String(id));
  }
  function shareIconSvg(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 8a3 3 0 1 0-2.8-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 14a3 3 0 1 0 2.8 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 8.7 8 12.8m8.5 2.5L8 11.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function imgOrPlaceholder(url){
    const u = String(url || "").trim();
    return u ? u : CFG.DEFAULT_PLACEHOLDER;
  }
  function buildChips(){
    const chips = els.chips;
    chips.innerHTML = "";
    const items = [
      { key: "all", label: "Todo" }
    ];
    const cats = new Map();
    state.productos.forEach(p => {
      if (isSeparator(p)) return;
      const c = String(p.categoria||"").trim();
      if (!c) return;
      cats.set(c, true);
    });
    [...cats.keys()].sort((a,b)=>a.localeCompare(b,"es")).forEach(c => items.push({ key: c, label: c }));
    items.forEach(it => {
      const btn = document.createElement("button");
      btn.className = "chip" + (state.category === it.key ? " chip--active" : "");
      btn.type = "button";
      btn.textContent = it.label;
      btn.addEventListener("click", () => {
        state.category = it.key;
        buildChips();
        renderGrid();
      });
      chips.appendChild(btn);
    });
  }
  function filterProductos(){
    const qn = norm(state.q);
    const cat = state.category;
    const out = [];
    for (const p of state.productos){
      if (!p) continue;
      // Separadores se muestran solo si "Todo" o coincide con categoría
      if (isSeparator(p)){
        if (cat === "all") out.push(p);
        continue;
      }
      if (String(p.activo ?? 1) === "0") continue;
      if (cat !== "all" && String(p.categoria||"") !== cat) continue;
      if (qn){
        const hay = norm([p.nombre,p.categoria,p.subcategoria,p.marca,p.tags].filter(Boolean).join(" "));
        if (!hay.includes(qn)) continue;
      }
      out.push(p);
    }
    return out;
  }
  function renderGrid(){
    const list = filterProductos();
    els.grid.innerHTML = "";
    // Si el filtro no es "all", quitamos separadores
    const cat = state.category;
    const safeList = (cat !== "all") ? list.filter(p => !isSeparator(p)) : list;
    if (!safeList.length){
      els.grid.innerHTML = '<div class="sep"><div class="sep__title">Sin resultados</div><div class="sep__hint">Prueba otra búsqueda</div></div>';
      return;
    }
    for (const p of safeList){
      if (isSeparator(p)){
        const title = String(p.nombre||"").replace(/[—–-]/g,"").trim() || "Categoría";
        const sep = document.createElement("div");
        sep.className = "sep";
        sep.innerHTML = '<div class="sep__title">'+esc(title)+'</div><div class="sep__hint">—</div>';
        els.grid.appendChild(sep);
        continue;
      }
      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role","button");
      card.setAttribute("aria-label","Ver detalles: " + String(p.nombre||"Producto"));
      card.dataset.id = String(p.id||"");
      const stock = Number(p.stock ?? 0);
      const stockLabel = stock > 0 ? "Stock disponible" : "Sin stock";
      card.innerHTML = `<div class="card__media"> <img class="card__img" src="${esc(imgOrPlaceholder(p.img))}" alt="${esc(p.nombre||"")}" loading="lazy"> <div class="card__badge">${esc(stockLabel)}</div> </div> <div class="card__meta"> <div class="card__name">${esc(p.nombre||"")}</div> <div class="card__row"> <div class="card__pill">Ver detalles</div> <button class="card__share" type="button" aria-label="Compartir"> ${shareIconSvg()} </button> </div> </div>`;
      const shareBtn = card.querySelector(".card__share");
      shareBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        shareProduct(p);
      });
      card.addEventListener("click", () => openProductById(p.id));
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); openProductById(p.id); }
      });
      els.grid.appendChild(card);
    }
  }
  function buildWhatsAppMessage(p){
    const parts = [];
    parts.push("Hola SDComayagua 👋");
    parts.push("Quiero comprar este producto:");
    parts.push("");
    parts.push("🛍️ Producto: " + (p.nombre || ""));
    if (p.precio !== undefined && p.precio !== "" && Number(p.precio) > 0){
      parts.push("💰 Precio: " + CFG.CURRENCY + " " + Number(p.precio));
    }
    const st = Number(p.stock ?? NaN);
    if (isFinite(st)) parts.push("📦 Stock: " + st);
    const cat = [p.categoria, p.subcategoria].filter(Boolean).join(" / ");
    if (cat) parts.push("🏷️ Categoría: " + cat);
    parts.push("");
    parts.push("🔗 Link: " + productLink(p.id));
    parts.push("");
    parts.push("¿Me confirma disponibilidad y costo de envío? Gracias 🙏");
    return parts.join("\n");
  }
  function whatsappUrlForProduct(p){
    const msg = buildWhatsAppMessage(p);
    const n = CFG.WHATSAPP_NUMBER;
    return "https://wa.me/" + encodeURIComponent(n) + "?text=" + encodeURIComponent(msg);
  }
  async function shareProduct(p){
    const url = productLink(p.id);
    const title = p.nombre || "Producto";
    try{
      if (navigator.share){
        await navigator.share({ title, text: "Mira este producto en SDComayagua", url });
        return;
      }
    } catch(e){
      // ignore
    }
    try{
      await navigator.clipboard.writeText(url);
      toast("Link copiado", "Ya puedes pegarlo en WhatsApp/Facebook");
    } catch(e){
      prompt("Copia el link:", url);
    }
  }
  function closeModal(modal){
    modal.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }
  function openModal(modal){
    modal.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
  }
  function bindModalClose(modal){
    modal.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t && (t.dataset.close !== undefined || t.closest("[data-close]"))) closeModal(modal);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.getAttribute("aria-hidden") === "false"){
        closeModal(modal);
      }
    });
  }
  function openProductById(id){
    const pid = String(id || "");
    if (!pid) return;
    const p = state.productos.find(x => String(x.id) === pid);
    if (!p) return toast("No encontrado", "Este producto no existe o está desactivado.");
    window.location.hash = "p=" + encodeURIComponent(pid);
    renderProductModal(p);
    openModal(els.productModal);
  }
  function parseHashProductId(){
    const h = String(window.location.hash || "").replace(/^#/, "");
    const m = h.match(/(?:^|&)p=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
  function renderProductModal(p){
    $("#pmTitle").textContent = p.nombre || "Producto";
    const gallery = [];
    const primary = imgOrPlaceholder(p.img);
    gallery.push(primary);
    for (let i=1; i<=8; i++){
      const g = p["galeria_"+i];
      if (g) gallery.push(String(g));
    }
    const vid = String(p.video_url || p.tiktok_url || p.youtube_url || "").trim();
    const catLine = [p.categoria, p.subcategoria, p.subsubcategoria].filter(Boolean).join(" / ");
    // Body
    const mainId = "pmMainImg";
    const thumbs = gallery.map((u,idx) => `<button class="pthumb ${idx===0?"pthumb--active":""}" type="button" data-i="${idx}" aria-label="Imagen ${idx+1}"> <img src="${esc(imgOrPlaceholder(u))}" alt=""> </button>`).join("");
    els.pmBody.innerHTML = `<div class="pmodal"> <div class="pmedia"> <div class="pmedia__main"><img id="${mainId}" src="${esc(primary)}" alt="${esc(p.nombre||"")}" loading="eager"></div> <div class="pthumbs" id="pmThumbs">${thumbs}</div> </div> <div class="pinfo"> <div class="pinfo__meta">${esc(catLine || "")}</div> <div class="pinfo__price">${esc(fmtLps(p.precio) || (CFG.CURRENCY + " " + (p.precio||"")) || "")}</div> <div class="pinfo__grid"> <div class="pbox"> <div class="pbox__k">Stock</div> <div class="pbox__v">${esc(String(p.stock ?? "—"))}</div> </div> <div class="pbox"> <div class="pbox__k">Marca</div> <div class="pbox__v">${esc(String(p.marca ?? "—"))}</div> </div> </div> <div class="desc">${esc(String(p.descripcion || "Sin descripción."))}</div> <div class="small">Tip: toca “Compartir” para copiar el link.</div> </div> </div>`;
    // Thumb interactions
    const mainImg = $("#" + mainId);
    const thumbsEl = $("#pmThumbs");
    thumbsEl.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-i]");
      if (!b) return;
      const i = Number(b.dataset.i);
      const url = gallery[i] || primary;
      mainImg.src = imgOrPlaceholder(url);
      thumbsEl.querySelectorAll(".pthumb").forEach(x => x.classList.remove("pthumb--active"));
      b.classList.add("pthumb--active");
    });
    // Footer
    const wa = whatsappUrlForProduct(p);
    const shareBtn = `<button class="btn" type="button" id="pmShare"> ${shareIconSvg()} <span>Compartir</span> </button>`;
    const videoBtn = vid ? `<a class="btn btn--ghost" href="${esc(vid)}" target="_blank" rel="noopener">🎬 Ver video</a>`: ""; els.pmFooter.innerHTML =`
      <a class="btn btn--primary" href="${esc(wa)}" target="_blank" rel="noopener">
        <span class="btn__icon">🟢</span><span>Comprar por WhatsApp</span>
      </a>
      ${shareBtn}
      ${videoBtn}
    `;
    $("#pmShare").addEventListener("click", () => shareProduct(p));
  }
  function buildCategoriesModal(){
    const modalGrid = els.catsGrid;
    modalGrid.innerHTML = "";
    const cats = new Map();
    state.productos.forEach(p => {
      if (!p || isSeparator(p)) return;
      const c = String(p.categoria||"").trim();
      if (!c) return;
      cats.set(c, true);
    });
    const catList = [...cats.keys()].sort((a,b)=>a.localeCompare(b,"es"));
    const all = document.createElement("button");
    all.className = "cat";
    all.type = "button";
    all.innerHTML = '<div class="cat__emoji">✨</div><div class="cat__name">Todo</div>';
    all.addEventListener("click", () => {
      state.category = "all";
      buildChips();
      renderGrid();
      closeModal(els.categoriesModal);
    });
    modalGrid.appendChild(all);
    for (const c of catList){
      const btn = document.createElement("button");
      btn.className = "cat";
      btn.type = "button";
      btn.innerHTML = '<div class="cat__emoji">'+categoryEmoji(c)+'</div><div class="cat__name">'+esc(c)+'</div>';
      btn.addEventListener("click", () => {
        state.category = c;
        buildChips();
        renderGrid();
        closeModal(els.categoriesModal);
      });
      modalGrid.appendChild(btn);
    }
  }
  async function loadData(){
    setStatus(true, "Cargando catálogo…", "Conectando con el servidor", false);
    try{
      const resp = await Api.getProductos();
      if (!resp || resp.ok !== true) throw new Error(resp && resp.message ? resp.message : "Respuesta inválida");
      const productos = resp.productos || resp.data || [];
      if (!Array.isArray(productos)) throw new Error("productos no es lista");
      state.productos = productos;
      // UI
      buildChips();
      buildCategoriesModal();
      renderGrid();
      // Footer WA
      const waBase = "https://wa.me/" + encodeURIComponent(CFG.WHATSAPP_NUMBER) + "?text=" + encodeURIComponent("Hola SDComayagua 👋 Quiero información del catálogo.");
      els.btnWhatsAppFooter.href = waBase;
      setStatus(false);
      els.grid.hidden = false;
      // Open from hash (deep link)
      const pid = parseHashProductId();
      if (pid) openProductById(pid);
      toast("Listo", "Catálogo cargado");
    } catch (err){
      console.error(err);
      const detail = (err && err.details && err.details.body) ? ("\n" + String(err.details.body).slice(0,140)) : "";
      setStatus(true, "No se pudo cargar", "Toca reintentar. " + (err.code ? ("[" + err.code + "] ") : "") + (err.message||"") + detail, true);
    }
  }
  function bindHeader(){
    // Search
    const search = els.searchInput;
    const wrap = search.closest(".search");
    const clear = els.searchClear;
    const syncSearchUi = () => {
      const has = !!search.value.trim();
      wrap.classList.toggle("search--hasvalue", has);
      clear.style.display = has ? "inline-flex" : "none";
    };
    search.addEventListener("input", () => {
      state.q = search.value;
      syncSearchUi();
      renderGrid();
    });
    clear.addEventListener("click", () => {
      search.value = "";
      state.q = "";
      syncSearchUi();
      renderGrid();
      search.focus();
    });
    syncSearchUi();
    // Buttons
    els.btnTheme.addEventListener("click", () => {
      setTheme(state.theme === "light" ? "dark" : "light");
    });
    els.btnCategories.addEventListener("click", () => {
      buildCategoriesModal();
      openModal(els.categoriesModal);
    });
    // Retry
    els.btnRetry.addEventListener("click", () => loadData());
  }
  function bindHashChange(){
    window.addEventListener("hashchange", () => {
      const pid = parseHashProductId();
      if (!pid) return;
      openProductById(pid);
    });
  }
  function init(){
    els.status = $("status");
    els.grid = $("grid");
    els.btnRetry = $("btnRetry");
    els.btnTheme = $("btnTheme");
    els.btnCategories = $("btnCategories");
    els.btnAdmin = $("btnAdmin");
    els.searchInput = $("searchInput");
    els.searchClear = $("searchClear");
    els.chips = $("chips");
    els.productModal = $("productModal");
    els.categoriesModal = $("categoriesModal");
    els.adminModal = $("adminModal");
    els.adminEditModal = $("adminEditModal");
    els.pmBody = $("pmBody");
    els.pmFooter = $("pmFooter");
    els.catsGrid = $("catsGrid");
    els.btnWhatsAppFooter = $("btnWhatsAppFooter");
    bindModalClose(els.productModal);
    bindModalClose(els.categoriesModal);
    bindModalClose(els.adminModal);
    bindModalClose(els.adminEditModal);
    bindHeader();
    bindHashChange();
    const saved = localStorage.getItem("SDCO_THEME") || "dark";
    setTheme(saved);
    // Admin button -> handled in admin.js, but ensure it exists
    els.btnAdmin.addEventListener("click", () => {
      if (window.SDCO_Admin) window.SDCO_Admin.openAdmin();
    });
    loadData();
  }
  window.SDCO_UI = {
    getState: () => state,
    setProductos: (arr) => { state.productos = arr || []; buildChips(); buildCategoriesModal(); renderGrid(); },
    refreshProductos: async () => {
      const resp = await Api.getProductos();
      if (resp && resp.ok && Array.isArray(resp.productos)){
        state.productos = resp.productos;
        buildChips(); buildCategoriesModal(); renderGrid();
      }
      return resp;
    },
    openProductById,
    toast,
    closeModal,
    openModal
  };
  document.addEventListener("DOMContentLoaded", init);
})();
