/* SDComayagua — api.js
   - Robust fetch with timeout + soft retry
   - GET uses cache-busting (?t=Date.now())
   - POST uses x-www-form-urlencoded to avoid CORS preflight
*/
(function(){
  const CFG = window.SDCO_CONFIG;

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function fetchWithTimeout(url, options, timeoutMs){
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try{
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  async function safeReadText(res){
    try { return await res.text(); }
    catch(e){ return ""; }
  }

  function asError(code, message, details){
    const err = new Error(message || "Error");
    err.code = code || "ERR";
    err.details = details;
    return err;
  }

  async function fetchJSON(url, options){
    const timeoutMs = (options && options.timeoutMs) || 14000;
    const retries = (options && options.retries) ?? 1;
    const retryDelay = (options && options.retryDelay) || 600;

    const cleanOpts = { ...options };
    delete cleanOpts.timeoutMs;
    delete cleanOpts.retries;
    delete cleanOpts.retryDelay;

    let lastErr;
    for (let attempt=0; attempt<=retries; attempt++){
      try{
        const res = await fetchWithTimeout(url, cleanOpts, timeoutMs);
        const txt = await safeReadText(res);
        if (!res.ok){
          throw asError("HTTP_"+res.status, "Servidor respondió con error", { status: res.status, body: txt.slice(0, 600) });
        }

        const cleaned = (txt || "").trim();

        // Algunas veces Apps Script puede devolver HTML/Texto si no retorna JSON
        if (!cleaned.startsWith("{") && !cleaned.startsWith("[")){
          throw asError("BAD_JSON", "Respuesta no es JSON. Revisa el Web App/Deployment.", { body: cleaned.slice(0, 600) });
        }

        const data = JSON.parse(cleaned);
        return data;
      } catch (err){
        lastErr = err;
        const isAbort = (err && err.name === "AbortError");
        const isNetwork = (err && String(err.message||"").toLowerCase().includes("failed to fetch"));
        const shouldRetry = attempt < retries && (isAbort || isNetwork || err.code === "HTTP_429");
        if (shouldRetry){
          await sleep(retryDelay * (attempt+1));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr || asError("UNKNOWN", "Error desconocido");
  }

  function toFormBody(obj){
    const params = new URLSearchParams();
    Object.keys(obj || {}).forEach(k => {
      const v = obj[k];
      if (v === undefined || v === null) return;
      params.set(k, String(v));
    });
    return params.toString();
  }

  const Api = {
    async getOnly(only){
      const base = CFG.API_BASE;
      const url = base + "?only=" + encodeURIComponent(only) + "&t=" + Date.now();
      return fetchJSON(url, { method: "GET", retries: 1, timeoutMs: 14000 });
    },

    async getProductos(){ return this.getOnly("productos"); },
    async getEnvios(){ return this.getOnly("envios"); },
    async getTaxonomia(){ return this.getOnly("taxonomia"); },

    async postAction(action, payload, adminKey){
      const body = toFormBody({ action, admin_key: adminKey, ...payload });
      // Importante: form-urlencoded (simple request) evita preflight OPTIONS
      return fetchJSON(CFG.API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        retries: 2,
        timeoutMs: 16000
      });
    }
  };

  window.SDCO_Api = Api;
})();
