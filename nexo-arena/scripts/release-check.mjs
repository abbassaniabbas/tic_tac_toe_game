import { releaseIssues } from "./release-config.mjs";
import { loadWebEnvironment } from "./web-environment.mjs";
const args = process.argv.slice(2),
  target = args.find((a) => a.startsWith("--target="))?.slice(9) ?? "all";
if (target === "all" || target === "web") loadWebEnvironment();
const issues = releaseIssues(process.env, {
  target,
  offline: args.includes("--offline"),
});
if (issues.length) {
  console.error("Release configuration needs attention:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else
  console.log(
    `Release configuration passed for ${target}${args.includes("--offline") ? " (offline guest site)" : ""}. This check does not prove deployment, signing, security acceptance or device verification.`,
  );
