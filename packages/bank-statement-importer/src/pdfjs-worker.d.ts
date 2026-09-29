// pdfjs-dist ships no type declarations for its worker entry point (only
// pdf.d.mts, for the main pdf.mjs). We only need it for its side effect of
// registering globalThis.pdfjsWorker (see index.ts) - its exports aren't
// used directly.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
