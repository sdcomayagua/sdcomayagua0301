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

async function fetchJSON(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return {ok:false}; }
}

async function loadProducts() {
  const res = await fetchJSON("https://script.google.com/macros/s/AKfycbya37aSm80xgzd7mh4mG87_gRZzvl55xl4gt3X5hyCPvUeDg6chLJq7Qn97n_aqS3nI/exec?only=productos");
  if (res.ok && res.productos) return res.productos;
  throw new Error("No se cargaron productos");
}

let products = [];

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
    img: p.img || "https://via.placeholder.com/300"
  };
}

function renderProducts() {
  const grid = $("#grid");
  if (!grid) return;
  grid.innerHTML = products.map(p => `
    <div class="card">
      <img src="\( {p.img}" alt=" \){p.nombre}">
      <h4>${p.nombre}</h4>
      <div class="price">${fmtMoney(p.precio)}</div>
      <div class="stock">${p.stock > 0 ? "Stock: " + p.stock : "Agotado"}</div>
      <a href="https://wa.me/50431517755?text=Hola,%20quiero%20comprar%20${encodeURIComponent(p.nombre)}" target="_blank" class="btn primary">Comprar por WhatsApp</a>
    </div>
  `).join("");
}

async function bootStore() {
  try {
    const raw = await loadProducts();
    products = raw.map(normalize);
    renderProducts();
  } catch (err) {
    console.error(err);
    toast("Error cargando productos");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bootStore();

  $("#goCats")?.addEventListener("click", () => alert("Categorías (implementar)"));
  $("#goAll")?.addEventListener("click", () => renderProducts());
  $("#catsBtn")?.addEventListener("click", () => alert("Menú categorías"));
  $("#adminBtn")?.addEventListener("click", () => location.href = "admin.html");
});
