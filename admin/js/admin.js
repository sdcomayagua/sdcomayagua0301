import { apiGet, apiPost } from "./api.js";
import { el, toast, modal } from "./ui.js";

const KEY = "SDC_ADMIN_SESSION_V1";
const session = {
  apiBase: "",
  adminKey: "",
  save(){ localStorage.setItem(KEY, JSON.stringify({ apiBase:this.apiBase, adminKey:this.adminKey })); },
  load(){
    try{
      const v = JSON.parse(localStorage.getItem(KEY) || "{}");
      this.apiBase = v.apiBase || "";
      this.adminKey = v.adminKey || "";
    }catch{}
  },
  clear(){ localStorage.removeItem(KEY); this.apiBase=""; this.adminKey=""; }
};

const state = { productos: [], envios: [], ajustes: {} };

const $ = (s)=>document.querySelector(s);

function showApp(on){
  $("#auth").classList.toggle("hidden", on);
  $("#app").classList.toggle("hidden", !on);
}

function tab(name){
  document.querySelectorAll(".tab").forEach(b=>{
    const on = b.dataset.tab===name;
    b.classList.toggle("active", on);
  });
  $("#tab-productos").classList.toggle("hidden", name!=="productos");
  $("#tab-envios").classList.toggle("hidden", name!=="envios");
  $("#tab-ajustes").classList.toggle("hidden", name!=="ajustes");
}

function normalize(s){ return String(s||"").toLowerCase().trim(); }

function productForm(p={}){
  const form = {
    id: p.id || "",
    nombre: p.nombre || "",
    categoria: p.categoria || "",
    subcategoria: p.subcategoria || "",
    marca: p.marca || "",
    precio: p.precio ?? 0,
    stock: p.stock ?? 0,
    activo: p.activo ?? 1,
    tags: p.tags || "",
    descripcion: p.descripcion || "",
    img: p.img || "",
    galeria: (p.galeria || []).join("\n"),
    video_url: p.video_url || "",
    tiktok_url: p.tiktok_url || "",
    youtube_url: p.youtube_url || "",
    facebook_url: p.facebook_url || ""
  };

  const box = el("div",{},[
    el("div",{class:"grid"},[
      field("ID", el("input",{value:form.id, readonly:"readonly"}), "Se genera automáticamente si creas uno nuevo."),
      field("Nombre", el("input",{value:form.nombre, oninput:e=>form.nombre=e.target.value})),
      field("Categoría", el("input",{value:form.categoria, oninput:e=>form.categoria=e.target.value})),
      field("Subcategoría", el("input",{value:form.subcategoria, oninput:e=>form.subcategoria=e.target.value})),
      field("Marca", el("input",{value:form.marca, oninput:e=>form.marca=e.target.value})),
      field("Precio (Lps.)", el("input",{type:"number", value:form.precio, oninput:e=>form.precio=Number(e.target.value)})),
      field("Stock", el("input",{type:"number", value:form.stock, oninput:e=>form.stock=Number(e.target.value)})),
      field("Activo (1/0)", el("input",{type:"number", value:form.activo, oninput:e=>form.activo=Number(e.target.value)}), "0 = oculto en la tienda."),
      field("Tags", el("input",{value:form.tags, oninput:e=>form.tags=e.target.value}), "Separados por coma. Ej: gamer, usb, android"),
      field("Imagen principal (URL)", el("input",{value:form.img, oninput:e=>form.img=e.target.value})),
      field("Galería (1 URL por línea)", el("textarea",{value:form.galeria, oninput:e=>form.galeria=e.target.value}), "Se guarda en columnas galeria_1..8.")
    ]),
    el("div",{class:"grid", style:"margin-top:10px"},[
      field("Descripción (texto o HTML básico)", el("textarea",{value:form.descripcion, oninput:e=>form.descripcion=e.target.value})),
      field("video_url", el("input",{value:form.video_url, oninput:e=>form.video_url=e.target.value})),
      field("tiktok_url", el("input",{value:form.tiktok_url, oninput:e=>form.tiktok_url=e.target.value})),
      field("youtube_url", el("input",{value:form.youtube_url, oninput:e=>form.youtube_url=e.target.value})),
      field("facebook_url", el("input",{value:form.facebook_url, oninput:e=>form.facebook_url=e.target.value}))
    ])
  ]);

  return { box, form };
}

function shippingForm(s={}){
  const form = {
    id: s.id || "",
    zona: s.zona || "",
    costo: s.costo ?? 0,
    activo: s.activo ?? 1,
    nota: s.nota || ""
  };
  const box = el("div",{},[
    el("div",{class:"grid"},[
      field("ID", el("input",{value:form.id, readonly:"readonly"})),
      field("Zona", el("input",{value:form.zona, oninput:e=>form.zona=e.target.value})),
      field("Costo (Lps.)", el("input",{type:"number", value:form.costo, oninput:e=>form.costo=Number(e.target.value)})),
      field("Activo (1/0)", el("input",{type:"number", value:form.activo, oninput:e=>form.activo=Number(e.target.value)})),
      field("Nota (opcional)", el("input",{value:form.nota, oninput:e=>form.nota=e.target.value}))
    ])
  ]);
  return { box, form };
}

