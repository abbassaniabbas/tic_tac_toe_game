import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
export function loadWebEnvironment() {
  loadEnvConfig(fileURLToPath(new URL("../apps/web", import.meta.url)), false, {
    info() {},
    error() {
      console.error("Could not load the web environment configuration.");
    },
  });
}
