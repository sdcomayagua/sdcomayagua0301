/**
 * SDComayagua – Configuración base
 * Puedes guardar overrides así (en consola):
 * localStorage.setItem('SDCO_CFG', JSON.stringify({ API_BASE:'TU_URL', WHATSAPP_NUMBER:'504...' }))
 */
window.SDCO_DEFAULTS = {
  APP_NAME: "Soluciones Digitales Comayagua",
  SHORT_NAME: "SDComayagua",
  WHATSAPP_DISPLAY: "+504 3151-7755",
  WHATSAPP_NUMBER: "50431517755",
  // ⚠️ IMPORTANTE: este debe ser el *NUEVO* WebApp (Deploy) que soporta doPost (guardar desde Admin).
  // Pegá aquí tu URL que termina en /exec
  API_BASE_DEFAULT: "PASTE_YOUR_NEW_WEBAPP_EXEC_URL_HERE",
  CURRENCY: "Lps.",
  LOCALE: "es-HN",
  THEME_DEFAULT: "light" // light | dark
};

try{
  const saved = JSON.parse(localStorage.getItem("SDCO_CFG")||"null");
  if(saved && typeof saved === "object"){
    window.SDCO_DEFAULTS = { ...window.SDCO_DEFAULTS, ...saved };
  }
}catch(e){}

console.log("SDComayagua → API:", (window.SDCO_DEFAULTS.API_BASE || window.SDCO_DEFAULTS.API_BASE_DEFAULT));
