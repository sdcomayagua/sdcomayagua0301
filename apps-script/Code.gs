/****************************************************
 * SDComayagua – Backend PREMIUM (Apps Script)
 * ✅ GET:
 *   ?only=productos | envios | taxonomia
 * ✅ POST (x-www-form-urlencoded o text/plain):
 *   action=updateProduct | createProduct | duplicateProduct | setActive
 * ✅ Seguridad:
 *   admin_key (ADMIN_KEY) obligatoria para POST
 *
 * Notas:
 * - Evita CORS preflight: el frontend manda form-urlencoded.
 * - Cache: se purga cuando hay cambios.
 * - updateProduct NO obliga precio si no lo envías.
 ****************************************************/

// ✅ Tu Sheet ID (SDComayagua)
const SS_ID = "1IG2pHnk7XfZgw4qiyEm_8BuGDNOlJByVv6H_O9PWdrs";

// ✅ Cambia esta clave (y usa la misma en tu admin)
const ADMIN_KEY = "CAMBIA_ESTA_CLAVE";

// Cache (segundos)
const CACHE_TTL = 60;

// Nombres de hojas
const SHEET_PRODUCTS = "productos";
const SHEET_SHIPPING  = "envios";

function doGet(e) {
  const only = (e && e.parameter && e.parameter.only)
    ? String(e.parameter.only).toLowerCase().trim()
    : "";

  const out = {
    ok: true,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!only) {
      out.message = "SDComayagua API online. Usa ?only=productos|envios|taxonomia";
      return json_(out);
    }

    if (only === "productos") {
      out.productos = getSheetDataCached_(SHEET_PRODUCTS);
      return json_(out);
    }

    if (only === "envios") {
      out.envios = getSheetDataCached_(SHEET_SHIPPING);
      return json_(out);
    }

    if (only === "taxonomia") {
      out.taxonomia = buildTaxonomy_();
      return json_(out);
    }

    throw new Error("Parámetro only no soportado: " + only);
  } catch (err) {
    return jsonError_(err);
  }
}

function doPost(e) {
  try {
    const data = parsePost_(e);
    const action = String(data.action || "").trim();
    if (!action) throw new Error("Falta action");

    const adminKey = String(data.admin_key || "").trim();
    if (adminKey !== ADMIN_KEY) throw new Error("ADMIN_KEY incorrecta");

    let result;
    if (action === "updateProduct") result = updateProduct_(data);
    else if (action === "createProduct") result = createProduct_(data);
    else if (action === "duplicateProduct") result = duplicateProduct_(data);
    else if (action === "setActive") result = setActive_(data);
    else throw new Error("Acción no soportada: " + action);

    // ✅ Purge cache en cambios
    purgeCache_();

    return json_({
      ok: true,
      action: action,
      result: result,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError_(err);
  }
}

/** ---------- Helpers ---------- **/

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function jsonError_(err) {
  const msg = (err && err.message) ? err.message : String(err);
  // Log técnico (ver en Apps Script > Ejecutar > Registros)
  console.error(err);
  return json_({
    ok: false,
    message: msg,
    error: {
      name: err && err.name ? err.name : "Error",
      message: msg,
      stack: err && err.stack ? String(err.stack).slice(0, 2000) : "",
    },
    updatedAt: new Date().toISOString(),
  });
}

function parsePost_(e) {
  const out = {};
  // Params por URL (si existieran)
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(k => out[k] = e.parameter[k]);
  }

  if (!e || !e.postData) return out;

  const type = String(e.postData.type || "").toLowerCase();
  const raw = String(e.postData.contents || "");

  // JSON (por si alguien prueba con Postman)
  if (type.indexOf("application/json") >= 0) {
    try {
      const obj = JSON.parse(raw);
      Object.keys(obj || {}).forEach(k => out[k] = obj[k]);
      return out;
    } catch (err) {
      // sigue a parse de querystring
    }
  }

  // x-www-form-urlencoded OR text/plain con querystring
  const parsed = parseQueryString_(raw);
  Object.keys(parsed).forEach(k => out[k] = parsed[k]);
  return out;
}

function parseQueryString_(s) {
  const out = {};
  const txt = String(s || "").trim();
  if (!txt) return out;
  const parts = txt.split("&");
  parts.forEach(p => {
    const i = p.indexOf("=");
    if (i < 0) return;
    const k = decodeURIComponent(p.slice(0, i).replace(/\+/g, " "));
    const v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, " "));
    out[k] = v;
  });
  return out;
}

function getSS_() {
  return SpreadsheetApp.openById(SS_ID);
}

function getSheet_(name) {
  const ss = getSS_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error("Hoja no existe: " + name);
  return sh;
}

function getHeaderMap_(values) {
  const header = values && values.length ? values[0] : [];
  const map = {};
  for (let c = 0; c < header.length; c++) {
    const key = String(header[c] || "").trim();
    if (key) map[key] = c + 1; // 1-based col
  }
  return map;
}

function isSeparatorRow_(rowObj) {
  const id = String(rowObj.id || "");
  const name = String(rowObj.nombre || "");
  if (id.toUpperCase().indexOf("SEP_") === 0) return true;
  if (name.indexOf("—") >= 0) return true;
  return false;
}

/** ---------- Cache + Sheet read ---------- **/

function getSheetDataCached_(sheetName) {
  const cache = CacheService.getScriptCache();
  const key = "sdco:" + sheetName;
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const data = getSheetData_(sheetName);
  cache.put(key, JSON.stringify(data), CACHE_TTL);
  return data;
}

function purgeCache_() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(["sdco:" + SHEET_PRODUCTS, "sdco:" + SHEET_SHIPPING, "sdco:taxonomia"]);
}

