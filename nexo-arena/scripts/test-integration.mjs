import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
try {
  const status = JSON.parse(
    execFileSync(
      process.env.NEXO_SUPABASE_PATH ?? "supabase",
      ["status", "-o", "json"],
      { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    ),
  );
  const values = {
    NEXO_INTEGRATION_URL: status.API_URL,
    NEXO_INTEGRATION_KEY: status.ANON_KEY ?? status.PUBLISHABLE_KEY,
    NEXO_INTEGRATION_SERVICE_KEY: status.SERVICE_ROLE_KEY ?? status.SECRET_KEY,
    NEXO_INTEGRATION_MAIL: status.INBUCKET_URL ?? status.MAILPIT_URL,
    NEXO_INTEGRATION_DB: status.DB_URL,
  };
  for (const [name, value] of Object.entries(values))
    if (!value)
      throw new Error(
        `Local status is missing ${name}; run supabase start first.`,
      );
  for (const name of [
    "NEXO_INTEGRATION_URL",
    "NEXO_INTEGRATION_MAIL",
    "NEXO_INTEGRATION_DB",
  ]) {
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(values[name]).hostname,
      )
    )
      throw new Error(
        "Integration tests require loopback services; hosted projects are refused.",
      );
  }
  console.log(
    "Testing real local Auth, email OTP, PostgREST, Edge and Realtime services.",
  );
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["exec", "--", "vitest", "run", "--config", "vitest.integration.config.ts"],
    { cwd, env: { ...process.env, ...values }, stdio: "inherit" },
  );
  child.on("error", () => {
    console.error("Could not start integration tests.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  // CLI output can contain local credentials. Never echo child stdout/stderr here.
  console.error(
    error?.status !== undefined
      ? "Local Supabase is unavailable. Start the services and arena function before running this check."
      : error.message,
  );
  process.exitCode = 1;
}
