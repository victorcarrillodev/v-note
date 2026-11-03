// Genera `docs/design/guia-de-estilo.md`: prosa de la guía + tablas tomadas de `tokens.ts` (así la guía no diverge del código).
// Uso: `bun packages/ui/src/design/build-guide.ts`. La prueba del catálogo comprueba que cada token está mencionado.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { colors, chips, blockColors, typography, spacing, radii, motion, layers, sizes, elevation } from "./tokens";
import { contrastRatio } from "./contrast";
import brandConfig from "../../../../brand.config.json";

const r = (a: string, b: string) => contrastRatio(a, b).toFixed(1).replace(".", ",");
const colorRows = Object.entries(colors).map(([k, v]) => `| \`${k}\` | ${v.light} | ${v.dark} |`).join("\n");
const typoRows = Object.entries(typography).map(([k, l]) => `| \`${k}\` | ${l.size} / ${l.line} | ${l.weight} |`).join("\n");
const radiiRows = Object.entries(radii).map(([k, v]) => `| \`${k}\` | ${v === 9999 ? "circular" : v + " px"} |`).join("\n");
const motionRows = Object.entries(motion).map(([k, v]) => `| \`${k}\` | ${v} ms |`).join("\n");
const layerRows = Object.entries(layers).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
const sizeRows = Object.entries(sizes).map(([k, v]) => `| \`${k}\` | ${v} px |`).join("\n");
const chipRows = Object.entries(chips).map(([k, v]) => `| ${k} | ${v.light.fg} / ${v.light.bg} (${r(v.light.fg, v.light.bg)}) | ${v.dark.fg} / ${v.dark.bg} (${r(v.dark.fg, v.dark.bg)}) |`).join("\n");
const blockRows = Object.entries(blockColors).map(([k, v]) => `| ${k} | ${v.light.text} / ${v.light.bg} | ${v.dark.text} / ${v.dark.bg} |`).join("\n");