function field(label, control, help=""){
  return el("div",{class:"field"},[
    el("label",{},[label]),
    control,
    help ? el("small",{},[help]) : null
  ].filter(Boolean));
}

async function loadAll(){
  const base = session.apiBase;
  const [p,e,a] = await Promise.all([
    apiGet(base, "productos"),
    apiGet(base, "envios"),
    apiGet(base, "ajustes")
  ]);
  state.productos = p.productos || p.items || p || [];
  state.envios = e.envios || e.items || e || [];
  state.ajustes = a.ajustes || a || {};
}

function renderProducts(){
  const q = normalize($("#pSearch").value);
  const list = state.productos
    .filter(p=>!q || normalize(p.nombre).includes(q) || normalize(p.id).includes(q) || normalize(p.categoria).includes(q));
  const table = el("table",{},[
    el("thead",{},[
      el("tr",{},["Img","ID","Nombre","Categoría","Precio","Stock","Activo","Acciones"].map(h=>el("th",{},[h])))
    ]),
    el("tbody",{}, list.map(p=>{
      return el("tr",{},[
        el("td",{},[ el("img",{class:"mini", src:p.img||"../assets/logo-bw.png", alt:""}) ]),
        el("td",{},[String(p.id||"")]),
        el("td",{},[String(p.nombre||"")]),
        el("td",{},[`${p.categoria||""} / ${p.subcategoria||""}`]),
        el("td",{},[String(p.precio||0)]),
        el("td",{},[String(p.stock||0)]),
        el("td",{},[String(p.activo??1)]),
        el("td",{},[
          el("div",{class:"row"},[
            el("button",{class:"btn", type:"button", onclick:()=>editProduct(p)},["Editar"]),
            el("button",{class:"btn", type:"button", onclick:()=>dupProduct(p)},["Duplicar"]),
            el("button",{class:"btn", type:"button", onclick:()=>delProduct(p)},["Eliminar"])
          ])
        ])
      ]);
    }))
  ]);
  $("#pTable").innerHTML = "";
  $("#pTable").appendChild(table);
}

function renderShipping(){
  const table = el("table",{},[
    el("thead",{},[
      el("tr",{},["ID","Zona","Costo","Activo","Nota","Acciones"].map(h=>el("th",{},[h])))
    ]),
    el("tbody",{}, state.envios.map(s=>{
      return el("tr",{},[
        el("td",{},[String(s.id||"")]),
        el("td",{},[String(s.zona||"")]),
        el("td",{},[String(s.costo||0)]),
        el("td",{},[String(s.activo??1)]),
        el("td",{},[String(s.nota||"")]),
        el("td",{},[
          el("div",{class:"row"},[
            el("button",{class:"btn", type:"button", onclick:()=>editShip(s)},["Editar"]),
            el("button",{class:"btn", type:"button", onclick:()=>delShip(s)},["Eliminar"])
          ])
        ])
      ]);
    }))
  ]);
  $("#sTable").innerHTML = "";
  $("#sTable").appendChild(table);
}

function renderSettings(){
  const metodos = state.ajustes.metodos || {
    "PREPAGO": { recargo: 0 },
    "PAGAR AL RECIBIR": { recargo: 0 }
  };

  const form = {};
  const box = el("div",{class:"grid"}, Object.entries(metodos).map(([k,v])=>{
    form[k] = Number(v.recargo||0);
    return field(`Recargo: ${k} (Lps.)`, el("input",{type:"number", value: form[k], oninput:e=>form[k]=Number(e.target.value)}));
  }));

  const save = el("button",{class:"btn primary", type:"button", onclick: async ()=>{
    try{
      const payload = { adminKey: session.adminKey, metodos: {} };
      Object.keys(form).forEach(k=>payload.metodos[k]={ recargo: Number(form[k]||0) });
      await apiPost(session.apiBase, "updateSettings", payload);
      toast("Ajustes guardados");
      await loadAll();
      renderSettings();
    }catch(e){ toast(`Error: ${e.message}`); }
  }},["Guardar ajustes"]);

  $("#settingsBox").innerHTML = "";
  $("#settingsBox").appendChild(box);
  $("#settingsBox").appendChild(el("div",{class:"row", style:"margin-top:12px"},[save]));
}

