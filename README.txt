# README.md

## Configuración y Despliegue

### 1. Cambiar API_BASE y WhatsApp
- Abre `js/config.js`
- Actualiza `API_BASE` con tu URL de Apps Script.
- Actualiza `WHATSAPP_NUMBER` con tu número sin '+'.
- Actualiza `ADMIN_KEY` con tu clave secreta.

### 2. Subir a GitHub Pages
- Crea un repo en GitHub (ej: sdcomayagua0301).
- Sube todos los archivos manteniendo la estructura (/css, /js, /assets).
- En Settings > Pages, selecciona branch 'main' y root.
- Accede via https://tuusuario.github.io/sdcomayagua0301/

### 3. Publicar Apps Script como Web App
- Abre tu Google Apps Script.
- Ve a Deploy > New Deployment > Type: Web App.
- Ejecutar como: Me (tu cuenta).
- Quién tiene acceso: Anyone (o ajusta según necesidad).
- Copia la URL y ponla en `API_BASE` en config.js.

### Notas
- Asegúrate de que el Sheets ID esté correcto en Apps Script.
- Para assets: sube tu logo.png y placeholder.png a /assets/.
- Prueba en Android y PC para verificar responsividad.