function getSheetData_(sheetName) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const header = values[0].map(x => String(x || "").trim());
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      const k = header[c];
      if (!k) continue;
      obj[k] = row[c];
    }
    out.push(obj);
  }
  return out;
}

/** ---------- Taxonomy ---------- **/

function buildTaxonomy_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("sdco:taxonomia");
  if (cached) return JSON.parse(cached);

  const productos = getSheetDataCached_(SHEET_PRODUCTS);
  const cats = {};

  productos.forEach(p => {
    if (!p || isSeparatorRow_(p)) return;
    if (String(p.activo || "1") === "0") return;

    const c = String(p.categoria || "").trim();
    const s = String(p.subcategoria || "").trim();

    if (!c) return;
    if (!cats[c]) cats[c] = {};
    if (s) cats[c][s] = true;
  });

  const tax = Object.keys(cats).sort().map(c => ({
    categoria: c,
    subcategorias: Object.keys(cats[c]).sort(),
  }));

  cache.put("sdco:taxonomia", JSON.stringify(tax), CACHE_TTL);
  return tax;
}

/** ---------- Write operations ---------- **/

function findRowById_(sh, headerMap, id) {
  const idCol = headerMap["id"];
  if (!idCol) throw new Error("Falta columna 'id'");
  const last = sh.getLastRow();
  if (last < 2) return -1;

  const range = sh.getRange(2, idCol, last - 1, 1).getValues();
  for (let i = 0; i < range.length; i++) {
    if (String(range[i][0]) === String(id)) return i + 2; // sheet row
  }
  return -1;
}

function updateProduct_(data) {
  const sh = getSheet_(SHEET_PRODUCTS);
  const values = sh.getDataRange().getValues();
  const headerMap = getHeaderMap_(values);

  const id = String(data.id || "").trim();
  if (!id) throw new Error("Falta id");

  const rowNum = findRowById_(sh, headerMap, id);
  if (rowNum < 0) throw new Error("No encontré el producto con id: " + id);

  // ✅ Actualiza SOLO campos enviados (no obliga precio si no viene)
  const allowed = [
    "nombre", "categoria", "subcategoria", "subsubcategoria", "marca",
    "precio", "stock", "activo", "tags", "descripcion",
    "img", "video_url", "tiktok_url", "youtube_url", "facebook_url",
    "oferta", "nuevo",
    "ofertas_json",
    "galeria_1", "galeria_2", "galeria_3", "galeria_4",
    "galeria_5", "galeria_6", "galeria_7", "galeria_8"
  ];

  const changes = {};
  allowed.forEach(k => {
    if (data[k] === undefined) return;
    if (!headerMap[k]) return;

    let v = data[k];

    // Normaliza números
    if (k === "precio" || k === "stock" || k === "oferta" || k === "nuevo") {
      v = (String(v).trim() === "") ? "" : Number(v);
      if (v !== "" && !isFinite(v)) v = "";
    }

    // Activo 1/0
    if (k === "activo") v = (String(v) === "0") ? 0 : 1;

    changes[k] = v;
  });

  if (Object.keys(changes).length === 0) {
    return { updated: false, id: id, message: "Nada que actualizar" };
  }

  // Write each changed field
  Object.keys(changes).forEach(k => {
    const col = headerMap[k];
    sh.getRange(rowNum, col).setValue(changes[k]);
  });

  return { updated: true, id: id, fields: Object.keys(changes) };
}

function createProduct_(data) {
  const sh = getSheet_(SHEET_PRODUCTS);
  const values = sh.getDataRange().getValues();
  const headerMap = getHeaderMap_(values);
  const header = values[0];

  let id = String(data.id || "").trim();
  if (!id) id = "P" + Utilities.getUuid().slice(0, 8);

  // Evita duplicados
  const existingRow = findRowById_(sh, headerMap, id);
  if (existingRow > 0) throw new Error("Ya existe un producto con id: " + id);

  const row = new Array(header.length).fill("");
  row[headerMap["id"] - 1] = id;

  // Escribe campos si vienen (solo si existe columna)
  Object.keys(headerMap).forEach(k => {
    if (k === "id") return;
    if (data[k] === undefined) return;
    row[headerMap[k] - 1] = data[k];
  });

  // Defaults
  if (headerMap["activo"]) row[headerMap["activo"] - 1] = 1;

  sh.appendRow(row);
  return { created: true, id: id };
}

function duplicateProduct_(data) {
  const sh = getSheet_(SHEET_PRODUCTS);
  const values = sh.getDataRange().getValues();
  const headerMap = getHeaderMap_(values);

  const id = String(data.id || "").trim();
  if (!id) throw new Error("Falta id");

  const rowNum = findRowById_(sh, headerMap, id);
  if (rowNum < 0) throw new Error("No encontré id para duplicar: " + id);

  const rowValues = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
  const newId = "P" + Utilities.getUuid().slice(0, 8);
  rowValues[headerMap["id"] - 1] = newId;

  // Si hay created_at, actualizar
  if (headerMap["created_at"]) rowValues[headerMap["created_at"] - 1] = new Date();

  sh.appendRow(rowValues);
  return { duplicated: true, from: id, id: newId };
}

function setActive_(data) {
  const sh = getSheet_(SHEET_PRODUCTS);
  const values = sh.getDataRange().getValues();
  const headerMap = getHeaderMap_(values);

  const id = String(data.id || "").trim();
  if (!id) throw new Error("Falta id");
  if (!headerMap["activo"]) throw new Error("Falta columna activo");

  const rowNum = findRowById_(sh, headerMap, id);
  if (rowNum < 0) throw new Error("No encontré id: " + id);

  const activo = (String(data.activo) === "0") ? 0 : 1;
  sh.getRange(rowNum, headerMap["activo"]).setValue(activo);

  return { updated: true, id: id, activo: activo };
}
