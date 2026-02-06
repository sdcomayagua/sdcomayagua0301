export function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k==="class") node.className = v;
    else if (k==="html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v===null || v===undefined || v===false) {}
    else node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)){
    if (c===null || c===undefined) continue;
    node.appendChild(typeof c==="string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function toast(msg){
  const t = el("div",{class:"card", style:"position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:70;max-width:92vw;padding:10px 12px;border-radius:999px"},[msg]);
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

export function modal({ title, content, actions }){
  const overlay = el("div",{class:"overlay", onclick:(e)=>{ if(e.target===overlay) overlay.remove(); }});
  const sheet = el("div",{class:"sheet"},[
    el("div",{class:"sheethead"},[
      el("strong",{},[title||""]),
      el("button",{class:"btn", type:"button", onclick:()=>overlay.remove()},["✕"])
    ]),
    el("div",{class:"sheetbody"},[content]),
    actions ? el("div",{class:"sheetbody", style:"padding-top:0;display:flex;gap:10px;flex-wrap:wrap"}, actions) : null
  ].filter(Boolean));
  overlay.appendChild(sheet);
  document.getElementById("portal").appendChild(overlay);
  return { close: ()=>overlay.remove() };
}
