import { CONFIG } from "../config.js";
import { storage } from "../utils/storage.js";

async function httpGet(url){
  const res = await fetch(url, { headers: { "Accept":"application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function cacheKey(key){ return `SDC_CACHE_${key}`; }

export async function fetchResource(resource){
  const now = Date.now();
  const cached = storage.get(cacheKey(resource), null);
  if (cached && (now - cached.t) < CONFIG.CACHE_TTL_MS) return cached.v;

  const base = CONFIG.API_BASE;
  if (!base || base.includes("PASTE_YOUR_WEBAPP_URL_HERE")) {
    throw new Error("Configura CONFIG.API_BASE en frontend/js/config.js");
  }

  // soporta ambos estilos: ?only=productos o ?resource=productos
  const url = base.includes("?")
    ? `${base}&only=${encodeURIComponent(resource)}`
    : `${base}?only=${encodeURIComponent(resource)}`;

  const data = await httpGet(url);
  storage.set(cacheKey(resource), { t: now, v: data });
  return data;
}

export function invalidateCache(){
  ["productos","envios","ajustes","taxonomia"].forEach(r=>storage.del(cacheKey(r)));
}
