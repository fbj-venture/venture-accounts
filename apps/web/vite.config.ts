import { devtools } from '@tanstack/devtools-vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';

// Nitro's default output.dir ("{rootDir}/.output") is relative to this app,
// so it lands in apps/web/.output. Deploy platforms (and the root "preview"
// script) expect the build at the repo root instead - pointing Nitro there
// directly means the workspace root doesn't need its own copy step.
const outputDir = fileURLToPath(new URL("../../.output", import.meta.url));

// APP_COMPANY comes from the workspace root .env (or the platform's real
// environment variables) and is inlined at build time as __APP_COMPANY__, so
// the same value is available to browser and server code alike - see
// src/lib/app-company.ts. Mirrors the default in @app/env.
const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const config = defineConfig(({ mode }) => ({
  define: {
    __APP_COMPANY__: JSON.stringify(loadEnv(mode, rootDir, "").APP_COMPANY || "Venture"),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({ eventBusConfig: { port: 6206 } }),
    nitroV2Plugin({
      output: { dir: outputDir },
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config
