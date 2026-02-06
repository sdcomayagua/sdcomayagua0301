import { el } from "../utils/dom.js";

let timer = null;
export function toast(title, msg="", ms=2400){
  clearTimeout(timer);
  const wrap = document.querySelector(".toastwrap") || el("div",{class:"toastwrap"});
  const t = el("div",{class:"toast"},[
    el("strong",{},[title]),
    msg ? el("span",{},[msg]) : null
  ]);
  wrap.innerHTML = "";
  wrap.appendChild(t);
  document.body.appendChild(wrap);
  timer = setTimeout(()=>wrap.remove(), ms);
}
