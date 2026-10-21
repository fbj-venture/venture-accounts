import { defineConfig } from "vite-plus"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    tasks: {
      "docker:build": { command: "docker build -t venture-accounts .", cache: false },
      "docker:up": { command: "docker run --rm -p 3000:3000 --env-file .env venture-accounts" },
      "docker-compose:up": {
        command: "docker compose -f docker-compose-dev.yaml up -d",
        cache: false,
      },
      "docker-compose:down": {
        command: "docker compose -f docker-compose-dev.yaml down",
        cache: false,
      },
    },
  },
})
