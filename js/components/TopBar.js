import { CONFIG } from "../config.js";
import { el } from "../utils/dom.js";
import { Store } from "../state/store.js";

function icon(path){
  const svg = el("span",{ "aria-hidden":"true" });
  svg.innerHTML = path;
  return svg;
}

const ICONS = {
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" stroke="currentColor" stroke-width="2"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2"/></svg>',
  cart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6h15l-2 9H7L6 6Z" stroke="currentColor" stroke-width="2"/><path d="M6 6 5 3H2" stroke="currentColor" stroke-width="2"/><path d="M8 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor"/></svg>',
  wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 0 1-11.75 7.05L4 20l.98-3.21A8 8 0 1 1 20 12Z" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5c.5 2 2 3.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export function renderTopBar({ onSearch, onOpenCart, onOpenAdmin }){
  const theme = Store.ui.theme || "light";
  const cartCount = Store.cart.items.reduce((a,i)=>a+i.qty,0);

  const root = el("div",{class:"topbar"},[
    el("div",{class:"topbar-inner"},[
      el("div",{class:"brand", role:"button", tabindex:"0", onclick:()=>location.href=location.pathname},[
        el("img",{src:"./assets/logo-blue-2.png", alt:"SD-Comayagua logo"}),
        el("div",{class:"title"},[
          el("strong",{},[CONFIG.APP_NAME]),
          el("span",{},["Comayagua, Honduras • Pedidos por WhatsApp"])
        ])
      ]),
      el("div",{class:"search"},[
        el("input",{id:"searchInput", type:"search", placeholder:"Buscar productos (nombre, marca, tags)...", autocomplete:"off",
          oninput:(e)=>onSearch(e.target.value),
          onkeydown:(e)=>{
            if (e.key==="Escape"){ e.target.value=""; onSearch(""); e.target.blur(); }
          }
        }),
        el("div",{class:"kbd"},["Esc"])
      ]),
      el("div",{class:"actions"},[
        el("button",{class:"iconbtn", type:"button", onclick:()=>{
          Store.setTheme(theme==="dark" ? "light" : "dark");
        }, title:"Modo claro/oscuro"},[
          icon(theme==="dark" ? ICONS.sun : ICONS.moon),
          el("small",{},[theme==="dark" ? "Día" : "Noche"])
        ]),
        el("button",{class:"iconbtn", type:"button", onclick:onOpenCart, title:"Carrito"},[
          icon(ICONS.cart),
          el("span",{},["Carrito"]),
          el("span",{class:"badge", id:"cartBadge"},[String(cartCount)])
        ]),
        el("a",{class:"iconbtn", href:`https://wa.me/${CONFIG.WHATSAPP_NUMBER}`, target:"_blank", rel:"noopener", title:"Escribir por WhatsApp"},[
          icon(ICONS.wa),
          el("span",{},["WhatsApp"])
        ]),
        el("button",{class:"iconbtn", type:"button", onclick:onOpenAdmin, title:"Admin"},[
          el("span",{},["Admin"])
        ])
      ])
    ])
  ]);

  return root;
}
