// The company name (APP_COMPANY in the root .env), usable from browser and
// server code alike. Inlined at build time by vite.config.ts - so, unlike
// the rest of .env.schema, it isn't read at runtime and changing it needs a
// rebuild (or a dev-server restart). Never import .env.schema in browser code.
export const APP_COMPANY: string = __APP_COMPANY__
