import { el } from "../utils/dom.js";
import { buildShareUrl } from "../utils/url.js";
import { toast } from "./Toast.js";
import { CONFIG } from "../config.js";

export function openShareModal({ title, params, textShort }){
  const url = buildShareUrl(params);

  const waText = encodeURIComponent(`${textShort}\n${url}`);
  const waHref = `https://wa.me/?text=${waText}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(textShort)}`;
  const xHref  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(textShort)}&url=${encodeURIComponent(url)}`;

  const overlay = el("div",{class:"overlay", onclick:(e)=>{ if(e.target===overlay) overlay.remove(); }},[
    el("div",{class:"sheet"},[
      el("div",{class:"sheet-header"},[
        el("h2",{},[title || "Compartir"]),
        el("button",{class:"close", type:"button", onclick:()=>overlay.remove()},["✕"])
      ]),
      el("div",{class:"sheet-body"},[
        el("p",{},["Comparte este enlace. Abre el mismo producto/filtro en la web."]),
        el("div",{style:"display:flex;gap:10px;flex-wrap:wrap;margin:12px 0"},[
          el("a",{class:"btn primary", href:waHref, target:"_blank", rel:"noopener"},["WhatsApp"]),
          el("button",{class:"btn", type:"button", onclick: async ()=>{
            try{
              await navigator.clipboard.writeText(url);
              toast("Copiado", "Enlace copiado al portapapeles");
            }catch{
              toast("No se pudo copiar", "Copia manualmente el enlace");
            }
          }},["Copiar enlace"]),
          el("a",{class:"btn", href:fbHref, target:"_blank", rel:"noopener"},["Facebook"]),
          el("a",{class:"btn", href:tgHref, target:"_blank", rel:"noopener"},["Telegram"]),
          el("a",{class:"btn", href:xHref, target:"_blank", rel:"noopener"},["X"])
        ]),
        el("div",{style:"margin-top:12px"},[
          el("div",{class:"field"},[
            el("label",{},["Enlace"]),
            el("input",{value:url, readonly:"readonly"})
          ])
        ]),
        el("p",{style:"margin-top:12px;color:var(--muted);font-size:12px"},[
          `WhatsApp de la tienda: ${CONFIG.WHATSAPP_DISPLAY}`
        ])
      ])
    ])
  ]);
  document.getElementById("portal").appendChild(overlay);
}
