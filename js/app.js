import { Store } from "./state/store.js";
import { Router } from "./router.js";
import { fetchResource } from "./api/client.js";
import { qs } from "./utils/dom.js";
import { safeText } from "./utils/format.js";
import { renderTopBar } from "./components/TopBar.js";
import { renderCatalogHeader } from "./components/CatalogHeader.js";
import { renderSkeletonGrid } from "./components/SkeletonGrid.js";
import { renderProductCard } from "./components/ProductCard.js";
import { openProductModal } from "./components/ProductModal.js";
import { openCartModal } from "./components/CartModal.js";
import { openShareModal } from "./components/ShareModal.js";
import { toast } from "./components/Toast.js";
import { buildShareUrl } from "./utils/url.js";

const state = {
  productos: [],
  envios: [],
  ajustes: {},
  taxonomia: { categorias: [] },

  q: "",
  cat: "",
  sub: "",
  sort: "relevance",
  chip: "Todos",
  openProductId: null,
  scrollY: 0,
};

function applyTheme(){
  document.documentElement.setAttribute("data-theme", Store.ui.theme || "light");
}

function buildChips(){
  return ["Todos", "Tecnología", "Gamer", "Hogar", "Cocina", "Vehículos/Motos", "Celulares"];
}

function normalize(s){ return safeText(s).toLowerCase(); }

function matchProduct(p, q){
  if (!q) return true;
  const hay = [
    p.nombre, p.marca, p.tags, p.categoria, p.subcategoria, p.subsubcategoria
  ].map(x=>normalize(x)).join(" | ");
  return hay.includes(q);
}

function filterByCat(p){
  if (state.cat && normalize(p.categoria) !== normalize(state.cat)) return false;
  if (state.sub && normalize(p.subcategoria) !== normalize(state.sub)) return false;
  return true;
}

function filterByChip(p){
  if (state.chip === "Todos") return true;
  const bucket = normalize(state.chip);
  const hay = normalize([p.categoria, p.subcategoria, p.tags].filter(Boolean).join(" "));
  // mapeo simple
  if (bucket.includes("veh")) return hay.includes("moto") || hay.includes("veh");
  if (bucket.includes("cel")) return hay.includes("cel") || hay.includes("android");
  if (bucket.includes("tec")) return hay.includes("tec") || hay.includes("usb") || hay.includes("cable");
  return hay.includes(bucket);
}

function sortProducts(list){
  const v = state.sort;
  const byPrice = (a,b)=>Number(a.precio||0) - Number(b.precio||0);
  if (v==="price_asc") return [...list].sort(byPrice);
  if (v==="price_desc") return [...list].sort((a,b)=>-byPrice(a,b));
  if (v==="newest") return [...list].sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0));
  // relevance: score by query hit + stock + offer/new
  const q = normalize(state.q);
  const score = (p)=>{
    let s = 0;
    if (q){
      const name = normalize(p.nombre);
      if (name.startsWith(q)) s+=40;
      else if (name.includes(q)) s+=25;
      const tags = normalize(p.tags);
      if (tags.includes(q)) s+=12;
    }
    if (Number(p.stock||0)>0) s+=5;
    if (String(p.oferta||"") === "1") s+=3;
    if (String(p.nuevo||"") === "1") s+=2;
    return -s; // sort asc
  };
  return [...list].sort((a,b)=>score(a)-score(b));
}

function render(){
  applyTheme();

  // Topbar
  const topbar = qs("#topbar");
  topbar.innerHTML = "";
  topbar.appendChild(renderTopBar({
    onSearch: (v)=>{
      state.q = v;
      Router.set({ q: v || null }, { replace:true });
      render();
    },
    onOpenCart: ()=>openCart(),
    onOpenAdmin: ()=>window.open("./admin/", "_blank", "noopener")
  }));

  // update cart badge
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = String(Store.cart.items.reduce((a,i)=>a+i.qty,0));

  // Header
  const chips = buildChips();
  const title = state.cat ? `Catálogo: ${state.cat}` : "Catálogo";
  const subtitle = state.sub ? `Subcategoría: ${state.sub}` : "Compra por WhatsApp • Precios en Lempiras";
  const header = qs("#catalogHeader");
  header.innerHTML = "";
  header.appendChild(renderCatalogHeader({
    title, subtitle, chips,
    activeChip: state.chip,
    onChip: (c)=>{
      state.chip = c;
      Router.set({ chip: c!=="Todos" ? c : null }, { replace:true });
      render();
    },
    sortValue: state.sort,
    onSort: (v)=>{
      state.sort = v;
      Router.set({ sort: v!=="relevance" ? v : null }, { replace:true });
      render();
    }
  }));

  const grid = qs("#grid");
  const empty = qs("#emptyState");
  empty.classList.add("hidden");

  const q = normalize(state.q);
  const list = state.productos
    .filter(p=>String(p.activo||"1")!=="0")
    .filter(filterByCat)
    .filter(filterByChip)
    .filter(p=>matchProduct(p, q));

  const sorted = sortProducts(list);

  grid.innerHTML = "";
  if (!sorted.length){
    empty.innerHTML = "";
    empty.classList.remove("hidden");
    empty.appendChild(document.createElement("div"));
    empty.appendChild(document.createTextNode(""));
    empty.appendChild(
      (function(){
        const d = document.createElement("div");
        d.className = "empty";
        d.innerHTML = "";
        d.appendChild(document.createElement("div"));
        return d;
      })()
    );
    empty.innerHTML = "";
    empty.appendChild(
      (function(){
        const wrap = document.createElement("div");
        wrap.className = "empty";
        wrap.innerHTML = "";
        const h = document.createElement("h3"); h.textContent="Sin resultados";
        const p = document.createElement("p"); p.textContent="Prueba con otra palabra o presiona “Ver todo”.";
        const b = document.createElement("button"); b.className="btn primary"; b.type="button"; b.textContent="Ver todo";
        b.onclick=()=>{
          state.q=""; state.cat=""; state.sub=""; state.chip="Todos"; state.sort="relevance";
          Router.set({ q:null, cat:null, sub:null, chip:null, sort:null }, { replace:false });
          const inp = document.getElementById("searchInput"); if (inp) inp.value="";
          render();
        };
        wrap.append(h,p,b);
        return wrap;
      })()
    );
    return;
  }

  for (const p of sorted){
    grid.appendChild(renderProductCard(p, {
      onOpen: (prod)=>openProduct(prod),
      onAdd: (prod)=>{ Store.addToCart(prod,1); toast("Agregado", safeText(prod.nombre)); },
      onShare: (prod)=>shareProduct(prod)
    }));
  }
}

