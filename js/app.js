(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const cfg = window.SDCFG || {};
  const stateEl = $("#state");
  const gridEl = $("#grid");
  const chipsEl = $("#chips");

  const qEl = $("#q");
  const clearEl = $("#btnClear");
  const catEl = $("#selCat");
  const subEl = $("#selSub");
  const sortEl = $("#selSort");
  const inStockEl = $("#chkInStock");
  const btnTheme = $("#btnTheme");
  const btnWhatsTop = $("#btnWhatsTop");
  const btnWhatsSupport = $("#btnWhatsSupport");
  const yearEl = $("#year");

  let all = [];
  let cats = [];
  let subsByCat = new Map();

  const nowYear = new Date().getFullYear();
  if (yearEl) yearEl.textContent = String(nowYear);

  // Default toggle
  if (inStockEl) inStockEl.checked = !!cfg.onlyInStockDefault;

  // Theme
  const THEME_KEY = "sd_theme";
  function setTheme(mode){
    if (!mode) mode = "dark";
    document.documentElement.dataset.theme = mode === "light" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, mode);
  }
  setTheme(localStorage.getItem(THEME_KEY) || "dark");
  btnTheme?.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(cur === "light" ? "dark" : "light");
  });

  function normalizeImg(url){
    if (!url) return "";
    let u = String(url).trim();
    // googleusercontent/blogger: /sXXX/ -> /s1200/
    u = u.replace(/\/s\d+\//g, "/s1200/");
    // =sXXX -> =s1200
    u = u.replace(/=s\d+$/g, "=s1200");
    return u;
  }

  function num(v){
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^\d.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function showState(msg){
    stateEl.hidden = false;
    stateEl.textContent = msg;
  }
  function hideState(){
    stateEl.hidden = true;
    stateEl.textContent = "";
  }

  function buildWhatsLink(product){
    const name = product.nombre || "Producto";
    const price = product.precio_oferta && num(product.precio_oferta) > 0 ? num(product.precio_oferta) : num(product.precio);
    const msg = `Hola, quiero comprar: ${name}\nPrecio: ${cfg.currency} ${price}\nCategoría: ${product.categoria || ""}${product.subcategoria ? " / " + product.subcategoria : ""}\nID: ${product.id || ""}`;
    const enc = encodeURIComponent(msg);
    return `https://wa.me/${cfg.whatsappNumber}?text=${enc}`;
  }

  function setTopWhats(){
    const msg = encodeURIComponent(`Hola, vengo de la página ${cfg.brandShort}. Quiero información.`);
    const url = `https://wa.me/${cfg.whatsappNumber}?text=${msg}`;
    btnWhatsTop?.setAttribute("href", url);
    btnWhatsSupport?.setAttribute("href", url);
  }
  setTopWhats();

  function distinct(arr){
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function buildTaxonomy(list){
    cats = distinct(list.map(p => p.categoria)).sort((a,b)=>a.localeCompare(b,"es"));
    subsByCat = new Map();
    for (const c of cats){
      const subs = distinct(list.filter(p => p.categoria === c).map(p => p.subcategoria)).sort((a,b)=>a.localeCompare(b,"es"));
      subsByCat.set(c, subs);
    }
  }

  function fillSelect(el, options, placeholder){
    if (!el) return;
    el.innerHTML = "";
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = placeholder;
    el.appendChild(o0);
    for (const opt of options){
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      el.appendChild(o);
    }
  }

  function renderChips(){
    if (!chipsEl) return;
    chipsEl.innerHTML = "";
    const chipAll = document.createElement("button");
    chipAll.className = "chip chip--active";
    chipAll.type = "button";
    chipAll.textContent = "Todo";
    chipAll.addEventListener("click", () => {
      catEl.value = "";
      subEl.value = "";
      updateSubOptions();
      markChip("");
      render();
    });
    chipsEl.appendChild(chipAll);

    for (const c of cats){
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => {
        catEl.value = c;
        updateSubOptions();
        subEl.value = "";
        markChip(c);
        render();
      });
      chipsEl.appendChild(b);
    }
  }

  function markChip(cat){
    $$(".chip").forEach(btn => btn.classList.remove("chip--active"));
    $$(".chip").forEach(btn => {
      if (btn.textContent === "Todo" && !cat) btn.classList.add("chip--active");
      if (btn.textContent === cat) btn.classList.add("chip--active");
    });
  }

  function updateSubOptions(){
    const c = catEl.value;
    const subs = c ? (subsByCat.get(c) || []) : distinct(all.map(p => p.subcategoria)).sort((a,b)=>a.localeCompare(b,"es"));
    fillSelect(subEl, subs, "Todas las subcategorías");
  }

  function sortProducts(list){
    const mode = sortEl.value || "relevance";
    const q = (qEl.value || "").trim().toLowerCase();

    if (mode === "price_asc"){
      return list.slice().sort((a,b) => num(a.precio_oferta||a.precio) - num(b.precio_oferta||b.precio));
    }
    if (mode === "price_desc"){
      return list.slice().sort((a,b) => num(b.precio_oferta||b.precio) - num(a.precio_oferta||a.precio));
    }
    if (mode === "newest"){
      return list.slice().sort((a,b) => (new Date(b.fecha||0)).getTime() - (new Date(a.fecha||0)).getTime());
    }
    // relevance: simple score based on query occurrences
    if (q){
      const score = (p) => {
        const hay = `${p.nombre||""} ${p.categoria||""} ${p.subcategoria||""} ${p.marca||""} ${p.descripcion||""}`.toLowerCase();
        let s = 0;
        if (hay.includes(q)) s += 4;
        // word scoring
        const parts = q.split(/\s+/).filter(Boolean);
        for (const w of parts) if (hay.includes(w)) s += 1;
        // prefer in-stock
        if (Number(p.stock||0) > 0) s += 0.2;
        return s;
      };
      return list.slice().sort((a,b) => score(b) - score(a));
    }
    return list;
  }

  function filterProducts(){
    const q = (qEl.value || "").trim().toLowerCase();
    const cat = catEl.value;
    const sub = subEl.value;
    const onlyStock = !!inStockEl.checked;

    return all.filter(p => {
      if (cfg.onlyActive && String(p.activo) === "0") return false;
      if (onlyStock && Number(p.stock||0) <= 0) return false;
      if (cat && (p.categoria||"") !== cat) return false;
      if (sub && (p.subcategoria||"") !== sub) return false;
      if (!q) return true;
      const hay = `${p.nombre||""} ${p.categoria||""} ${p.subcategoria||""} ${p.marca||""} ${p.descripcion||""}`.toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    });
  }

  function priceHtml(p){
    const p1 = num(p.precio);
    const p2 = num(p.precio_oferta);
    if (p2 > 0 && p2 < p1){
      return `<div class="priceRow"><div class="price">${cfg.currency} ${p2}</div><div class="price--old">${cfg.currency} ${p1}</div></div>`;
    }
    return `<div class="priceRow"><div class="price">${cfg.currency} ${p1}</div></div>`;
  }

  function card(p){
    const name = escapeHtml(p.nombre || "Producto");
    const cat = escapeHtml(p.categoria || "");
    const sub = escapeHtml(p.subcategoria || "");
    const marca = escapeHtml(p.marca || "");
    const cond = escapeHtml(p.condicion || "");
    const desc = escapeHtml(p.descripcion || "").slice(0, 110);
    const img = normalizeImg(p.foto_url || "");
    const stock = Number(p.stock || 0);

    const badges = [];
    if (marca) badges.push(`<span class="badge">${marca}</span>`);
    if (cond) badges.push(`<span class="badge">${cond}</span>`);
    if (stock > 0) badges.push(`<span class="badge badge--ok">Disponible</span>`);
    else badges.push(`<span class="badge badge--danger">Agotado</span>`);

    const buyUrl = buildWhatsLink(p);

    return `
      <article class="card">
        <div class="media">
          ${img ? `<img loading="lazy" src="${img}" alt="${name}">` : ""}
          <div class="badgeRow">${badges.join("")}</div>
        </div>
        <div class="card__body">
          <h3 class="title">${name}</h3>
          <div class="meta">
            ${cat ? `<span>${cat}</span>` : ""}
            ${sub ? `<span>• ${sub}</span>` : ""}
            ${p.id ? `<span>• ID ${escapeHtml(p.id)}</span>` : ""}
          </div>
          ${priceHtml(p)}
          <p class="desc">${desc || ""}</p>
        </div>
        <div class="card__actions">
          <button class="btnSmall" type="button" data-share="${escapeHtml(p.slug || "")}">Compartir</button>
          <a class="btnSmall btnSmall--buy" href="${buyUrl}" target="_blank" rel="noopener">Comprar</a>
        </div>
      </article>
    `;
  }

  function render(){
    const filtered = sortProducts(filterProducts());
    if (!filtered.length){
      gridEl.innerHTML = "";
      showState("No encontré productos con esos filtros.");
      return;
    }
    hideState();
    gridEl.innerHTML = filtered.map(card).join("");

    // Share
    $$("#grid .btnSmall[data-share]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const slug = btn.getAttribute("data-share") || "";
        const url = slug ? `${location.origin}${location.pathname}#p=${encodeURIComponent(slug)}` : location.href;
        const title = cfg.brandShort || "Catálogo";
        const text = "Mira este producto:";
        try{
          if (navigator.share){
            await navigator.share({ title, text, url });
          } else {
            await navigator.clipboard.writeText(url);
            btn.textContent = "Copiado ✓";
            setTimeout(() => btn.textContent = "Compartir", 900);
          }
        }catch(_e){ /* ignore */ }
      });
    });
  }

  function ensureApiBase(){
    if (!cfg.apiBase || cfg.apiBase.includes("PEGA_TU_WEB_APP_AQUI")){
      showState("⚠️ Falta configurar apiBase (pega tu URL de Web App de Apps Script).");
      return false;
    }
    return true;
  }

  async function fetchJson(){
    const base = cfg.apiBase.replace(/\/exec.*$/,"/exec");
    const params = new URLSearchParams();
    params.set("only", "productos");
    if (cfg.onlyActive) params.set("active", "1");
    return fetch(`${base}?${params.toString()}`, { method:"GET" })
      .then(r => r.json());
  }

  function fetchJsonp(){
    return new Promise((resolve, reject) => {
      const base = cfg.apiBase.replace(/\/exec.*$/,"/exec");
      const cbName = "__sdc_cb_" + Math.random().toString(16).slice(2);
      const params = new URLSearchParams();
      params.set("only", "productos");
      if (cfg.onlyActive) params.set("active", "1");
      params.set("format", "jsonp");
      params.set("callback", cbName);

      const script = document.createElement("script");
      script.src = `${base}?${params.toString()}`;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, 12000);

      function cleanup(){
        clearTimeout(timeout);
        script.remove();
        try { delete window[cbName]; } catch(_e){ window[cbName] = undefined; }
      }

      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("JSONP error"));
      };

      document.body.appendChild(script);
    });
  }

  function normalizeRow(p){
    const o = { ...p };
    o.id = o.id ?? o.ID ?? "";
    o.nombre = o.nombre ?? o.name ?? "";
    o.precio = o.precio ?? o.price ?? 0;
    o.precio_oferta = o.precio_oferta ?? o.offer ?? 0;
    o.categoria = o.categoria ?? o.category ?? "";
    o.subcategoria = o.subcategoria ?? o.subcategory ?? "";
    o.descripcion = o.descripcion ?? o.description ?? "";
    o.foto_url = o.foto_url ?? o.foto ?? o.image ?? "";
    o.tiktok_url = o.tiktok_url ?? o.tiktok ?? "";
    o.stock = o.stock ?? o.qty ?? 0;
    o.activo = o.activo ?? 1;
    o.fecha = o.fecha ?? "";
    o.slug = o.slug ?? "";
    o.marca = o.marca ?? "";
    o.condicion = o.condicion ?? "";
    return o;
  }

  async function init(){
    if (!ensureApiBase()) return;

    showState("Cargando productos…");

    try{
      let data;
      if (cfg.preferJsonp){
        data = await fetchJsonp();
      } else {
        data = await fetchJson();
      }
      const list = Array.isArray(data) ? data : (data.items || data.productos || []);
      all = list.map(normalizeRow);

      buildTaxonomy(all);

      fillSelect(catEl, cats, "Todas las categorías");
      updateSubOptions();
      renderChips();
      hideState();
      render();

      const hash = location.hash || "";
      const m = hash.match(/#p=([^&]+)/);
      if (m && m[1]){
        const slug = decodeURIComponent(m[1]);
        qEl.value = slug.replace(/[-_]/g, " ");
        render();
      }
    }catch(e){
      showState("No pude cargar productos. Revisa tu Web App (Apps Script) y que esté 'Acceso: Cualquiera'.");
      console.error(e);
    }
  }

  qEl?.addEventListener("input", () => render());
  clearEl?.addEventListener("click", () => { qEl.value=""; qEl.focus(); render(); });

  catEl?.addEventListener("change", () => { updateSubOptions(); subEl.value=""; markChip(catEl.value); render(); });
  subEl?.addEventListener("change", () => render());
  sortEl?.addEventListener("change", () => render());
  inStockEl?.addEventListener("change", () => render());

  init();
})();