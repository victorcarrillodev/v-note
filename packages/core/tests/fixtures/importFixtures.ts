// T-400: fixtures sintéticos (generados por código, sin datos reales) de una bóveda de Obsidian y de una exportación de Notion.
import { zipSync, strToU8 } from "fflate";
import type { SourceFile } from "../../src/import/types";

const enc = (s: string) => strToU8(s);
/** PNG mínimo válido de 1×1 (para comprobar que la imagen queda adjunta con su contenido). */
export const PNG_1X1 = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

/** Bóveda de Obsidian: carpetas, enlaces [[ ]] (con alias y rotos), imagen local, etiquetas y encabezado YAML. */
export function obsidianVault(): SourceFile[] {
  return [
    { path: "Inicio.md", data: enc("---\ntags: [demo]\n---\n# Inicio\n\nVer [[Proyectos/Plan]] y [[Ideas|mis ideas]]. También [[Nota que no existe]].\n") },
    { path: "Ideas.md", data: enc("# Ideas\n\n- una\n- dos\n\n![dibujo](adjuntos/dibujo.png)\n") },
    { path: "Proyectos/Plan.md", data: enc("# Plan\n\n- [ ] primero\n- [x] segundo\n\nVuelve a [[Inicio]].\n") },
    { path: "Proyectos/Notas/Reunión.md", data: enc("Texto de la reunión con **negrita**.\n") },
    { path: "adjuntos/dibujo.png", data: PNG_1X1 },
    { path: "adjuntos/manual.pdf", data: enc("%PDF-1.4 falso") },
    { path: ".obsidian/app.json", data: enc("{}") },
  ];
}

const ID = (n: number) => n.toString(16).padStart(32, "0");
export const NOTION_IDS = { raiz: ID(0xa1), hijo: ID(0xb2), nieto: ID(0xc3), db: ID(0xd4), fila1: ID(0xe5), fila2: ID(0xf6) };

/** Exportación de Notion (Markdown + CSV): páginas con identificador en el nombre, subpáginas en carpeta, una base con CSV, y elementos sin equivalente. */
export function notionExport(): SourceFile[] {
  const n = NOTION_IDS;
  return [
    { path: `Mi espacio ${n.raiz}.md`, data: enc(`# Mi espacio\n\nBienvenida con un [enlace interno](Mi%20espacio%20${n.raiz}/Subpágina%20${n.hijo}.md) y otro [roto](Inexistente%20${ID(0x99)}.md).\n\n<aside>\n💡 Un bloque de aviso de Notion\n</aside>\n`) },
    { path: `Mi espacio ${n.raiz}/Subpágina ${n.hijo}.md`, data: enc(`# Subpágina\n\nTexto con **negrita**.\n\n![captura](Captura.png)\n`) },
    { path: `Mi espacio ${n.raiz}/Subpágina ${n.hijo}/Nieta ${n.nieto}.md`, data: enc("# Nieta\n\n1. uno\n2. dos\n") },
    { path: `Mi espacio ${n.raiz}/Captura.png`, data: PNG_1X1 },
    { path: `Mi espacio ${n.raiz}/Tareas ${n.db}.csv`, data: enc("Nombre,Estado,Puntos,Hecho\nPrimera,En curso,3,Yes\nSegunda,Listo,5,No\n") },
    { path: `Mi espacio ${n.raiz}/Tareas ${n.db}/Primera ${n.fila1}.md`, data: enc("# Primera\n\nDetalle de la primera tarea.\n") },
    { path: `Mi espacio ${n.raiz}/Tareas ${n.db}/Segunda ${n.fila2}.md`, data: enc("# Segunda\n\nDetalle de la segunda.\n") },
    { path: `Mi espacio ${n.raiz}/Presentación ${ID(0x77)}.pdf`, data: enc("%PDF falso") },
  ];
}

export const zipOf = (files: SourceFile[]): Uint8Array => zipSync(Object.fromEntries(files.map((f) => [f.path, f.data])));
