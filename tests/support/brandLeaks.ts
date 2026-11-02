const NAME = /(?<![\w-])v-note(?![\w-])/i;

/** Devuelve "archivo:línea" por cada aparición del nombre del producto escrita a mano. */
export function findBrandLeaks(text: string, file: string): string[] {
  return text
    .split("\n")
    .flatMap((line, i) => (NAME.test(line) ? [`${file}:${i + 1}`] : []));
}
