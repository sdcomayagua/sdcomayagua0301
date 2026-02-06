import { el } from "../utils/dom.js";
import { Store } from "../state/store.js";
import { moneyLps, firstNonEmpty, safeText } from "../utils/format.js";
import { CONFIG } from "../config.js";
import { toast } from "./Toast.js";

function buildWhatsAppMessage({ items, productsById, shipping, settings, form }){
  const lines = [];
  lines.push(`🛒 *Pedido - ${CONFIG.APP_NAME}*`);
  lines.push(`📍 ${CONFIG.LOCATION}`);
  lines.push("");
  let subtotal = 0;

  for (const it of items){
    const p = productsById.get(String(it.id));
    if (!p) continue;
    const price = Number(p.precio||0);
    const qty = Number(it.qty||1);
    const lineTotal = price * qty;
    subtotal += lineTotal;
    lines.push(`• ${safeText(p.nombre)} x${qty} = ${moneyLps(lineTotal)}`);
  }

  const shippingCost = Number(shipping?.costo || 0);
  const methodFee = Number(settings?.metodos?.[form.metodo]?.recargo || 0);

  lines.push("");
  lines.push(`Subtotal: *${moneyLps(subtotal)}*`);
  lines.push(`Envío (${form.zona || "—"}): *${moneyLps(shippingCost)}*`);
  lines.push(`Recargo (${form.metodo || "—"}): *${moneyLps(methodFee)}*`);
  lines.push(`TOTAL: *${moneyLps(subtotal + shippingCost + methodFee)}*`);
  lines.push("");
  lines.push("👤 *Cliente*");
  lines.push(`Nombre: ${safeText(form.nombre)}`);
  lines.push(`Teléfono: ${safeText(form.telefono)}`);
  lines.push(`Dirección: ${safeText(form.direccion)}`);
  if (form.notas) lines.push(`Notas: ${safeText(form.notas)}`);
  lines.push("");
  lines.push(`🔗 Link del carrito: ${location.href}`);

  return lines.join("\n");
}

