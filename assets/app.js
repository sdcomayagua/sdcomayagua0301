const $ = s => document.querySelector(s);

function fmtMoney(n) {
  return "Lps. " + Number(n || 0).toLocaleString("es-HN");
}

async function fetchProducts() {
  const url = "https://script.google.com/macros/s/AKfycbya37aSm80xgzd7mh4mG87_gRZzvl55xl4gt3X5hyCPvUeDg6chLJq7Qn97n_aqS3nI/exec?only=productos";
  const res = await fetch(url);
  const json = await res.json();
  return json.productos || [];
}

function renderCard(p) {
  return `
    <div class="card">
      <img src="\( {p.img || 'https://via.placeholder.com/280x180?text=Producto'}" alt=" \){p.nombre || 'Producto'}">
      <h4>${p.nombre || 'Sin nombre'}</h4>
      <div class="price">${fmtMoney(p.precio)}</div>
      <div class="stock">${p.stock > 0 ? 'Stock: ' + p.stock : 'Agotado'}</div>
      <a href="https://wa.me/50431517755?text=Hola,%20quiero%20comprar%20${encodeURIComponent(p.nombre || 'producto')}" target="_blank" class="btn primary">Comprar por WhatsApp</a>
    </div>
  `;
}

async function loadAndRender() {
  try {
    const prods = await fetchProducts();
    const grid = $("#grid");
    if (grid) {
      grid.innerHTML = prods.map(renderCard).join('');
    }
  } catch (e) {
    console.error(e);
    $("#grid").innerHTML = '<p style="text-align:center;color:red;">Error al cargar productos. Revisa consola (F12).</p>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();

  $("#goCats")?.addEventListener("click", () => alert("Sección Categorías (próximamente)"));
  $("#goAll")?.addEventListener("click", loadAndRender);
  $("#catsBtn")?.addEventListener("click", () => alert("Menú de categorías"));
  $("#adminBtn")?.addEventListener("click", () => location.href = "admin.html");
});
