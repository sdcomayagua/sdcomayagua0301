# SDComayagua — Catálogo PREMIUM (GitHub Pages + Apps Script)

Este ZIP trae un **frontend premium** (HTML/CSS/JS puro) y un **backend Apps Script** mejorado para que:

- ✅ En Android no se quede en “Cargando…”
- ✅ Productos en **grid 2 por fila** en móvil, tarjetas compactas (imagen 1:1 + nombre)
- ✅ Modal de producto **NO se corta** (90vh + scroll interno + footer fijo)
- ✅ Admin **sin scroll horizontal**, acciones abajo
- ✅ Admin usa **POST form-urlencoded** para evitar “Failed to fetch” por preflight CORS
- ✅ Cache-busting en GET + purgeCache_ en backend
- ✅ Compartir link + mensaje WhatsApp premium con link del producto

---

## 1) Configuración rápida (Frontend)

Edita solo: `js/config.js`

- `API_BASE`: URL del Web App (Apps Script)
- `WHATSAPP_NUMBER`: 50431517755
- `WHATSAPP_DISPLAY`: +504 3151-7755

Luego sube a GitHub Pages.

---

## 2) Publicar en GitHub Pages

1. Crea repositorio (ej: `sdcomayagua0301`)
2. Sube estos archivos tal cual (mantén carpetas `css/`, `js/`, `assets/`)
3. En GitHub: **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` y carpeta `/root`
4. Tu web quedará en: `https://TUUSUARIO.github.io/sdcomayagua0301/`

> Nota: Este frontend funciona bien dentro de subcarpetas (GitHub Pages) porque usa rutas relativas.

---

## 3) Backend Apps Script (Recomendado)

En carpeta: `apps-script/Code.gs`

### Pasos

1. Ve a Google Apps Script y crea un proyecto nuevo.
2. Pega el contenido de `apps-script/Code.gs` en `Code.gs`
3. Cambia:
   - `SS_ID` por tu **Sheet ID**
   - `ADMIN_KEY` por tu clave real (NO la compartas)
4. Deploy:
   - **Deploy → New deployment**
   - Type: Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copia el link del Web App y pégalo en `js/config.js` como `API_BASE`.

### Probar rápido

En el navegador, abre:

- `TU_WEB_APP_URL?only=productos`
- `TU_WEB_APP_URL?only=envios`

Debe responder JSON con `ok:true`.

---

## 4) Admin (móvil)

- Abre la web → botón **Admin** (ícono)
- Ingresa tu `ADMIN_KEY`
- Edita stock, precio, etc.

### Importante (para evitar “precio obligatorio”)
El frontend **solo envía los campos que cambias**.  
Si solo cambias stock, **NO envía precio**, y el backend no lo exige.

---

## 5) Si algo queda en “Cargando…”

Causas típicas:
- Web App no está como **Anyone**
- Pegaste mal `API_BASE`
- El Web App está publicado con un deployment viejo (vuelve a deploy)

El frontend muestra el motivo y un botón “Reintentar”.

---

## Estructura

- `index.html`
- `css/styles.css`
- `js/config.js`
- `js/api.js`
- `js/ui.js`
- `js/admin.js`
- `assets/logo.svg`
- `assets/placeholder.svg`
- `apps-script/Code.gs`

---

## Personalización de logo/placeholder

Reemplaza:
- `assets/logo.svg`
- `assets/placeholder.svg`

Mantén los nombres para no tocar código.

¡Listo!
