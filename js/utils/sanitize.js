// Sanitización básica de HTML permitido en descripción (lista blanca mínima).
// Recomendación: guardar descripción como texto en Sheets. Si necesitas HTML, usamos allowlist.
const ALLOWED = new Set(["B","STRONG","I","EM","U","BR","P","UL","OL","LI","A"]);
const ALLOWED_ATTR = { A: new Set(["href","target","rel"]) };

export function sanitizeHtml(html){
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const walk = (node)=>{
    [...node.childNodes].forEach((ch)=>{
      if (ch.nodeType === 1){
        if (!ALLOWED.has(ch.tagName)){
          const frag = document.createDocumentFragment();
          while (ch.firstChild) frag.appendChild(ch.firstChild);
          ch.replaceWith(frag);
        }else{
          // limpia atributos
          [...ch.attributes].forEach(a=>{
            const ok = (ALLOWED_ATTR[ch.tagName] && ALLOWED_ATTR[ch.tagName].has(a.name));
            if (!ok) ch.removeAttribute(a.name);
          });
          if (ch.tagName === "A"){
            ch.setAttribute("target","_blank");
            ch.setAttribute("rel","noopener noreferrer");
            const href = ch.getAttribute("href") || "";
            if (!/^https?:\/\//i.test(href)) ch.removeAttribute("href");
          }
          walk(ch);
        }
      }else if (ch.nodeType === 3){
        // text ok
      }else{
        ch.remove();
      }
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}
