export function getQuery(){
  const u = new URL(window.location.href);
  const q = {};
  for (const [k,v] of u.searchParams.entries()) q[k]=v;
  return q;
}

export function setQuery(params, { replace=false } = {}){
  const u = new URL(window.location.href);
  Object.entries(params).forEach(([k,v])=>{
    if (v === undefined || v === null || v === "") u.searchParams.delete(k);
    else u.searchParams.set(k, String(v));
  });
  if (replace) history.replaceState(history.state, "", u.toString());
  else history.pushState(history.state, "", u.toString());
}

export function buildShareUrl(params){
  const u = new URL(window.location.origin + window.location.pathname);
  Object.entries(params).forEach(([k,v])=>{ if (v) u.searchParams.set(k,String(v)); });
  return u.toString();
}
