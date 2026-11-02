// T-008 (prueba primero): el conversor puro Yjs -> bloques canónicos coincide con lo que reporta el editor real.
import { test, expect } from "bun:test";
import * as Y from "yjs";
import { readFileSync } from "node:fs";
import { yjsToBlocks, normalizeEditorBlocks } from "../src-converter/yjsToBlocks";

function load(name: string) {
  const f = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, Uint8Array.from(atob(f.update), (c) => c.charCodeAt(0)));
  return { ydoc, editorDoc: f.doc };
}

test("párrafos con estilos, encabezados y listas", () => {
  const { ydoc, editorDoc } = load("basic");
  expect(yjsToBlocks(ydoc.getXmlFragment("doc"))).toEqual(normalizeEditorBlocks(editorDoc));
});

test("código, cita, divisor, desplegable, tabla, imagen y archivo", () => {
  const { ydoc, editorDoc } = load("extra");
  expect(yjsToBlocks(ydoc.getXmlFragment("doc"))).toEqual(normalizeEditorBlocks(editorDoc));
});
