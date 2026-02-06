import { getQuery, setQuery } from "./utils/url.js";

export const Router = {
  onRoute: null,

  start(){
    window.addEventListener("popstate", ()=>this.handle());
    this.handle(true);
  },

  handle(replace=false){
    const q = getQuery();
    this.onRoute?.(q, { replace });
  },

  set(params, opts){
    setQuery(params, opts);
    this.handle(true);
  }
};