const md = `# Guía de estilo de ${brandConfig.name}

> Generada por \`packages/ui/src/design/build-guide.ts\` a partir del catálogo de valores (\`tokens.ts\`) y comprobada por pruebas. Implementa la spec 002 (\`docs/specs/002-v-note-ui\`). **No edites las tablas a mano**: cambia \`tokens.ts\` y regenera.

## Principios

1. **El contenido es el protagonista**: barras y menús discretos, acciones que aparecen al pasar el cursor.
2. **Calidez sobria**: papel cálido en claro, carbón neutro en oscuro, un solo acento azul, sin degradados en la interfaz.
3. **Orientación constante**: barra lateral y cabecera siempre en el mismo lugar.
4. **Nunca temer perder algo**: deshacer antes que preguntar; confirmar solo lo irreversible.
5. **Accesible por defecto**: AA en ambos temas, foco visible, teclado completo, movimiento reducible.
6. **Honestidad**: la interfaz solo muestra lo que el producto realmente hace.
7. **Local y privado**: ningún recurso visual viene de internet.

## Color

Los nombres son semánticos (uso, no tono). Cada valor tiene variante clara y oscura. Los valores se verificaron contra el contraste exigido (prueba \`tokens.test.ts\`).

| Token | Claro | Oscuro |
|---|---|---|
${colorRows}

Contrastes calculados (claro / oscuro): \`text\` sobre \`canvas\` ${r(colors.text.light, colors.canvas.light)} / ${r(colors.text.dark, colors.canvas.dark)}; \`textMuted\` ${r(colors.textMuted.light, colors.canvas.light)} / ${r(colors.textMuted.dark, colors.canvas.dark)}; \`accent\` ${r(colors.accent.light, colors.canvas.light)} / ${r(colors.accent.dark, colors.canvas.dark)}; \`borderControl\` sobre \`canvas\` ${r(colors.borderControl.light, colors.canvas.light)} / ${r(colors.borderControl.dark, colors.canvas.dark)}.

### Chips y avisos semánticos (texto / fondo, contraste entre paréntesis)

| Tipo | Claro | Oscuro |
|---|---|---|
${chipRows}

### Colores de bloque (texto / resaltado)

Se guardan por **nombre**; el tema decide el valor, así «rojo» es legible en claro y en oscuro.

| Nombre | Claro | Oscuro |
|---|---|---|
${blockRows}

### Ajustes respecto del mockup (RF-1.8)

| Valor del mockup | Problema (contraste calculado) | Valor del estándar |
|---|---|---|
| Texto secundario #787774 | ${r("#787774", colors.canvas.light)} sobre marfil (4,27 < 4,5) | ${colors.textMuted.light} (${r(colors.textMuted.light, colors.canvas.light)}) |
| Acento #2383E2 como texto | ${r("#2383E2", colors.canvas.light)} | ${colors.accent.light} (${r(colors.accent.light, colors.canvas.light)}) |
| Advertencia #D9730D como texto | ${r("#D9730D", colors.canvas.light)} | ${colors.warning.light} (${r(colors.warning.light, colors.canvas.light)}) en claro |
| Peligro #DF5452 como texto | ${r("#DF5452", colors.canvas.light)} | ${colors.danger.light} (${r(colors.danger.light, colors.canvas.light)}) en claro |
| Éxito #4DAB9A como texto | ${r("#4DAB9A", colors.canvas.light)} | ${colors.success.light} (${r(colors.success.light, colors.canvas.light)}) en claro |
| Textos de 10 px | Por debajo del mínimo | Mínimo 11 px (solo etiquetas) y 12 px para el resto |

## Degradados

No se usan en la interfaz. Solo cuatro usos permitidos: portadas de página, logotipo e ícono, esqueleto de carga (estático con «reducir movimiento») y desvanecimiento de desbordamiento.

## Tipografía

Familias: sans = Inter, mono = JetBrains Mono, serif = Source Serif 4 (incluidas en la aplicación, subconjunto latino, licencia SIL OFL; sin red). Pila de respaldo del sistema.

| Nivel | Tamaño / interlineado | Peso |
|---|---|---|
${typoRows}

Reglas: interfaz ≥ 12 px; etiqueta ≥ 11 px (solo rótulos); lectura ≥ 15 px; números tabulares en tablas y fechas.

## Espaciado, radios, elevación, movimiento, capas y tamaños

Espaciado de base 4 px: ${spacing.join(", ")}.

| Radio | Valor |
|---|---|
${radiiRows}

Elevación: en claro, borde y sombra (niveles 1 a 4: ${Object.values(elevation.light).map((e) => e.shadow).join("; ")}); en oscuro, escalón de superficie sin sombra difusa.

| Movimiento | Duración |
|---|---|
${motionRows}

Con «reducir movimiento» se eliminan desplazamientos y escalas.

| Capa | z |
|---|---|
${layerRows}

| Tamaño | Valor |
|---|---|
${sizeRows}

## Tamaños de ventana

Puntos de corte: ≥ 1 280 px amplio; 1 040–1 279 px normal; 900–1 039 px estrecho (la barra lateral se pliega sola y se abre superpuesta); < 900 px solo desplazamiento. **No existe diseño específico para teléfono ni tableta** (fuera de alcance de la spec 002). Ancho de lectura de página: 720 px.

## Foco y objetivos de clic

Anillo doble: 2 px de acento + 2 px de separación con la superficie. Objetivos de clic mínimos de 24 × 24 px; controles principales 32 px.

## Íconos

Un único conjunto de trazo (1,75 hasta 20 px; 1,5 desde 24 px), heredan el color del texto. Un significado = un ícono (mapa en \`iconMap.ts\`). Un ícono solo siempre lleva nombre accesible y tooltip.

## Componentes

Cada componente existe una sola vez y cubre sus estados (reposo, hover, foco, activo, deshabilitado, error, carga, vacío). Se consultan en el **catálogo de componentes** (entrada de desarrollo \`apps/web/catalog.html\`, solo en desarrollo).

## Modales, emergentes y avisos

- Confirmación destructiva: foco inicial en el botón seguro; el velo no cierra; botón de peligro.
- Modal de formulario: foco atrapado y devuelto; Escape cierra (con confirmación si hay cambios); cuerpo con desplazamiento y pie fijo; máximo dos niveles (solo una confirmación sobre un modal).
- Errores accionables: avisos persistentes en el lugar donde ocurrieron, nunca solo temporales.

## Excepciones al estándar

Toda excepción (un valor suelto, un componente propio que no usa el catálogo) debe registrarse aquí con su motivo y quién la aprobó. La prueba «sin valores sueltos» admite excepciones solo mediante \`looseValues.baseline.json\`, que únicamente puede encogerse.

Excepciones vigentes: ninguna nueva. La lista base contiene el código anterior al rediseño y se retira por pantallas hasta quedar vacía (tarea de cierre del Hito 4).
`;
mkdirSync(resolve(__dirname, "../../../../docs/design"), { recursive: true });
writeFileSync(resolve(__dirname, "../../../../docs/design/guia-de-estilo.md"), md);
console.log("guía generada");
