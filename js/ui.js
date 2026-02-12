// js/ui.js
let products = [];
let taxonomia = [];
let currentCategory = null;

function getEmojiForCategory(cat) {
    const lowerCat = cat.toLowerCase();
    for (const [key, emoji] of Object.entries(CONFIG.EMOJI_MAP)) {
        if (lowerCat.includes(key)) return emoji;
    }
    return CONFIG.EMOJI_MAP.default;
}

function renderProducts(filteredProducts = products) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';
    filteredProducts.forEach((prod, index) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        card.style.animationDelay = `${index * 0.08}s`;
        card.innerHTML = `
            <img src="${prod.imagenes[0] || CONFIG.PLACEHOLDER_IMAGE}" alt="${prod.nombre}" onerror="this.src='${CONFIG.PLACEHOLDER_IMAGE}'">
            <h3>${prod.nombre}</h3>
            <span class="stock-badge ${prod.stock > 0 ? '' : 'no-stock'}">${prod.stock > 0 ? 'Disponible' : 'Sin stock'}</span>
            <span class="share-icon" onclick="event.stopPropagation(); shareProduct('${prod.id}')">🔗</span>
        `;
        card.onclick = () => openProductModal(prod);
        grid.appendChild(card);
    });
    document.getElementById('loading').style.display = 'none';
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    taxonomia.forEach(cat => {
        if (cat.subcategorias && cat.subcategorias.length > 0) {
            cat.subcategorias.forEach(sub => {
                const card = document.createElement('div');
                card.classList.add('category-card');
                card.innerHTML = `${getEmojiForCategory(sub)} ${sub}`;
                card.onclick = () => filterByCategory(sub);
                grid.appendChild(card);
            });
        } else {
            const card = document.createElement('div');
            card.classList.add('category-card');
            card.innerHTML = `${getEmojiForCategory(cat.categoria)} ${cat.categoria}`;
            card.onclick = () => filterByCategory(cat.categoria);
            grid.appendChild(card);
        }
    });
}

function filterByCategory(category) {
    currentCategory = category;
    const filtered = products.filter(p => p.categoria === category || p.subcategoria === category);
    renderProducts(filtered);
    closeModal('categoriesModal');
}

function openProductModal(prod) {
    document.getElementById('productName').textContent = prod.nombre;
    document.getElementById('productCategory').textContent = `${prod.categoria} / ${prod.subcategoria || ''}`;
    document.getElementById('productPrice').textContent = `${CONFIG.CURRENCY} ${prod.precio}`;
    document.getElementById('productStock').textContent = `Stock: ${prod.stock}`;
    document.getElementById('productDescription').textContent = prod.descripcion || 'Sin descripción detallada.';

    const mainImg = document.getElementById('mainImage');
    mainImg.classList.remove('loaded');
    mainImg.src = prod.imagenes[0] || CONFIG.PLACEHOLDER_IMAGE;
    mainImg.onload = () => mainImg.classList.add('loaded');

    const thumbsContainer = document.querySelector('.thumbnails');
    thumbsContainer.innerHTML = '';
    (prod.imagenes.length ? prod.imagenes : [CONFIG.PLACEHOLDER_IMAGE]).forEach((imgSrc, index) => {
        const thumb = document.createElement('img');
        thumb.classList.add('thumbnail');
        thumb.src = imgSrc;
        thumb.alt = `Miniatura ${index + 1}`;
        thumb.style.animationDelay = `${index * 0.1}s`;
        thumb.classList.add('loaded'); // Para activar animación de entrada
        thumb.onclick = () => {
            mainImg.classList.remove('loaded');
            mainImg.src = imgSrc;
            mainImg.onload = () => mainImg.classList.add('loaded');
            document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        };
        if (index === 0) thumb.classList.add('active');
        thumbsContainer.appendChild(thumb);
    });

    document.getElementById('buyWhatsAppBtn').onclick = () => buyOnWhatsApp(prod);
    document.getElementById('shareBtn').onclick = () => shareProduct(prod.id);
    const videoBtn = document.getElementById('videoBtn');
    if (prod.video_url) {
        videoBtn.style.display = 'inline-block';
        videoBtn.onclick = () => window.open(prod.video_url, '_blank');
    } else {
        videoBtn.style.display = 'none';
    }

    openModal('productModal');
    history.pushState(null, '', `?product=${prod.id}`);
}

function buyOnWhatsApp(prod) {
    const message = encodeURIComponent(`Hola SDComayagua 👋 Quiero comprar este producto:\n- Nombre: ${prod.nombre}\n- Precio: ${CONFIG.CURRENCY} ${prod.precio}\n- Stock: ${prod.stock}\n- Categoría: ${prod.categoria}/${prod.subcategoria || ''}\n- Link: ${window.location.origin}${window.location.pathname}?product=${prod.id}`);
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
}

function shareProduct(id) {
    const url = `${window.location.origin}${window.location.pathname}?product=${id}`;
    navigator.clipboard.writeText(url).then(() => alert('¡Enlace copiado al portapapeles!'));
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showMessage(msg, type = 'info') {
    alert(msg); // Puedes mejorar con un toast más adelante
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    document.getElementById('themeToggleBtn').textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

async function initApp() {
    document.getElementById('loading').style.display = 'block';
    try {
        [products, taxonomia] = await Promise.all([getProducts(), getTaxonomia()]);
        renderProducts();
        renderCategories();
    } catch (err) {
        console.error(err);
        document.getElementById('loading').textContent = 'Error al cargar. Intenta recargar.';
    }

    document.getElementById('searchInput').addEventListener('input', e => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = products.filter(p => p.nombre.toLowerCase().includes(term));
        renderProducts(filtered);
    });

    document.getElementById('categoriesBtn').onclick = () => openModal('categoriesModal');
    document.getElementById('adminBtn').onclick = () => openModal('adminLoginModal');
    document.getElementById('themeToggleBtn').onclick = toggleTheme;

    document.querySelectorAll('.close').forEach(el => {
        el.onclick = () => closeModal(el.closest('.modal').id);
    });

    // Deep link product
    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('product');
    if (prodId) {
        const prod = products.find(p => p.id === prodId);
        if (prod) openProductModal(prod);
    }

    // Header shadow
    window.addEventListener('scroll', () => {
        document.querySelector('header').classList.toggle('scrolled', window.scrollY > 20);
    });
}
