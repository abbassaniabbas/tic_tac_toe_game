import { loadWebEnvironment } from "./web-environment.mjs";
import { releaseIssues } from "./release-config.mjs";

loadWebEnvironment();
const issues = releaseIssues(process.env, { target: "web" });
if (issues.length) {
  console.error("Hosted verification needs valid public web configuration.");
  process.exitCode = 1;
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const checks = [
    {
      name: "Email authentication service",
      path: "/auth/v1/settings",
      method: "GET",
      valid: (response, body) =>
        response.status === 200 &&
        body.external?.email === true &&
        body.disable_signup === false,
    },
    {
      name: "Anonymous profile access denied",
      path: "/rest/v1/profiles?select=id&limit=0",
      method: "GET",
      valid: (response, body) =>
        [401, 403].includes(response.status) && body.code === "42501",
    },
    {
      name: "Arena requires a signed-in user",
      path: "/functions/v1/arena",
      method: "POST",
      valid: (response, body) =>
        response.status === 401 && body.error === "unauthorized",
    },
    {
      name: "Arena rejects a forged user token",
      path: "/functions/v1/arena",
      method: "POST",
      headers: { authorization: "Bearer invalid-test-token" },
      valid: (response, body) =>
        response.status === 401 && body.error === "unauthorized",
    },
    {
      name: "Browser preflight supports authenticated commands",
      path: "/functions/v1/arena",
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:4173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,apikey,content-type",
      },
      valid: (response) => {
        const allowed = (
          response.headers.get("access-control-allow-headers") ?? ""
        )
          .toLowerCase()
          .split(",")
          .map((v) => v.trim());
        return (
          response.status === 204 &&
          response.headers.get("access-control-allow-origin") === "*" &&
          ["authorization", "apikey", "content-type"].every((v) =>
            allowed.includes(v),
          )
        );
      },
    },
  ];
  for (const check of checks) {
    try {
      const response = await fetch(url + check.path, {
        method: check.method,
        headers: {
          apikey: key,
          ...check.headers,
          ...(check.method === "POST"
            ? { "content-type": "application/json" }
            : {}),
        },
        ...(check.method === "POST" ? { body: "{}" } : {}),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => ({}));
      const passed = check.valid(response, body);
      console.log(
        `${passed ? "PASS" : "FAIL"}: ${check.name} (HTTP ${response.status})`,
      );
      if (!passed) process.exitCode = 1;
    } catch {
      console.error(`FAIL: ${check.name} (connection failed)`);
      process.exitCode = 1;
    }
  }
  console.log(
    "Read-only probes complete. Email delivery and authenticated gameplay need separate verification.",
  );
}
