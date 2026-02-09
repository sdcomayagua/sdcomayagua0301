SDComayagua Tienda PRO (Preconfigurada)

✅ Ya viene configurada con:
- Sheet_ID: 137zlNBENZF1N8w_dZbh0OF1PEhQJ9GHlY7d_r7Shsso
- WebApp (API_BASE): https://script.google.com/macros/s/AKfycbya37aSm80xgzd7mh4mG87_gRZzvl55xl4gt3X5hyCPvUeDg6chLJq7Qn97n_aqS3nI/exec

PASOS RÁPIDOS:

1) Google Sheets
   - Crea/abre tu sheet con ID arriba.
   - Asegúrate de tener una hoja llamada: productos
     con columnas:
     id, nombre, categoria, subcategoria, marca, precio, stock, activo, descripcion,
     img, galeria_1..galeria_8, video_url

2) Apps Script
   - Abre Apps Script del mismo sheet (Extensiones → Apps Script)
   - Pega TODO el contenido de AppsScript_Code_gs.txt en Code.gs
   - Cambia:
        const ADMIN_KEY = "CAMBIA_ESTA_CLAVE";
     por una clave tuya.
   - Deploy → New deployment → Web app:
        Execute as: Me
        Who has access: Anyone
   - Copia la URL /exec (ya tienes una; úsala si es la misma).

3) Web (Tienda)
   - Sube los archivos (index.html, admin.html y carpeta assets) a tu hosting / GitHub Pages / Netlify.
   - Abre index.html → ya debe cargar productos automáticamente.
   - Abre admin.html → pega tu ADMIN_KEY y administra sin tocar código.

NOTA:
- Si tu WebApp URL cambia, en la tienda puedes tocar “Config” y pegar la nueva sin editar archivos.
