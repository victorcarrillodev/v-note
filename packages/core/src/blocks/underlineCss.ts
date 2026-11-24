// CSS de los tres trazos del subrayado con estilo, compartido por el editor (`editor/underline.css`) y el documento exportado.
// Una prueba de la interfaz comprueba que ese archivo tiene exactamente estas reglas. Solo `var(--ul)`: el color lo pone quien lo usa.
export const UNDERLINE_EFFECTS_CSS: readonly string[] = [
  ".ul{--ul:currentColor;}",
  ".ul[data-ul-kind=line]{text-decoration:underline;text-decoration-color:var(--ul);text-decoration-thickness:0.11em;text-underline-offset:0.2em;text-decoration-skip-ink:auto;}",
  ".ul[data-ul-kind=soft]{background-image:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--ul)calc(95% * var(--underline-strength,1)),transparent)40%,color-mix(in srgb,var(--ul)calc(60% * var(--underline-strength,1)),transparent)72%,transparent);background-size:100% 0.7em;background-position:0 96%;background-repeat:no-repeat;padding:0 0.12em;margin:0 -0.12em;border-radius:0.35em;box-decoration-break:clone;-webkit-box-decoration-break:clone;}",
  ".ul[data-ul-kind=marker]{background-image:linear-gradient(104deg,color-mix(in srgb,var(--ul)calc(92% * var(--underline-strength,1)),transparent),color-mix(in srgb,var(--ul)calc(62% * var(--underline-strength,1)),transparent)50%,color-mix(in srgb,var(--ul)calc(88% * var(--underline-strength,1)),transparent));background-size:100% 0.52em;background-position:0 90%;background-repeat:no-repeat;padding:0 0.22em;margin:0 -0.22em;border-radius:0.7em 0.2em 0.55em 0.25em / 0.35em 0.5em 0.3em 0.45em;box-decoration-break:clone;-webkit-box-decoration-break:clone;}",
];