async function editProduct(p){
  const { box, form } = productForm(p);
  const m = modal({
    title: `Editar: ${p.nombre || p.id}`,
    content: box,
    actions: [
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          const payload = { adminKey: session.adminKey, product: normalizeProductPayload(form) };
          await apiPost(session.apiBase, "updateProduct", payload);
          toast("Guardado");
          m.close();
          await loadAll(); renderProducts();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Guardar"])
    ]
  });
}

async function newProduct(){
  const { box, form } = productForm({});
  const m = modal({
    title: "Nuevo producto",
    content: box,
    actions: [
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          const payload = { adminKey: session.adminKey, product: normalizeProductPayload(form) };
          await apiPost(session.apiBase, "updateProduct", payload);
          toast("Creado");
          m.close();
          await loadAll(); renderProducts();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Crear"])
    ]
  });
}

function normalizeProductPayload(form){
  const gal = String(form.galeria||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);
  return {
    id: String(form.id||""),
    nombre: form.nombre,
    categoria: form.categoria,
    subcategoria: form.subcategoria,
    marca: form.marca,
    precio: Number(form.precio||0),
    stock: Number(form.stock||0),
    activo: Number(form.activo??1),
    tags: form.tags,
    descripcion: form.descripcion,
    img: form.img,
    galeria: gal,
    video_url: form.video_url,
    tiktok_url: form.tiktok_url,
    youtube_url: form.youtube_url,
    facebook_url: form.facebook_url
  };
}

async function dupProduct(p){
  try{
    await apiPost(session.apiBase, "duplicateProduct", { adminKey: session.adminKey, id: String(p.id) });
    toast("Duplicado");
    await loadAll(); renderProducts();
  }catch(e){ toast(`Error: ${e.message}`); }
}

async function delProduct(p){
  const m = modal({
    title: "Confirmar eliminación",
    content: el("div",{},[
      el("p",{},[`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`])
    ]),
    actions: [
      el("button",{class:"btn", type:"button", onclick:()=>m.close()},["Cancelar"]),
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          await apiPost(session.apiBase, "deleteProduct", { adminKey: session.adminKey, id: String(p.id) });
          toast("Eliminado");
          m.close();
          await loadAll(); renderProducts();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Eliminar"])
    ]
  });
}

async function editShip(s){
  const { box, form } = shippingForm(s);
  const m = modal({
    title: `Editar envío: ${s.zona || s.id}`,
    content: box,
    actions: [
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          await apiPost(session.apiBase, "updateShipping", { adminKey: session.adminKey, shipping: { ...form, id:String(form.id||"") } });
          toast("Guardado");
          m.close();
          await loadAll(); renderShipping();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Guardar"])
    ]
  });
}

async function newShip(){
  const { box, form } = shippingForm({});
  const m = modal({
    title: "Nuevo envío",
    content: box,
    actions: [
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          await apiPost(session.apiBase, "updateShipping", { adminKey: session.adminKey, shipping: form });
          toast("Creado");
          m.close();
          await loadAll(); renderShipping();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Crear"])
    ]
  });
}

async function delShip(s){
  const m = modal({
    title: "Eliminar envío",
    content: el("p",{},[`¿Eliminar la zona "${s.zona}"?`]),
    actions: [
      el("button",{class:"btn", type:"button", onclick:()=>m.close()},["Cancelar"]),
      el("button",{class:"btn primary", type:"button", onclick: async ()=>{
        try{
          await apiPost(session.apiBase, "deleteShipping", { adminKey: session.adminKey, id: String(s.id) });
          toast("Eliminado");
          m.close();
          await loadAll(); renderShipping();
        }catch(e){ toast(`Error: ${e.message}`); }
      }},["Eliminar"])
    ]
  });
}

function wire(){
  // tabs
  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=>tab(b.dataset.tab));
  });

  $("#btnLogin").addEventListener("click", async ()=>{
    session.apiBase = $("#apiBase").value.trim();
    session.adminKey = $("#adminKey").value.trim();
    if (!session.apiBase || !session.adminKey){ toast("Falta API_BASE o ADMIN_KEY"); return; }
    try{
      await loadAll();
      session.save();
      showApp(true);
      tab("productos");
      renderProducts(); renderShipping(); renderSettings();
      toast("Sesión iniciada");
    }catch(e){ toast(`Error: ${e.message}`); }
  });

  $("#btnLogout").addEventListener("click", ()=>{
    session.clear();
    showApp(false);
    toast("Sesión cerrada");
  });

  $("#pSearch").addEventListener("input", ()=>renderProducts());
  $("#btnNew").addEventListener("click", ()=>newProduct());
  $("#btnNewShip").addEventListener("click", ()=>newShip());
}

function boot(){
  session.load();
  $("#apiBase").value = session.apiBase || "";
  $("#adminKey").value = session.adminKey || "";
  wire();
  if (session.apiBase && session.adminKey){
    $("#btnLogin").click();
  }
}

boot();
