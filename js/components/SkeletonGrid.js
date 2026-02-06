import { el } from "../utils/dom.js";

export function renderSkeletonGrid(count=8){
  const items = [];
  for (let i=0;i<count;i++){
    items.push(
      el("div",{class:"card"},[
        el("div",{class:"thumb skel"}),
        el("div",{class:"card-body"},[
          el("div",{class:"skel", style:"height:14px;border-radius:10px;width:75%;"}),
          el("div",{class:"skel", style:"height:12px;border-radius:10px;width:55%;margin-top:10px;"}),
          el("div",{class:"skel", style:"height:16px;border-radius:10px;width:40%;margin-top:14px;"}),
          el("div",{style:"display:flex;gap:8px;margin-top:12px"},[
            el("div",{class:"skel", style:"height:36px;border-radius:12px;flex:1"}),
            el("div",{class:"skel", style:"height:36px;border-radius:12px;flex:1"}),
          ])
        ])
      ])
    );
  }
  return items;
}
