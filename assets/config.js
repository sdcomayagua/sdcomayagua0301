/**
 * Configuración base de la tienda SDComayagua
 * Puedes cambiar valores desde el panel Admin → Configuración (se guarda en localStorage del navegador)
 */
window.SDCO_DEFAULTS = {
  "APP_NAME": "Soluciones Digitales Comayagua",
  "SHORT_NAME": "SDComayagua",
  "WHATSAPP_DISPLAY": "+504 3151-7755",
  "WHATSAPP_NUMBER": "50431517755",
  "API_BASE_DEFAULT": "https://script.google.com/macros/s/AKfycbya37aSm80xgzd7mh4mG87_gRZzvl55xl4gt3X5hyCPvUeDg6chLJq7Qn97n_aqS3nI/exec",
  "CURRENCY": "Lps.",
  "LOCALE": "es-HN"
};

console.log("config.js cargado – API usada:", window.SDCO_DEFAULTS.API_BASE_DEFAULT);
