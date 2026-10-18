import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
const docker =
  process.env.NEXO_DOCKER_PATH ??
  (existsSync("/Applications/Docker.app/Contents/Resources/bin/docker")
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker");
const name = `nexo-test-${process.pid}-${Date.now()}`;
const password = randomBytes(24).toString("hex");
let started = false;
function command(bin, args, { quiet = true, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env,
      stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    if (quiet) {
      child.stdout.on("data", (part) => (output += part));
      child.stderr.on("data", (part) => (output += part));
    }
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(
            new Error(
              `${bin} exited ${code}${quiet ? `: ${output.trim()}` : ""}`,
            ),
          ),
    );
  });
}
async function cleanup() {
  if (started) {
    started = false;
    await command(docker, ["rm", "-fv", name]).catch(() => undefined);
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await cleanup();
    process.exit(130);
  });
try {
  await command(
    docker,
    [
      "run",
      "--pull=never",
      "--name",
      name,
      "--label",
      "nexo.local-test=true",
      "-e",
      "POSTGRES_PASSWORD",
      "-e",
      "POSTGRES_DB=nexo_tests",
      "-p",
      "127.0.0.1::5432",
      "-d",
      "postgres:17-alpine",
    ],
    { env: { ...process.env, POSTGRES_PASSWORD: password } },
  );
  started = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      await command(docker, [
        "exec",
        name,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "nexo_tests",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Local PostgreSQL did not become ready.");
  const endpoint = await command(docker, ["port", name, "5432/tcp"]);
  const port = endpoint.match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error("Unexpected database endpoint.");
  console.log("Testing isolated PostgreSQL 17 with separate connections.");
  await command(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "test:backend"],
    {
      quiet: false,
      env: {
        ...process.env,
        NEXO_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/nexo_tests`,
      },
    },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
