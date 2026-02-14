SD-Comayagua | Catálogo Premium (Blogger / Web)

✅ 1) Publicar tu backend (Apps Script)
- En tu Apps Script (v3), ve a: Deploy > New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone
- Copia la URL que termina en /exec

✅ 2) Pegar URL en la web
- Si usarás GitHub Pages / Hosting:
  - Abre js/config.js y pega la URL en apiBase

- Si usarás Blogger:
  - Usa el archivo BLOGGER_PAGE_CODE.html
  - Dentro del script busca apiBase: "PEGA_TU_WEB_APP_AQUI" y pega tu URL

✅ 3) Fotos 1200x1200
- El frontend fuerza links de googleusercontent/blogger a /s1200/ automáticamente
- En tu hoja productos, pon foto_url lo más grande posible.

📌 Endpoints esperados (v3 backend):
- JSON normal:  ?only=productos&active=1
- JSONP:        ?only=productos&active=1&format=jsonp&callback=miFuncion
