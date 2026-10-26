import { getCompanyName } from "#/lib/company-name.server.ts"
import { createFileRoute } from "@tanstack/react-router"

// The web app manifest: what a phone calls the app and which icon it shows
// when it is added to the home screen. Made here rather than kept as a static
// file so the name follows the company name in Company Settings. Public, like
// the login page that shows the same name.
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const company = await getCompanyName()
        const manifest = {
          name: `${company} Accounts`,
          short_name: company,
          description: `${company} bank accounts and expenses`,
          start_url: "/books",
          scope: "/",
          display: "standalone",
          background_color: "#eef1f5",
          theme_color: "#f0522a",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          shortcuts: [
            {
              name: "Add expense",
              url: "/books/expense/new",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
            },
          ],
        }
        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            // Short, so a renamed company shows up soon.
            "Cache-Control": "public, max-age=300",
          },
        })
      },
    },
  },
})
