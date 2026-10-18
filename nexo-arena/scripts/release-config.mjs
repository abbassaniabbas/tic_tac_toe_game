/** Validate release inputs without logging their values or calling external services. */
export function releaseIssues(env, { target = "all", offline = false } = {}) {
  const issues = [];
  if (!["all", "web", "mobile", "backend"].includes(target))
    return ["Unknown release target."];
  if (offline && target !== "web")
    return ["Offline release checks apply only to the guest website."];
  const has = (name) =>
    typeof env[name] === "string" && env[name].trim().length > 0;
  const requireValue = (name) => {
    if (!has(name)) issues.push(`${name} is required.`);
  };
  if (target === "web" || target === "all") {
    requireValue("NEXT_PUBLIC_SUPPORT_EMAIL");
    if (
      has("NEXT_PUBLIC_SUPPORT_EMAIL") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.NEXT_PUBLIC_SUPPORT_EMAIL)
    )
      issues.push(
        "NEXT_PUBLIC_SUPPORT_EMAIL must be a valid publisher contact email.",
      );
  }
  if (
    offline &&
    (has("NEXT_PUBLIC_SUPABASE_URL") ||
      has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
  )
    issues.push(
      "An offline guest release must leave online backend variables empty.",
    );
  const https = (name) => {
    requireValue(name);
    if (!has(name)) return;
    try {
      const u = new URL(env[name]);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
        /example\.(com|org|test)$/.test(u.hostname)
      )
        throw new Error();
    } catch {
      issues.push(
        `${name} must be a real HTTPS endpoint without embedded credentials.`,
      );
    }
  };
  const publicKey = (name) => {
    requireValue(name);
    if (!has(name)) return;
    const value = env[name];
    let valid = /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(value);
    if (value.startsWith("eyJ"))
      try {
        valid =
          value.split(".").length === 3 &&
          JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString())
            .role === "anon";
      } catch {}
    if (!valid)
      issues.push(
        `${name} must contain a publishable or legacy anon key; administrative keys are forbidden.`,
      );
  };
  const web = target === "web" || target === "all",
    mobile = target === "mobile" || target === "all",
    backend = target === "backend" || target === "all";
  if (web && !offline) {
    https("NEXT_PUBLIC_SUPABASE_URL");
    publicKey("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  if (mobile) {
    https("EXPO_PUBLIC_SUPABASE_URL");
    publicKey("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    https("EXPO_PUBLIC_WEB_URL");
    requireValue("APP_IDENTIFIER");
    if (
      has("APP_IDENTIFIER") &&
      (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(env.APP_IDENTIFIER) ||
        env.APP_IDENTIFIER === "com.nexoarena.game" ||
        /example|placeholder/.test(env.APP_IDENTIFIER))
    )
      issues.push(
        "APP_IDENTIFIER must use your controlled production identifier.",
      );
    requireValue("EAS_PROJECT_ID");
    if (
      has("EAS_PROJECT_ID") &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        env.EAS_PROJECT_ID,
      )
    )
      issues.push("EAS_PROJECT_ID must be the real Expo project UUID.");
    if (env.APP_VARIANT !== "production")
      issues.push("APP_VARIANT must be production.");
  }
  if (backend) {
    requireValue("SUPABASE_PROJECT_REF");
    if (
      has("SUPABASE_PROJECT_REF") &&
      !/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_REF)
    )
      issues.push("SUPABASE_PROJECT_REF must be a valid project reference.");
    requireValue("INVITE_SIGNING_SECRET");
    if (has("INVITE_SIGNING_SECRET") && env.INVITE_SIGNING_SECRET.length < 32)
      issues.push(
        "INVITE_SIGNING_SECRET must contain at least 32 characters from a secure generator.",
      );
  }
  if (
    web &&
    mobile &&
    env.NEXT_PUBLIC_SUPABASE_URL !== env.EXPO_PUBLIC_SUPABASE_URL
  )
    issues.push("Web and mobile must use the same backend URL.");
  return issues;
}
