SDComayagua Tienda PRO (Preconfigurada)

✅ Ya viene lista, solo falta pegar TU URL nueva del WebApp (/exec).
   (La URL anterior no guardaba desde Admin porque no tenía doPost)

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

   IMPORTANTE:
   - Edita assets/config.js y reemplaza:
       API_BASE_DEFAULT: "PASTE_YOUR_NEW_WEBAPP_EXEC_URL_HERE"
     por tu nueva URL del WebApp que termina en /exec

   - Si antes guardaste configuración en el navegador, bórrala para que tome el nuevo API:
       localStorage.removeItem('SDCO_CFG')
       localStorage.removeItem('SDCO_ADMIN_KEY')

NOTA:
- Si tu WebApp URL cambia, en la tienda puedes tocar “Config” y pegar la nueva sin editar archivos.
