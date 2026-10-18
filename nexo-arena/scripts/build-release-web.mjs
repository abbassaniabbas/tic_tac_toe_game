import { spawn } from "node:child_process";
import { releaseIssues } from "./release-config.mjs";
import { loadWebEnvironment } from "./web-environment.mjs";
loadWebEnvironment();
const issues = releaseIssues(process.env, {
  target: "web",
  offline: process.env.NEXO_OFFLINE_RELEASE === "1",
});
if (issues.length) {
  console.error("Web release inputs are incomplete:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    { stdio: "inherit", env: process.env },
  );
  child.on("error", () => {
    console.error("Could not start web build.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
