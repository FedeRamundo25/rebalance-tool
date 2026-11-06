(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))a(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const i of n.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function o(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerPolicy&&(n.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?n.credentials="include":t.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function a(t){if(t.ep)return;t.ep=!0;const n=o(t);fetch(t.href,n)}})();const g=["Q3 2026 (Actual)","Q4 2026 (Reorg)","Q1 2027 (Futuro)"],v=[{id:"1",name:"Alberto Gomez",role:"Tehcnical Leader",seniority:"N/A",modality:"Interno",manager:"Horacio Perez",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Customer 360"},{id:"2",name:"Bruno Diaz",role:"Backend",seniority:"Sr",modality:"Interno",manager:"Horacio Perez",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Customer 360"},{id:"3",name:"Carlos Vega",role:"Backend",seniority:"Ssr",modality:"Interno",manager:"Horacio Perez",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Customer 360"},{id:"4",name:"Daniela Luna",role:"Backend",seniority:"Sr",modality:"Interno",manager:"Horacio Perez",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"IPOS"},{id:"5",name:"Esteban Sosa",role:"Backend",seniority:"Sr",modality:"Interno",manager:"Horacio Perez",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"IPOS"},{id:"31",name:"Belen Suarez",role:"Backend",seniority:"Sr",modality:"Externo",manager:"Ruben Diaz",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Billing"},{id:"32",name:"Cristian Navarro",role:"Backend",seniority:"Sr",modality:"Interno",manager:"Ruben Diaz",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Billing"},{id:"81",name:"Humberto Solis",role:"Frontend",seniority:"Sr",modality:"Interno",manager:"Claudia Castro",frozen:!1,warning:!1,pip:!1,teams:{},rotationTypes:{},initialTeam:"Fravega Pay"}];class M{constructor(){const e=localStorage.getItem("rebalance_app_state");if(e){const o=JSON.parse(e);this.engineers=o.engineers||v,this.currentMilestone=o.currentMilestone||g[0]}else this.engineers=[...v],this.currentMilestone=g[0];this.milestones=[...g],this.listeners=[]}subscribe(e){this.listeners.push(e)}notify(){localStorage.setItem("rebalance_app_state",JSON.stringify({engineers:this.engineers,currentMilestone:this.currentMilestone})),this.listeners.forEach(e=>e(this))}setMilestone(e){this.currentMilestone=e,this.notify()}updateEngineerAssignment(e,o,a){const t=this.engineers.find(n=>n.id===e);t&&(t.teams||(t.teams={}),t.teams[a]=o,this.notify())}}const u=new M;function S(s,e){s.innerHTML="",e.milestones.forEach(o=>{const a=document.createElement("button"),t=o===e.currentMilestone;a.className=`px-3 py-1.5 text-xs font-semibold rounded-md transition ${t?"bg-blue-600 text-white shadow":"bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"}`,a.textContent=o,a.onclick=()=>{e.setMilestone(o)},s.appendChild(a)})}function w(s,e){return s.teams&&s.teams[e]?s.teams[e]:s.initialTeam||"Sin Equipo"}function E(s,e,o,a){const t=a[e]&&a[e][s]?a[e][s]:{},n={};o.forEach(l=>{const d=w(l,e);if(d===s&&d!==l.initialTeam){const m=l.role||"Otros";n[m]=(n[m]||0)+1}});const i=[];let p=0,r=0,c=0,f=0;const b=new Set;return Object.keys(t).forEach(l=>{const d=t[l]||0;if(d>0){b.add(l);const m=n[l]||0,x=Math.min(d,m),y=Math.max(0,d-m),h=Math.max(0,m-d);p+=d,r+=x,c+=y,f+=h,i.push({role:l,need:d,covered:x,pending:y,excess:h,added:m})}}),Object.keys(n).forEach(l=>{if(!b.has(l)&&n[l]>0){const d=n[l];f+=d,i.push({role:l,need:0,covered:0,pending:0,excess:d,added:d})}}),{roles:i,totalNeed:p,totalCovered:r,totalPending:c,totalExcess:f,addedCountByRole:n}}function T(s){const e=new Set(["Payments Management"]);return s.forEach(o=>{o.initialTeam&&e.add(o.initialTeam),o.teams&&Object.values(o.teams).forEach(a=>{a&&e.add(a)})}),[...e].sort()}function $(s){var n;const e=document.createElement("div");e.className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4";const o=T(u.engineers),a=((n=s.teams)==null?void 0:n[u.currentMilestone])||s.initialTeam;e.innerHTML=`
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg text-slate-800">Editar Asignación</h3>
        <button id="close-modal" class="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
      </div>
      
      <div class="mb-4">
        <p class="text-sm font-semibold text-slate-700">${s.name}</p>
        <p class="text-xs text-slate-500">${s.role} &bull; ${s.seniority} &bull; Hito: ${u.currentMilestone}</p>
      </div>

      <div class="mb-6">
        <label class="block text-xs font-bold text-slate-600 uppercase mb-2">Equipo Destino</label>
        <select id="team-select" class="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          ${o.map(i=>`<option value="${i}" ${i===a?"selected":""}>${i}</option>`).join("")}
        </select>
      </div>

      <div class="flex justify-end gap-2">
        <button id="btn-cancel" class="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded hover:bg-slate-200">Cancelar</button>
        <button id="btn-save" class="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">Guardar Cambios</button>
      </div>
    </div>
  `,document.body.appendChild(e);const t=()=>e.remove();e.querySelector("#close-modal").onclick=t,e.querySelector("#btn-cancel").onclick=t,e.querySelector("#btn-save").onclick=()=>{const i=e.querySelector("#team-select").value;u.updateEngineerAssignment(s.id,i,u.currentMilestone),t()}}function C(s,e){s.innerHTML="",T(e.engineers).forEach(a=>{const t=e.engineers.filter(r=>w(r,e.currentMilestone)===a),n=E(a,e.currentMilestone,e.engineers,e.teamNeeds),i=document.createElement("div");i.className="bg-slate-100 rounded-lg p-4 flex flex-col gap-3 border border-slate-200 shadow-sm";const p=t.map(r=>{const c=r.teams&&r.teams[e.currentMilestone]&&r.teams[e.currentMilestone]!==r.initialTeam;return`
        <div class="engineer-card bg-white p-3 rounded-md shadow-sm border ${c?"border-amber-400 bg-amber-50/30":"border-slate-200"} hover:shadow-md transition cursor-pointer" data-id="${r.id}">
          <div class="flex justify-between items-start">
            <span class="font-semibold text-sm text-slate-800">${r.name}</span>
            ${c?'<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Rotado</span>':""}
          </div>
          <div class="text-xs text-slate-500 flex justify-between mt-2 pt-2 border-t border-slate-100">
            <span>${r.role} (${r.seniority})</span>
            <span class="text-indigo-600 font-medium">${r.modality}</span>
          </div>
        </div>
      `}).join("");i.innerHTML=`
      <div class="flex justify-between items-center border-b border-slate-200 pb-2">
        <h3 class="font-bold text-slate-700 text-sm">${a}</h3>
        <span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">${t.length}</span>
      </div>
      
      <div class="text-xs bg-white p-2 rounded border border-slate-200 text-slate-600 flex justify-between">
        <span>Necesidad: <strong class="text-slate-800">${n.totalNeed}</strong></span>
        <span>Cubiertas: <strong class="text-blue-600">${n.totalCovered}</strong></span>
        <span>Pendientes: <strong class="${n.totalPending>0?"text-amber-600":"text-slate-800"}">${n.totalPending}</strong></span>
      </div>

      <div class="card-list flex flex-col gap-2 overflow-y-auto max-h-[600px] pr-1">
        ${p.length>0?p:'<div class="text-xs text-slate-400 text-center py-6 italic">Sin miembros</div>'}
      </div>
    `,i.querySelectorAll(".engineer-card").forEach(r=>{const c=r.getAttribute("data-id"),f=e.engineers.find(b=>b.id===c);f&&(r.onclick=()=>$(f))}),s.appendChild(i)})}document.addEventListener("DOMContentLoaded",()=>{const s=document.getElementById("board-container"),e=document.getElementById("milestone-controls");function o(a){S(e,a),C(s,a)}u.subscribe(o),o(u),console.log("🚀 Engineering Rebalance Tool v3.5 - Reactiva y Modular inicializada.")});
