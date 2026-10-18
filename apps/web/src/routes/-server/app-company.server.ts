import { createServerFn } from "@tanstack/react-start"
import { ENV } from "varlock/env"

// The company name (APP_COMPANY), read from the server's environment on each
// call rather than compiled into the bundle, so changing it only needs a
// restart (or, in Docker, a different `environment:` value) - not a rebuild.
export const getAppCompany = createServerFn({ method: "GET" }).handler(async () => ENV.APP_COMPANY)
