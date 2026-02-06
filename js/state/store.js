import { storage } from "../utils/storage.js";
import { clamp } from "../utils/format.js";

const KEY = "SDC_CART_V1";
const UIKEY = "SDC_UI_V1";

function loadCart(){ return storage.get(KEY, { items: [] }); }
function saveCart(c){ storage.set(KEY, c); }

function loadUI(){ return storage.get(UIKEY, { theme: "light" }); }
function saveUI(u){ storage.set(UIKEY, u); }

export const Store = {
  cart: loadCart(),
  ui: loadUI(),
  listeners: new Set(),

  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(){ this.listeners.forEach(fn=>fn()); },

  setTheme(theme){
    this.ui.theme = theme;
    saveUI(this.ui);
    this.emit();
  },

  addToCart(product, qty=1){
    const id = String(product.id);
    const found = this.cart.items.find(i=>i.id===id);
    if (found) found.qty = clamp(found.qty + qty, 1, 99);
    else this.cart.items.push({ id, qty: clamp(qty,1,99) });
    saveCart(this.cart); this.emit();
  },

  setQty(id, qty){
    id = String(id);
    const q = clamp(Number(qty||1), 1, 99);
    const found = this.cart.items.find(i=>i.id===id);
    if (!found) return;
    found.qty = q;
    saveCart(this.cart); this.emit();
  },

  remove(id){
    id = String(id);
    this.cart.items = this.cart.items.filter(i=>i.id!==id);
    saveCart(this.cart); this.emit();
  },

  clear(){
    this.cart = { items: [] };
    saveCart(this.cart); this.emit();
  }
};
