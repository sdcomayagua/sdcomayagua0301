import { el } from "../utils/dom.js";
import { moneyLps, firstNonEmpty, safeText } from "../utils/format.js";

export function renderProductCard(p, { onOpen, onAdd, onShare }){
  const img = firstNonEmpty(p.img, (p.galeria||[])[0], "./assets/logo-bw.png");
  const title = safeText(p.nombre || "Producto");
  const cat = [p.categoria, p.subcategoria].filter(Boolean).join(" · ");
  const price = moneyLps(p.precio);
  const inStock = Number(p.stock||0) > 0 && String(p.activo||"1") !== "0";

  const pill = (!inStock)
    ? el("div",{class:"pill bad"},["Agotado"])
    : (String(p.nuevo||"") === "1" ? el("div",{class:"pill"},["Nuevo"])
      : (String(p.oferta||"") === "1" ? el("div",{class:"pill warn"},["Oferta"]) : null));

  return el("div",{class:"card"},[
    el("div",{class:"thumb", role:"button", tabindex:"0", onclick:()=>onOpen(p)},[
      el("img",{src:img, alt:title, loading:"lazy"}),
      pill
    ]),
    el("div",{class:"card-body"},[
      el("h3",{class:"card-title"},[title]),
      el("div",{class:"card-meta"},[cat || "—"]),
      el("div",{class:"price"},[price]),
      el("div",{class:"card-actions"},[
        el("button",{class:"btn primary", type:"button", disabled: !inStock, onclick:()=>onAdd(p)},[ inStock ? "Agregar" : "No disponible" ]),
        el("button",{class:"btn", type:"button", onclick:()=>onShare(p)},["Compartir"])
      ])
    ])
  ]);
}
