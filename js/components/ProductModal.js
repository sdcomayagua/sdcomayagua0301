import { el } from "../utils/dom.js";
import { moneyLps, firstNonEmpty, safeText } from "../utils/format.js";
import { sanitizeHtml } from "../utils/sanitize.js";

function buildGallery(p){
  const imgs = [p.img, ...(p.galeria||[])].map(x=>String(x||"").trim()).filter(Boolean);
  if (!imgs.length) imgs.push("./assets/logo-bw.png");

  let active = imgs[0];
  const mainImg = el("img",{src:active, alt:safeText(p.nombre||"Producto")});
  const main = el("div",{class:"gallery-main"},[mainImg]);

  const thumbs = el("div",{class:"thumbs"}, imgs.map((src,idx)=>{
    const b = el("button",{type:"button","data-active": String(idx===0), onclick:()=>{
      active = src;
      mainImg.src = src;
      [...thumbs.children].forEach((x,i)=>x.setAttribute("data-active", String(i===idx)));
    }},[ el("img",{src, alt:"Miniatura"}) ]);
    return b;
  }));

  return el("div",{class:"gallery"},[main, thumbs]);
}

function linkIcons(p){
  const links = [];
  const add = (label, url)=>{
    if (!url) return;
    links.push(el("a",{href:url, target:"_blank", rel:"noopener"},[label]));
  };
  add("TikTok", p.tiktok_url);
  add("YouTube", p.youtube_url);
  add("Facebook", p.facebook_url);
  add("Video", p.video_url);
  return links.length ? el("div",{class:"links"},links) : null;
}

function embedYouTube(url){
  if (!url) return null;
  const m = String(url).match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|\&|$)/);
  if (!m) return null;
  const id = m[1];
  return el("div",{style:"margin-top:12px;border:1px solid var(--line);border-radius:18px;overflow:hidden"},[
    el("iframe",{
      width:"100%", height:"260",
      src:`https://www.youtube-nocookie.com/embed/${id}`,
      title:"YouTube video",
      frameborder:"0",
      allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      allowfullscreen:"allowfullscreen"
    })
  ]);
}

export function openProductModal(p, { onClose, onAdd, onShare }){
  const title = safeText(p.nombre || "Producto");
  const inStock = Number(p.stock||0) > 0 && String(p.activo||"1") !== "0";
  const desc = sanitizeHtml(p.descripcion || "");

  const overlay = el("div",{class:"overlay", onclick:(e)=>{ if(e.target===overlay) close(); }});
  const close = ()=>{
    overlay.remove();
    onClose?.();
  };

  const body = el("div",{class:"sheet"},[
    el("div",{class:"sheet-header"},[
      el("h2",{},[title]),
      el("button",{class:"close", type:"button", onclick:close},["✕"])
    ]),
    el("div",{class:"sheet-body"},[
      el("div",{class:"product-modal"},[
        buildGallery(p),
        el("div",{},[
          el("div",{class:"kv"},[
            p.marca ? el("div",{class:"tag"},[`Marca: ${safeText(p.marca)}`]) : null,
            p.categoria ? el("div",{class:"tag"},[safeText(p.categoria)]) : null,
            p.subcategoria ? el("div",{class:"tag"},[safeText(p.subcategoria)]) : null,
            p.tags ? el("div",{class:"tag"},[safeText(p.tags)]) : null,
          ].filter(Boolean)),
          el("div",{style:"margin-top:10px;font-size:20px;font-weight:900"},[moneyLps(p.precio)]),
          el("div",{style:"margin-top:6px;color:var(--muted);font-size:13px"},[
            inStock ? `Disponible (${Number(p.stock||0)} en stock)` : "Agotado"
          ]),
          el("div",{style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"},[
            el("button",{class:"btn primary", type:"button", disabled: !inStock, onclick:()=>onAdd(p)},[ inStock ? "Agregar al carrito" : "No disponible" ]),
            el("button",{class:"btn", type:"button", onclick:()=>onShare(p)},["Compartir"])
          ]),
          desc ? el("div",{class:"desc", innerHTML: desc }) : el("div",{class:"desc"},["Sin descripción por ahora."]),
          linkIcons(p),
          embedYouTube(p.youtube_url || p.video_url)
        ])
      ])
    ])
  ]);

  overlay.appendChild(body);
  document.getElementById("portal").appendChild(overlay);

  return { close };
}
