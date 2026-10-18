import { releaseIssues } from "./release-config.mjs";
if (process.env.APP_VARIANT === "production") {
  const issues = releaseIssues(process.env, { target: "mobile" });
  if (issues.length) {
    console.error("Native production inputs are incomplete:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else
    console.log(
      "Native production configuration passed. Signing and device checks remain separate release gates.",
    );
} else
  console.log(
    "Development/preview native build; production release guard is inactive.",
  );
