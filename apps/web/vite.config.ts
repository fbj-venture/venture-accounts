import { devtools } from '@tanstack/devtools-vite';
import { defineConfig } from 'vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({ eventBusConfig: { port: 6206 } }),
    nitroV2Plugin({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
