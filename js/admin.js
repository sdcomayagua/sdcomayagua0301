/* SDComayagua — admin.js
   - Mobile-first admin panel in a modal
   - Uses form-urlencoded to avoid CORS preflight
   - Edit allows changing ONLY stock (no price requirement)
*/
(function(){
  const CFG = window.SDCO_CONFIG;
  const Api = window.SDCO_Api;
  const UI = window.SDCO_UI;

  const els = {};
  let adminKey = "";

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }
  function imgOrPlaceholder(url){
    const u = String(url || "").trim();
    return u ? u : CFG.DEFAULT_PLACEHOLDER;
  }
  function norm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,""); }
  function numOrEmpty(v){
    const s = String(v ?? "").trim();
    if (!s) return "";
    const n = Number(s);
    return isFinite(n) ? n : "";
  }

  function getProductos(){
    return (UI.getState && UI.getState().productos) ? UI.getState().productos : [];
  }

  function loadStoredKey(){
    try{
      adminKey = sessionStorage.getItem(CFG.ADMIN_KEY_STORAGE) || "";
    } catch(e){ adminKey = ""; }
  }
  function storeKey(k){
    adminKey = k || "";
    try{
      if (adminKey) sessionStorage.setItem(CFG.ADMIN_KEY_STORAGE, adminKey);
      else sessionStorage.removeItem(CFG.ADMIN_KEY_STORAGE);
    } catch(e){}
  }

  function openAdmin(){
    renderAdmin();
    UI.openModal(els.adminModal);
  }

  function renderAdmin(){
    loadStoredKey();
    if (!adminKey){
      els.adminBody.innerHTML = `
        <div class="pbox">
          <div style="font-weight:900">Ingreso Admin</div>
          <div class="small" style="margin-top:6px">Ingresa tu ADMIN_KEY (se guarda solo en esta sesión).</div>
          <div style="margin-top:12px">
            <div class="label">ADMIN_KEY</div>
            <input class="input" id="admKeyInput" type="password" placeholder="CAMBIA_ESTA_CLAVE" autocomplete="off">
          </div>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn btn--primary" id="admLoginBtn">Entrar</button>
            <button class="btn btn--ghost" id="admCloseBtn">Cerrar</button>
          </div>
          <div class="small" style="margin-top:8px">Tip: si te sale “Failed to fetch”, revisa que el Web App esté “Anyone” y uses el backend de este ZIP.</div>
        </div>
      `;
      $("#admLoginBtn").addEventListener("click", async () => {
        const k = String($("#admKeyInput").value || "").trim();
        if (!k) return UI.toast("Falta clave", "Ingresa tu ADMIN_KEY");
        storeKey(k);
        await tryPing();
        renderAdmin();
      });
      $("#admCloseBtn").addEventListener("click", () => UI.closeModal(els.adminModal));
      return;
    }

    els.adminBody.innerHTML = `
      <div class="adminbar">
        <div class="adminbar__left">
          <div class="pbox">
            <div class="pbox__k">Conectado</div>
            <div class="pbox__v">Admin</div>
          </div>
          <button class="btn btn--ghost" id="admLogout">Salir</button>
        </div>

        <div class="adminbar__right" style="flex:1">
          <input class="input" id="admSearch" placeholder="Buscar en admin..." />
          <button class="btn" id="admRefresh">Refrescar</button>
        </div>
      </div>

      <div class="adminlist" id="adminList"></div>
    `;

    $("#admLogout").addEventListener("click", () => {
      storeKey("");
      renderAdmin();
      UI.toast("Sesión cerrada", "Admin desactivado");
    });
    $("#admRefresh").addEventListener("click", async () => {
      await refreshFromServer();
    });

    const search = $("#admSearch");
    search.addEventListener("input", () => renderAdminList(search.value));

    renderAdminList("");
  }

  function renderAdminList(query){
    const list = $("#adminList");
    const q = norm(query || "");
    const productos = getProductos().filter(p => p && !isSeparator(p));

    const filtered = q ? productos.filter(p => norm([p.id,p.nombre,p.categoria,p.subcategoria,p.marca].join(" ")).includes(q)) : productos;

    if (!filtered.length){
      list.innerHTML = '<div class="sep"><div class="sep__title">Sin resultados</div><div class="sep__hint">—</div></div>';
      return;
    }

    list.innerHTML = filtered.map(p => {
      const stock = Number(p.stock ?? 0);
      const isActive = String(p.activo ?? 1) !== "0";
      const b1 = stock > 0 ? '<span class="badge badge--ok">Stock: '+esc(stock)+'</span>' : '<span class="badge badge--no">Sin stock</span>';
      const b2 = isActive ? '<span class="badge badge--ok">Activo</span>' : '<span class="badge badge--no">Inactivo</span>';
      const meta = [p.categoria, p.subcategoria].filter(Boolean).join(" / ");
      return `
        <div class="acard" data-id="${esc(p.id)}">
          <div class="acard__top">
            <div class="acard__img"><img src="${esc(imgOrPlaceholder(p.img))}" alt=""></div>
            <div class="acard__info">
              <div class="acard__name">${esc(p.nombre || "")}</div>
              <div class="acard__meta">${esc(meta || "")}</div>
              <div class="acard__badges">${b1}${b2}</div>
            </div>
          </div>
          <div class="acard__actions">
            <button class="smallbtn" data-act="edit">Editar</button>
            <button class="smallbtn" data-act="dup">Duplicar</button>
            <button class="smallbtn ${isActive ? "smallbtn--danger" : "smallbtn--ok"}" data-act="toggle">${isActive ? "Desactivar" : "Activar"}</button>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".acard").forEach(card => {
      const id = card.dataset.id;
      card.querySelectorAll("button[data-act]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const act = btn.dataset.act;
          if (act === "edit") return openEdit(id);
          if (act === "dup") return duplicate(id);
          if (act === "toggle") return toggleActive(id);
        });
      });
    });
  }

  function isSeparator(p){
    const id = String(p.id||"");
    const name = String(p.nombre||"");
    return id.toUpperCase().startsWith("SEP_") || /^[-—–].*[-—–]$/.test(name.trim()) || name.includes("—");
  }

  async function tryPing(){
    try{
      // A "ping" by requesting productos (fast). If admin key invalid, we catch on POST later anyway.
      await UI.refreshProductos();
      UI.toast("OK", "Conectado");
    } catch(e){
      UI.toast("Aviso", "No pude confirmar conexión. Igual puedes intentar.");
    }
  }

  async function refreshFromServer(){
    try{
      UI.toast("Actualizando", "Cargando datos del servidor…");
      await UI.refreshProductos();
      const s = $("#admSearch");
      renderAdminList(s ? s.value : "");
      UI.toast("Listo", "Datos actualizados");
    } catch(e){
      UI.toast("Error", (e && e.message) ? e.message : "No se pudo refrescar");
    }
  }

  function openEdit(id){
    const p = getProductos().find(x => String(x.id) === String(id));
    if (!p) return UI.toast("No encontrado", "Producto no existe");
    renderEditModal(p);
    UI.openModal(els.adminEditModal);
  }

  function field(label, id, value, type="text", placeholder=""){
    return `
      <div class="field">
        <div class="label">${esc(label)}</div>
        <input class="input" id="${esc(id)}" type="${esc(type)}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}">
      </div>
    `;
  }

  function renderEditModal(p){
    $("#aeTitle").textContent = "Editar: " + (p.nombre || p.id || "");

    const body = `
      <div class="formgrid">
        ${field("ID (no editar)", "ae_id", p.id, "text")}
        ${field("Nombre", "ae_nombre", p.nombre)}
        ${field("Categoría", "ae_categoria", p.categoria)}
        ${field("Subcategoría", "ae_subcategoria", p.subcategoria)}
        ${field("Marca", "ae_marca", p.marca)}
        ${field("Precio (Lps)", "ae_precio", p.precio, "number")}
        ${field("Stock", "ae_stock", p.stock, "number")}
        ${field("Imagen (URL)", "ae_img", p.img)}
        ${field("Video URL", "ae_video_url", p.video_url || p.tiktok_url || p.youtube_url)}
      </div>

      <div style="margin-top:12px">
        <div class="label">Descripción</div>
        <textarea class="textarea" id="ae_descripcion" placeholder="Descripción...">${esc(p.descripcion || "")}</textarea>
      </div>

      <div class="pbox" style="margin-top:12px">
        <div class="pbox__k">Galería (URLs, 1 por línea)</div>
        <textarea class="textarea" id="ae_galeria" placeholder="https://...">${esc(getGalleryLines(p))}</textarea>
        <div class="small" style="margin-top:8px">Tip: si solo cambias Stock, NO enviamos Precio.</div>
      </div>

      <div class="pbox" style="margin-top:12px">
        <div class="pbox__k">Activo</div>
        <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap">
          <label class="chip"><input type="checkbox" id="ae_activo" ${String(p.activo ?? 1) !== "0" ? "checked" : ""} style="margin-right:8px">Activo</label>
        </div>
      </div>
    `;

    els.adminEditBody.innerHTML = body;
    $("#ae_id").disabled = true;

    els.adminEditFooter.innerHTML = `
      <button class="btn btn--ghost" id="aeCancel">Cancelar</button>
      <button class="btn btn--primary" id="aeSave">Guardar</button>
    `;

    $("#aeCancel").addEventListener("click", () => UI.closeModal(els.adminEditModal));
    $("#aeSave").addEventListener("click", async () => saveEdit(p));
  }

  function getGalleryLines(p){
    const lines = [];
    for (let i=1;i<=8;i++){
      const u = p["galeria_"+i];
      if (u) lines.push(String(u));
    }
    return lines.join("\n");
  }

  function computeDiff(original, next){
    const out = {};
    const keys = Object.keys(next);
    for (const k of keys){
      const a = String(original[k] ?? "");
      const b = String(next[k] ?? "");
      if (a !== b) out[k] = next[k];
    }
    return out;
  }

  function parseGallery(text){
    const lines = String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const out = {};
    for (let i=1;i<=8;i++) out["galeria_"+i] = "";
    lines.slice(0,8).forEach((u, idx) => out["galeria_"+(idx+1)] = u);
    return out;
  }

  async function saveEdit(original){
    loadStoredKey();
    if (!adminKey) return UI.toast("Sin sesión", "Ingresa ADMIN_KEY");

    const next = {
      id: String(original.id || ""),
      nombre: $("#ae_nombre").value.trim(),
      categoria: $("#ae_categoria").value.trim(),
      subcategoria: $("#ae_subcategoria").value.trim(),
      marca: $("#ae_marca").value.trim(),
      // Precio y stock: permitimos vacío (no se envía si no cambia)
      precio: $("#ae_precio").value.trim(),
      stock: $("#ae_stock").value.trim(),
      img: $("#ae_img").value.trim(),
      video_url: $("#ae_video_url").value.trim(),
      descripcion: $("#ae_descripcion").value,
      activo: $("#ae_activo").checked ? "1" : "0",
      ...parseGallery($("#ae_galeria").value)
    };

    // Normalización: si precio vacío => mantener original (no lo mandamos)
    if (next.precio === "") next.precio = String(original.precio ?? "");
    if (next.stock === "") next.stock = String(original.stock ?? "");

    const diff = computeDiff(original, next);

    // IMPORTANT: si el usuario solo cambió stock, NO mandamos precio.
    const changedKeys = Object.keys(diff);
    const onlyStock = changedKeys.length === 1 && changedKeys[0] === "stock";
    if (onlyStock){
      // ok: diff tiene solo stock
    } else {
      // Si precio no cambió, quitarlo para evitar validaciones raras
      if (!diff.precio) delete diff.precio;
    }

    if (!changedKeys.length){
      UI.toast("Sin cambios", "No hay nada que guardar");
      return;
    }

    // Convert numeric fields
    if (diff.precio !== undefined) diff.precio = numOrEmpty(diff.precio);
    if (diff.stock !== undefined) diff.stock = numOrEmpty(diff.stock);

    UI.toast("Guardando…", "Aplicando cambios");
    try{
      const resp = await Api.postAction("updateProduct", diff, adminKey);
      if (!resp || resp.ok !== true){
        throw new Error(resp && resp.message ? resp.message : "Respuesta inválida");
      }
      // Refresh UI instantly (optimistic) + then pull from server
      applyLocalUpdate(original.id, diff);
      await UI.refreshProductos();
      const s = $("#admSearch");
      renderAdminList(s ? s.value : "");
      UI.toast("Guardado", "Cambios aplicados");
      UI.closeModal(els.adminEditModal);
    } catch(err){
      console.error(err);
      const details = (err && err.details && err.details.body) ? (" " + String(err.details.body).slice(0,200)) : "";
      UI.toast("Error", (err.code ? "["+err.code+"] " : "") + (err.message || "No se pudo guardar") + details);
    }
  }

  function applyLocalUpdate(id, diff){
    const productos = getProductos();
    const idx = productos.findIndex(p => String(p.id) === String(id));
    if (idx < 0) return;
    productos[idx] = { ...productos[idx], ...diff };
    UI.setProductos(productos);
  }

  async function duplicate(id){
    loadStoredKey();
    if (!adminKey) return UI.toast("Sin sesión", "Ingresa ADMIN_KEY");
    const p = getProductos().find(x => String(x.id) === String(id));
    if (!p) return UI.toast("No encontrado", "Producto no existe");

    UI.toast("Duplicando…", "Creando copia");
    try{
      const resp = await Api.postAction("duplicateProduct", { id }, adminKey);
      if (!resp || resp.ok !== true) throw new Error(resp && resp.message ? resp.message : "Error duplicando");
      await UI.refreshProductos();
      renderAdminList($("#admSearch") ? $("#admSearch").value : "");
      UI.toast("Listo", "Producto duplicado");
    } catch(err){
      console.error(err);
      const details = (err && err.details && err.details.body) ? (" " + String(err.details.body).slice(0,200)) : "";
      UI.toast("Error", (err.code ? "["+err.code+"] " : "") + (err.message || "No se pudo duplicar") + details);
    }
  }

  async function toggleActive(id){
    loadStoredKey();
    if (!adminKey) return UI.toast("Sin sesión", "Ingresa ADMIN_KEY");
    const p = getProductos().find(x => String(x.id) === String(id));
    if (!p) return UI.toast("No encontrado", "Producto no existe");

    const active = (String(p.activo ?? 1) === "0") ? "1" : "0";
    UI.toast("Aplicando…", active === "1" ? "Activando" : "Desactivando");
    try{
      const resp = await Api.postAction("setActive", { id, activo: active }, adminKey);
      if (!resp || resp.ok !== true) throw new Error(resp && resp.message ? resp.message : "Error");
      applyLocalUpdate(id, { activo: active });
      await UI.refreshProductos();
      renderAdminList($("#admSearch") ? $("#admSearch").value : "");
      UI.toast("OK", active === "1" ? "Activado" : "Desactivado");
    } catch(err){
      console.error(err);
      const details = (err && err.details && err.details.body) ? (" " + String(err.details.body).slice(0,200)) : "";
      UI.toast("Error", (err.code ? "["+err.code+"] " : "") + (err.message || "No se pudo aplicar") + details);
    }
  }

  function init(){
    els.adminModal = $("adminModal");
    els.adminEditModal = $("adminEditModal");
    els.adminBody = $("adminBody");
    els.adminEditBody = $("adminEditBody");
    els.adminEditFooter = $("adminEditFooter");

    loadStoredKey();
  }

  window.SDCO_Admin = { openAdmin };

  document.addEventListener("DOMContentLoaded", init);
})();