export function openCartModal({ productos, envios, ajustes, onOpenProduct, onShareFilter }){
  const overlay = el("div",{class:"overlay", onclick:(e)=>{ if(e.target===overlay) close(); }});
  const close = ()=>overlay.remove();

  const productsById = new Map(productos.map(p=>[String(p.id), p]));

  const sheet = el("div",{class:"sheet"},[
    el("div",{class:"sheet-header"},[
      el("h2",{},["Carrito"]),
      el("button",{class:"close", type:"button", onclick:close},["✕"])
    ]),
    el("div",{class:"sheet-body"},[
      el("div",{id:"cartContent"})
    ])
  ]);
  overlay.appendChild(sheet);
  document.getElementById("portal").appendChild(overlay);

  const render = ()=>{
    const items = Store.cart.items;
    const container = sheet.querySelector("#cartContent");

    if (!items.length){
      container.innerHTML = "";
      container.appendChild(el("div",{class:"empty"},[
        el("h3",{},["Tu carrito está vacío"]),
        el("p",{},["Agrega productos y luego envía tu pedido por WhatsApp."]),
        el("button",{class:"btn primary", type:"button", onclick:close},["Seguir comprando"])
      ]));
      return;
    }

    let subtotal = 0;
    const list = el("div",{class:"cart-list"}, items.map(it=>{
      const p = productsById.get(String(it.id));
      if (!p) return null;
      const img = firstNonEmpty(p.img, (p.galeria||[])[0], "./assets/logo-bw.png");
      const price = Number(p.precio||0);
      const qty = Number(it.qty||1);
      subtotal += price*qty;

      return el("div",{class:"cart-item"},[
        el("img",{src:img, alt:safeText(p.nombre||"Producto"), role:"button", tabindex:"0", onclick:()=>onOpenProduct(p)}),
        el("div",{},[
          el("div",{style:"font-weight:900"},[safeText(p.nombre||"Producto")]),
          el("div",{style:"font-size:12px;color:var(--muted);margin-top:2px"},[moneyLps(price)])
        ]),
        el("div",{},[
          el("div",{class:"qty"},[
            el("button",{class:"btn", type:"button", onclick:()=>Store.setQty(it.id, qty-1)},["−"]),
            el("strong",{},[String(qty)]),
            el("button",{class:"btn", type:"button", onclick:()=>Store.setQty(it.id, qty+1)},["+"]),
          ]),
          el("button",{class:"btn", type:"button", style:"margin-top:8px;width:100%", onclick:()=>Store.remove(it.id)},["Quitar"])
        ])
      ]);
    }).filter(Boolean));

    const zonas = (envios || []).filter(x=>String(x.activo||"1")!=="0");
    const metodos = ajustes?.metodos || { "PREPAGO": { recargo: 0 }, "PAGAR AL RECIBIR": { recargo: 0 } };

    const form = { nombre:"", telefono:"", direccion:"", zona: zonas[0]?.zona || "", metodo: Object.keys(metodos)[0] || "PREPAGO", notas:"" };

    const zonaSelect = el("select",{onchange:(e)=>form.zona=e.target.value}, zonas.map(z=>{
      return el("option",{value:z.zona, selected: z.zona===form.zona},[`${z.zona} (${moneyLps(z.costo)})`]);
    }));
    const metodoSelect = el("select",{onchange:(e)=>form.metodo=e.target.value}, Object.entries(metodos).map(([k,v])=>{
      return el("option",{value:k, selected: k===form.metodo},[`${k} (${moneyLps(v.recargo||0)})`]);
    }));

    const totals = el("div",{class:"totals"},[
      el("div",{class:"line"},[ el("span",{},["Subtotal"]), el("strong",{},[moneyLps(subtotal)]) ]),
      el("div",{class:"line", id:"shipLine"},[ el("span",{},["Envío"]), el("strong",{},["—"]) ]),
      el("div",{class:"line", id:"feeLine"},[ el("span",{},["Recargo"]), el("strong",{},["—"]) ]),
      el("div",{class:"line"},[ el("span",{},["Total"]), el("strong",{id:"totalStrong"},[moneyLps(subtotal)]) ]),
    ]);

    const recalc = ()=>{
      const sh = zonas.find(z=>z.zona===form.zona);
      const shippingCost = Number(sh?.costo || 0);
      const methodFee = Number(metodos?.[form.metodo]?.recargo || 0);

      totals.querySelector("#shipLine strong").textContent = moneyLps(shippingCost);
      totals.querySelector("#feeLine strong").textContent = moneyLps(methodFee);
      totals.querySelector("#totalStrong").textContent = moneyLps(subtotal + shippingCost + methodFee);
    };
    zonaSelect.addEventListener("change", recalc);
    metodoSelect.addEventListener("change", recalc);
    recalc();

    const checkout = el("div",{},[
      el("h3",{style:"margin:14px 0 8px"},["Datos para entrega"]),
      el("div",{class:"checkout-grid"},[
        el("div",{class:"field"},[
          el("label",{},["Nombre"]),
          el("input",{placeholder:"Tu nombre", oninput:(e)=>form.nombre=e.target.value})
        ]),
        el("div",{class:"field"},[
          el("label",{},["Teléfono"]),
          el("input",{placeholder:"Ej: 9999-9999", oninput:(e)=>form.telefono=e.target.value})
        ]),
        el("div",{class:"field"},[
          el("label",{},["Zona / Envío"]),
          zonaSelect
        ]),
        el("div",{class:"field"},[
          el("label",{},["Método de pago"]),
          metodoSelect
        ]),
        el("div",{class:"field", style:"grid-column:1/-1"},[
          el("label",{},["Dirección"]),
          el("textarea",{placeholder:"Colonia, referencia, etc.", oninput:(e)=>form.direccion=e.target.value})
        ]),
        el("div",{class:"field", style:"grid-column:1/-1"},[
          el("label",{},["Notas (opcional)"]),
          el("textarea",{placeholder:"Color, talla, instrucciones...", oninput:(e)=>form.notas=e.target.value})
        ]),
      ]),
      el("div",{style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"},[
        el("button",{class:"btn", type:"button", onclick:()=>{ Store.clear(); toast("Listo","Carrito limpiado"); }},["Vaciar carrito"]),
        el("button",{class:"btn", type:"button", onclick:()=>onShareFilter?.()},["Compartir esta vista"]),
        el("button",{class:"btn primary", type:"button", onclick:()=>{
          if (!form.nombre || !form.telefono || !form.direccion){
            toast("Faltan datos", "Nombre, teléfono y dirección");
            return;
          }
          const sh = zonas.find(z=>z.zona===form.zona);
          const msg = buildWhatsAppMessage({ items, productsById, shipping: sh, settings: ajustes, form });
          const href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
          window.open(href, "_blank", "noopener");
          toast("Enviado", "Se abrió WhatsApp con tu pedido");
        }},["Enviar pedido a WhatsApp"])
      ]),
      totals
    ]);

    container.innerHTML = "";
    container.appendChild(list);
    container.appendChild(checkout);
  };

  const unsub = Store.subscribe(render);
  const oldClose = close;
  const close2 = ()=>{ unsub(); oldClose(); };
  // override close with unsubscribe
  overlay.addEventListener("remove", ()=>unsub(), { once:true });

  // patch close function
  overlay.querySelector(".close").onclick = close2;
  overlay.onclick = (e)=>{ if(e.target===overlay) close2(); };

  render();
  return { close: close2 };
}
