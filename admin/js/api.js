export async function apiGet(base, only){
  const url = base.includes("?") ? `${base}&only=${encodeURIComponent(only)}` : `${base}?only=${encodeURIComponent(only)}`;
  const res = await fetch(url, { headers: { "Accept":"application/json" }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function apiPost(base, action, payload){
  const url = base.includes("?") ? `${base}&action=${encodeURIComponent(action)}` : `${base}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method:"POST",
    headers: { "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(()=>({ ok:false, error:"Respuesta inválida" }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
