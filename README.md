# SD-Comayagua – Tienda PRO (GitHub Pages + Apps Script + Sheets)

Este paquete incluye:

- `frontend/` → tienda (GitHub Pages) + panel Admin en `/admin/`
- `backend/` → Apps Script (múltiples .gs)
- `demo/` → datos demo para pegar en Sheets

## 1) Google Sheets (estructura)
Crea un Google Sheet con 3 hojas EXACTAS:

### Hoja: `productos`
Columnas (fila 1):
id,nombre,categoria,subcategoria,subsubcategoria,marca,precio,stock,activo,tags,descripcion,img,galeria_1,galeria_2,galeria_3,galeria_4,galeria_5,galeria_6,galeria_7,galeria_8,video_url,tiktok_url,youtube_url,facebook_url,oferta,nuevo,created_at

### Hoja: `envios`
Columnas:
id,zona,costo,activo,nota

### Hoja: `ajustes`
Columnas (key/value):
id,key,value

> `ajustes` guarda recargos como:
- id = METODO_PREPAGO, key = METODO_PREPAGO, value = 0
- id = METODO_PAGAR AL RECIBIR, key = METODO_PAGAR AL RECIBIR, value = 0

## 2) Apps Script (backend)
1. Entra a https://script.google.com
2. Nuevo proyecto → pega los archivos de `/backend/` (crea 1 archivo por cada .gs).
3. Edita en `Code.gs`:
   - `SS_ID` = tu Sheet ID
   - `ADMIN_KEY` = tu clave secreta
4. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copia la URL (termina en `/exec`).

Endpoints GET:
- `...?only=productos`
- `...?only=envios`
- `...?only=ajustes`
- `...?only=taxonomia`

POST protegido:
- `...?action=updateProduct`
- `...?action=deleteProduct`
- `...?action=duplicateProduct`
- `...?action=updateShipping`
- `...?action=deleteShipping`
- `...?action=updateSettings`

## 3) GitHub Pages (frontend)
1. Crea repo en GitHub (público recomendado para Pages).
2. Sube TODO el contenido de `/frontend/` a la raíz del repo.
3. Edita `frontend/js/config.js`:
   - `API_BASE` = URL del Web App (Apps Script).
4. En GitHub: Settings → Pages:
   - Source: Deploy from a branch
   - Branch: `main` / root
5. Abre tu URL de Pages.

Admin:
- `https://TUUSUARIO.github.io/TUREPO/admin/`
- Pega `API_BASE` y tu `ADMIN_KEY` (no se guarda en el backend).

## 4) Deep links / Compartir
- Producto: `?p=IDPRODUCTO`
- Categoría: `?cat=Tecnologia`
- Subcategoría: `?cat=Tecnologia&sub=Audifonos`
- Búsqueda: `?q=usb`
- Chips: `?chip=Gamer`
- Orden: `?sort=price_asc`

## Notas
- Facebook/WhatsApp preview (OG) en GitHub Pages será genérico (limitación de sitios estáticos). El link igual abre el producto exacto en la web.
