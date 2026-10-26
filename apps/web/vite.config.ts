import { varlockVitePlugin } from "@varlock/vite-integration"
import { devtools } from "@tanstack/devtools-vite"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig, lazyPlugins } from "vite-plus"

import { tanstackStart } from "@tanstack/react-start/plugin/vite"

import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"

// Nitro's default output.dir ("{rootDir}/.output") is relative to this app,
// so it lands in apps/web/.output. Deploy platforms (and the root "preview"
// script) expect the build at the repo root instead - pointing Nitro there
// directly means the workspace root doesn't need its own copy step.
const outputDir = fileURLToPath(new URL("../../.output", import.meta.url))

// Name, description and version come from the workspace root package.json.
// The publish date is stamped only by a production build (`vite build`), so
// it stays fixed for a deployed build; the dev server leaves it null.
// See src/lib/app-info.ts.
const rootPackage = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
) as { name: string; description: string; version: string }

const config = defineConfig(({ command }) => ({
  define: {
    __APP_INFO__: JSON.stringify({
      name: rootPackage.name,
      description: rootPackage.description,
      version: rootPackage.version,
      publishedAt: command === "build" ? new Date().toISOString() : null,
    }),
  },
  // Dev only: listen on every network interface (not just localhost) so other
  // devices on the LAN can open the app. allowedHosts: true also accepts any
  // Host header (a name like my-pc.local, not only an IP); Vite otherwise
  // rejects them to stop DNS-rebinding attacks, which matters little on a
  // trusted LAN. Remember BETTER_AUTH_URL (and BETTER_AUTH_TRUSTED_ORIGINS)
  // must match the address the other device uses.
  server: { host: true, allowedHosts: true },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    varlockVitePlugin(),
    devtools({ eventBusConfig: { port: 6206 } }),
    nitro({
      output: { dir: outputDir },
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart({
      // Client code calls the server functions in <route>/-server/*.server.ts;
      // the compiler swaps their handlers for RPC stubs in the browser build.
      // Server-only helpers live in <route>/-server/internal/ (and src/lib), and
      // stay blocked from the browser.
      importProtection: {
        client: { excludeFiles: ["**/routes/**/-server/*.server.ts"] },
      },
    }),
    viteReact(),
  ]),
}))

export default config
