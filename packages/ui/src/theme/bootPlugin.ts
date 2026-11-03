// Script mínimo que fija tema, densidad y tipografía ANTES del primer pintado (RF-2.4). Se inyecta en el <head> de las dos aplicaciones.
// Debe ser JavaScript clásico y autocontenido: se ejecuta antes que cualquier módulo. Lee las mismas claves que `LocalStoragePreferences`.
export const themeBootScript = `(function(){try{
var r=document.documentElement,g=function(k){try{return localStorage.getItem("vnote:"+k)}catch(e){return null}};
var t=g("theme"),d=false;
try{d=!!matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}
r.setAttribute("data-theme",t==="dark"||t==="light"?t:(d?"dark":"light"));
var s=g("density");if(s==="compact"||s==="comfortable")r.setAttribute("data-density",s);
var f=g("font");if(f==="serif"||f==="mono"||f==="sans")r.setAttribute("data-font",f);
}catch(e){}})();`;

/** Plugin de Vite: añade el script de arranque como primer elemento del <head>, sin `defer` ni `type="module"`. */
export function themeBootPlugin() {
  return {
    name: "vnote-theme-boot",
    transformIndexHtml() {
      return [{ tag: "script", children: themeBootScript, injectTo: "head-prepend" as const }];
    },
  };
}
