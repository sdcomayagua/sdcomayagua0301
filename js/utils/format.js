import { CONFIG } from "../config.js";

export function moneyLps(value){
  const n = Number(value || 0);
  try{
    return new Intl.NumberFormat(CONFIG.LOCALE, { style:"currency", currency:"HNL", maximumFractionDigits:0 }).format(n);
  }catch{
    return `${CONFIG.CURRENCY} ${Math.round(n)}`;
  }
}

export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

export function safeText(s){ return String(s ?? "").replace(/\s+/g," ").trim(); }

export function firstNonEmpty(...vals){
  for (const v of vals){
    const t = safeText(v);
    if (t) return t;
  }
  return "";
}
