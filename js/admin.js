// js/admin.js
let adminProducts = [];

async function loginAdmin() {
    const key = document.getElementById('adminKeyInput').value;
    if (key !== CONFIG.ADMIN_KEY) {
        showMessage('Clave incorrecta', 'error');
        return;
    }
    closeModal('adminLoginModal');
    openModal('adminPanelModal');
    adminProducts = await getProducts(); // Reuse getProducts
    renderAdminProducts();
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductGrid');
    grid.innerHTML = '';
    adminProducts.forEach(prod => {
        const card = document.createElement('div');
        card.classList.add('admin-product-card');
        card.innerHTML = `
            <h3>${prod.nombre}</h3>
            <p>Precio: ${prod.precio}</p>
            <p>Stock: ${prod.stock}</p>
            <div class="admin-actions">
                <button onclick="editProduct('${prod.id}')">Editar</button>
                <button onclick="duplicateProductAdmin('${prod.id}')">Duplicar</button>
                <button onclick="toggleActive('${prod.id}', ${prod.active})">${prod.active ? 'Desactivar' : 'Activar'}</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function editProduct(id) {
    const prod = adminProducts.find(p => p.id === id);
    const form = document.getElementById('editProductForm');
    form.innerHTML = `
        <input type="hidden" name="id" value="${prod.id}">
        <label>Nombre: <input name="nombre" value="${prod.nombre}"></label>
        <label>Precio: <input name="precio" value="${prod.precio}" type="number"></label>
        <label>Stock: <input name="stock" value="${prod.stock}" type="number"></label>
        <label>Descripción: <textarea name="descripcion">${prod.descripcion}</textarea></label>
        <!-- Add other fields as needed -->
    `;
    openModal('editProductModal');
    document.getElementById('saveProductBtn').onclick = () => saveProduct();
}

async function saveProduct() {
    const form = document.getElementById('editProductForm');
    const data = {};
    form.querySelectorAll('input, textarea').forEach(el => {
        if (el.name && el.value !== '') data[el.name] = el.value;
    });
    try {
        const result = await updateProduct(data);
        showMessage(result.message || 'Guardado exitosamente');
        closeModal('editProductModal');
        // Refresh products
        products = await getProducts();
        renderProducts();
        adminProducts = products;
        renderAdminProducts();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function duplicateProductAdmin(id) {
    try {
        await duplicateProduct(id);
        adminProducts = await getProducts();
        renderAdminProducts();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function toggleActive(id, currentActive) {
    try {
        await setActive(id, !currentActive);
        adminProducts = await getProducts();
        renderAdminProducts();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Init admin login
document.getElementById('loginAdminBtn').onclick = loginAdmin;
