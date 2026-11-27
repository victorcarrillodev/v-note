// pdfjs (versión «legacy», para WebKitGTK) se carga solo al abrir o leer un PDF.
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

async function load(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // pdfjs transfiere el búfer a su Worker: se le entrega una copia. Sin `eval`: la CSP lo prohíbe.
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

export type PdfDocument = Awaited<ReturnType<typeof load>>;
export const openPdf = load;

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await load(bytes);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(content.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : "") : "")).join(""));
    }
    return pages.join("\n");
  } finally {
    await doc.loadingTask.destroy();
  }
}
