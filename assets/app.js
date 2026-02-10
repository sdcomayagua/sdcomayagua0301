const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function fmtMoney(n) {
  return "Lps. " + Number(n || 0).toLocaleString("es-HN");
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2500);
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return {ok:false, text}; }
}

const CACHE_KEY = "SDCO_PRODUCTS";
function getCache() { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); }
function setCache(data) { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }

async function loadProducts() {
  let data = getCache();
  if (data) return data;

  const res = await fetchJSON("https://script.google.com/macros/s/AKfycbya37aSm80xgzd7mh4mG87_gRZzvl55xl4gt3X5hyCPvUeDg6chLJq7Qn97n_aqS3nI/exec?only=productos");
  if (res.ok && res.productos) {
    setCache(res.productos);
    return res.productos;
  }
  throw new Error("No se cargaron productos");
}

let products = [];
let currentCat = "Todos";

function normalize(p) {
  return {
    id: p.id || Date.now().toString(),
    nombre: p.nombre || "Sin nombre",
    categoria: p.categoria || "Otros",
    subcategoria: p.subcategoria || "General",
    marca: p.marca || "",
    precio: p.precio || "0",
    stock: Number(p.stock) || 0,
    activo: p.activo !== "0",
    descripcion: p.descripcion || "",
    img: p.img || "https://via.placeholder.com/300",
    gallery: Array.from({length:8}, (_,i) => p[`galeria_${i+1}`]).filter(Boolean)
  };
}

function getCategoryIcon(cat) {
  const icons = {
    "Celulares": "📱",
    "Tecnología": "💻",
    "Hogar": "🏠",
    "Cocina": "🍳",
    "Vehículos/Motos": "🏍️",
    "Otros": "🛒"
  };
  return icons[cat] || "🛍️";
}

function renderProducts(filtered) {
  const grid = $("#grid");
  if (!grid) return;

  grid.innerHTML = filtered.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="img">
        ${Number(p.precio) >= 500 ? '<div class="badge success">Envío Gratis</div>' : ''}
        ${p.stock > 0 && p.stock <= 5 ? '<div class="badge warn">¡Solo ' + p.stock + '!</div>' : ''}
        <img src="${p.img}" alt="${p.nombre}" loading="lazy">
      </div>
      <div class="body">
        <h4>${p.nombre}</h4>
        <div class="meta">${p.marca ? p.marca + " • " : ""}${p.stock > 0 ? "Stock: " + p.stock : '<span style="color:#dc2626">Agotado</span>'}</div>
        <div class="price">${fmtMoney(p.precio)}</div>
        <a href="https://wa.me/50431517755?text=Hola,%20quiero%20comprar%20${encodeURIComponent(p.nombre)}" target="_blank" class="btn primary small">Comprar por WhatsApp</a>
      </div>
    </div>
  `).join("");
}

function renderCategories() {
  const container = $("#catGrid");
  if (!container) return;

  const cats = ["Todos", ...new Set(products.map(p => p.categoria))].sort();
  container.innerHTML = cats.map(cat => `
    <div class="cat-card" data-cat="${cat}">
      <div class="cat-icon">${getCategoryIcon(cat)}</div>
      <div class="cat-name">${cat}</div>
    </div>
  `).join("");

  $$(".cat-card").forEach(el => {
    el.addEventListener("click", () => {
      currentCat = el.dataset.cat;
      filterProducts();
    });
  });
}

function filterProducts() {
  let filtered = products;
  if (currentCat !== "Todos") filtered = filtered.filter(p => p.categoria === currentCat);
  renderProducts(filtered);
}

async function bootStore() {
  try {
    const raw = await loadProducts();
    products = raw.map(normalize).filter(p => p.activo);
    renderCategories();
    filterProducts();
  } catch (err) {
    console.error(err);
    toast("Error cargando productos");
  }
}

/* Admin */
function bootAdmin() {
  const key = localStorage.getItem("SDCO_ADMIN_KEY");
  if (key) {
    $("#loginBox").style.display = "none";
    $("#adminUI").style.display = "block";
    loadAdminProducts(key);
  } else {
    $("#loginBox").style.display = "block";
    $("#adminUI").style.display = "none";
  }

  $("#loginBtn").onclick = () => {
    const k = $("#adminKey").value.trim();
    if (k) {
      localStorage.setItem("SDCO_ADMIN_KEY", k);
      location.reload();
    } else toast("Ingresa clave");
  };

  $("#logoutBtn").onclick = () => {
    localStorage.removeItem("SDCO_ADMIN_KEY");
    location.reload();
  };
}

async function loadAdminProducts(key) {
  try {
    const raw = await loadProducts();
    const tbody = $("#atable");
    tbody.innerHTML = raw.map(p => `
      <tr>
        <td>${p.nombre}</td>
        <td>${fmtMoney(p.precio)}</td>
        <td>${p.stock}</td>
        <td>${p.activo ? "Activo" : "Inactivo"}</td>
        <td>
          <button class="btn small edit" data-id="${p.id}">Editar</button>
          <button class="btn small delete" data-id="${p.id}">Eliminar</button>
        </td>
      </tr>
    `).join("");

    $$(".edit").forEach(b => b.onclick = e => editProduct(e.target.dataset.id));
    $$(".delete").forEach(b => b.onclick = async e => {
      if (confirm("¿Eliminar?")) {
        await apiPost("deleteProduct", { adminKey: key, id: e.target.dataset.id });
        toast("Eliminado");
        loadAdminProducts(key);
      }
    });
  } catch (err) {
    toast("Error en admin");
  }
}

function editProduct(id) {
  toast("Editando ID: " + id + " (implementa modal aquí)");
  // Aquí puedes abrir el modal de edición con los datos del producto
}

/* Init */
window.addEventListener("DOMContentLoaded", () => {
  applyTheme();
  const page = document.body.dataset.page;
  if (page === "admin") bootAdmin();
  else bootStore();

  $("#themeToggle")?.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("theme", document.documentElement.dataset.theme);
  });

  $("#goCats")?.addEventListener("click", () => filterProducts());
  $("#goAll")?.addEventListener("click", () => { currentCat = "Todos"; filterProducts(); });
  $("#catsBtn")?.addEventListener("click", () => filterProducts());
  $("#adminBtn")?.addEventListener("click", () => location.href = "admin.html");
});
