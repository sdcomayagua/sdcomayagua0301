// ✅ CONFIGURA AQUÍ TU WEB APP (Apps Script) CUANDO LA PUBLIQUES
// Ejemplo: https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec

window.SDCFG = {
  appName: "Soluciones Digitales Comayagua",
  brandShort: "SD-Comayagua",
  currency: "Lps.",
  whatsappDisplay: "+504 3151-7755",
  whatsappNumber: "50431517755",

  // ⬇️ Pega aquí tu URL de Web App (deploy) del Apps Script que expone ?only=productos
  apiBase: "https://script.google.com/macros/s/AKfycbwrSyQN6wpropSjTdXc4p6Grnw7fUwWMVLObD_ReV4vt0R07xmLuZWeVZHFwk1YkRRoTA/exec",

  // Si Blogger te bloquea CORS, usa JSONP (tu backend v3 ya trae soporte)
  preferJsonp: true,

  // Parámetros de carga
  onlyActive: true,
  onlyInStockDefault: false
};
