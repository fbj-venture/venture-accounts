import { getAvatarJpeg } from "#/lib/avatar.server.ts"
import { getVerifiedSession } from "#/lib/auth-session.server.ts"
import { createFileRoute } from "@tanstack/react-router"

// Serves a user's avatar. Only signed-in users can fetch one. The URL carries
// ?v=<updatedAt>, which changes whenever the picture does, so the browser can
// keep it for a long time.
export const Route = createFileRoute("/api/avatar/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { userId: string } }) => {
        const session = await getVerifiedSession(request.headers)
        if (!session) {
          return new Response("Unauthorized", { status: 401 })
        }
        const jpeg = await getAvatarJpeg(params.userId)
        if (!jpeg) {
          return new Response("Not found", { status: 404 })
        }
        return new Response(new Uint8Array(jpeg), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, max-age=31536000, immutable",
          },
        })
      },
    },
  },
})