function shareProduct(p){
  openShareModal({
    title: "Compartir producto",
    params: { p: p.id },
    textShort: `🛍️ ${safeText(p.nombre)} - SD-Comayagua`
  });
}

function shareCurrentView(){
  const params = {};
  if (state.cat) params.cat = state.cat;
  if (state.sub) params.sub = state.sub;
  if (state.q) params.q = state.q;
  if (state.chip && state.chip!=="Todos") params.chip = state.chip;
  if (state.sort && state.sort!=="relevance") params.sort = state.sort;

  openShareModal({
    title: "Compartir esta vista",
    params,
    textShort: `🔎 Catálogo SD-Comayagua`
  });
}

let productModal = null;
function openProduct(p){
  // guardar scroll y abrir sin reset
  state.scrollY = window.scrollY || 0;
  state.openProductId = p.id;
  Router.set({ p: p.id }, { replace:false });

  productModal = openProductModal(p, {
    onClose: ()=>{
      state.openProductId = null;
      Router.set({ p: null }, { replace:false });
      // mantener scroll
      window.scrollTo({ top: state.scrollY, behavior: "instant" });
    },
    onAdd: (prod)=>{ Store.addToCart(prod,1); toast("Agregado", safeText(prod.nombre)); },
    onShare: (prod)=>shareProduct(prod)
  });
}

let cartModal = null;
function openCart(){
  cartModal = openCartModal({
    productos: state.productos,
    envios: state.envios,
    ajustes: state.ajustes,
    onOpenProduct: (p)=>openProduct(p),
    onShareFilter: ()=>shareCurrentView()
  });
}

async function boot(){
  applyTheme();
  // skeleton
  const grid = qs("#grid");
  grid.innerHTML = "";
  renderSkeletonGrid(12).forEach(n=>grid.appendChild(n));

  try{
    const [p1, e1, a1, t1] = await Promise.all([
      fetchResource("productos"),
      fetchResource("envios"),
      fetchResource("ajustes"),
      fetchResource("taxonomia"),
    ]);

    state.productos = p1.productos || p1.items || p1 || [];
    state.envios = e1.envios || e1.items || e1 || [];
    state.ajustes = a1.ajustes || a1 || {};
    state.taxonomia = t1.taxonomia || t1 || { categorias: [] };

    Router.onRoute = (q)=>{
      state.openProductId = q.p || null;
      state.cat = q.cat || "";
      state.sub = q.sub || "";
      state.q = q.q || "";
      state.chip = q.chip || "Todos";
      state.sort = q.sort || "relevance";

      // sincroniza buscador
      const inp = document.getElementById("searchInput");
      if (inp && inp.value !== state.q) inp.value = state.q;

      render();

      // deep link producto
      if (state.openProductId){
        const prod = state.productos.find(x=>String(x.id)===String(state.openProductId));
        if (prod){
          if (!productModal) openProduct(prod);
        }else{
          toast("Producto no encontrado", "Puede haber sido eliminado");
        }
      }
    };
    Router.start();

    Store.subscribe(()=>render());
    render();
  }catch(err){
    grid.innerHTML = "";
    const box = document.createElement("div");
    box.className = "empty";
    box.innerHTML = `<h3>Error cargando catálogo</h3>
      <p>Revisa que CONFIG.API_BASE esté bien configurado (frontend/js/config.js) y que tu Web App esté publicada.</p>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">Detalle: ${String(err?.message||err)}</p>`;
    grid.appendChild(box);
  }
}

boot();
