// js/router.js
let suppressUrlSync = false;

export function getQuery() {
  const url = new URL(window.location.href);
  const q = {};
  for (const [k, v] of url.searchParams.entries()) q[k] = v;
  return q;
}

export function setQuery(params, { replace = false } = {}) {
  if (suppressUrlSync) return;

  const url = new URL(window.location.href);

  // aplica params
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  });

  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");

  const current = window.location.pathname + window.location.search;

  // ✅ Evita bucles infinitos
  if (next === current) return;

  if (replace) history.replaceState({}, "", next);
  else history.pushState({}, "", next);
}

export function onPopState(cb) {
  window.addEventListener("popstate", () => {
    // evita re-entradas
    suppressUrlSync = true;
    try {
      cb(getQuery());
    } finally {
      suppressUrlSync = false;
    }
  });
}
