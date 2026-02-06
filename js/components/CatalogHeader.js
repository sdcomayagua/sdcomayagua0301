import { el } from "../utils/dom.js";

export function renderCatalogHeader({ title, subtitle, chips, activeChip, onChip, sortValue, onSort }){
  const chipRow = el("div",{class:"chips"}, chips.map(c=>{
    return el("div",{class:"chip", "data-active": String(c===activeChip), onclick:()=>onChip(c)},[c]);
  }));

  const sort = el("select",{class:"select", onchange:(e)=>onSort(e.target.value)},[
    el("option",{value:"relevance", selected: sortValue==="relevance"},["Relevancia"]),
    el("option",{value:"price_asc", selected: sortValue==="price_asc"},["Menor precio"]),
    el("option",{value:"price_desc", selected: sortValue==="price_desc"},["Mayor precio"]),
    el("option",{value:"newest", selected: sortValue==="newest"},["Más nuevos"]),
  ]);

  return el("div",{class:"catalog-header"},[
    el("div",{class:"hgroup"},[
      el("h1",{},[title]),
      el("p",{},[subtitle])
    ]),
    el("div",{class:"row"},[
      chipRow,
      sort
    ])
  ]);
}
