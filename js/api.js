// js/api.js
async function fetchData(endpoint, params = {}) {
    const url = new URL(CONFIG.API_BASE);
    url.searchParams.append('t', Date.now()); // Cache busting
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }
    try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!response.ok) throw new Error('Network error');
        return await response.json();
    } catch (error) {
        console.error(error);
        showMessage('Error al cargar datos. Reintentando...', 'error');
        await new Promise(r => setTimeout(r, 2000));
        return fetchData(endpoint, params); // Retry once
    }
}

async function postData(action, data) {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('adminKey', CONFIG.ADMIN_KEY);
    for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
    }
    try {
        const response = await fetch(CONFIG.API_BASE, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getProducts() {
    return fetchData('', { only: 'productos' });
}

async function getTaxonomia() {
    return fetchData('', { only: 'taxonomia' });
}

async function updateProduct(productData) {
    return postData('updateProduct', productData);
}

async function duplicateProduct(id) {
    return postData('duplicateProduct', { id });
}

async function setActive(id, active) {
    return postData('setActive', { id, active });
}
