import{c as h,j as o}from"./index-ppK4AqZ_.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=h("AlignJustify",[["path",{d:"M3 12h18",key:"1i2n21"}],["path",{d:"M3 18h18",key:"1h113x"}],["path",{d:"M3 6h18",key:"d0wm0j"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=h("List",[["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 18h.01",key:"1tta3j"}],["path",{d:"M3 6h.01",key:"1rqtza"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 18h13",key:"1lx6n3"}],["path",{d:"M8 6h13",key:"ik3vkj"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=h("Warehouse",[["path",{d:"M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z",key:"gksnxg"}],["path",{d:"M6 18h12",key:"9pbo8z"}],["path",{d:"M6 14h12",key:"4cwo0f"}],["rect",{width:"12",height:"12",x:"6",y:"10",key:"apd30q"}]]),r=[{bg:"#EBF3FF",text:"hsl(var(--primary))"},{bg:"#F0EBFF",text:"hsl(var(--violet, 262 83% 58%))"},{bg:"#E8FAF3",text:"hsl(var(--success, 142 71% 36%))"},{bg:"#FEF5E7",text:"#B45D04"},{bg:"#FFE8EC",text:"#BE185D"}];function c(e){let t=0;for(let a=0;a<e.length;a++)t=(t<<5)-t+e.charCodeAt(a),t|=0;return Math.abs(t)}function d(e){return e.trim().split(/\s+/).map(t=>t[0]).join("").toUpperCase().slice(0,2)}function l(e){return r[c(e)%r.length]}function u({name:e,size:t="sm",className:a=""}){const s=l(e),n=t==="md"?"w-9 h-9":"w-8 h-8",i=t==="md"?12:11;return o.jsx("div",{className:`${n} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1] ${a}`,style:{backgroundColor:s.bg,color:s.text,fontSize:i,fontWeight:700},children:d(e)})}export{k as A,u as I,y as L,g as W};
