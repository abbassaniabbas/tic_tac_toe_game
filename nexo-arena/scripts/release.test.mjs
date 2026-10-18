import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { releaseIssues } from "./release-config.mjs";
const config = {
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@nexoarena.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrst",
  EXPO_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrst",
  EXPO_PUBLIC_WEB_URL: "https://nexoarena.test",
  APP_IDENTIFIER: "com.abbas.nexoarena",
  EAS_PROJECT_ID: "11111111-1111-4111-8111-111111111111",
  APP_VARIANT: "production",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  INVITE_SIGNING_SECRET: "a".repeat(64),
};
test("accepts complete production inputs and makes offline web releases explicit", () => {
  assert.deepEqual(releaseIssues(config), []);
  assert.deepEqual(
    releaseIssues(
      { NEXT_PUBLIC_SUPPORT_EMAIL: config.NEXT_PUBLIC_SUPPORT_EMAIL },
      { target: "web", offline: true },
    ),
    [],
  );
  assert(releaseIssues(config, { target: "web", offline: true }).length > 0);
  assert.notEqual(releaseIssues({}, { target: "web" }).length, 0);
});
test("rejects public administrative keys without echoing their secret values", () => {
  const secret = "sb_secret_sensitive-value-never-print";
  const errors = releaseIssues({
    ...config,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret,
  });
  assert(errors.some((e) => e.includes("administrative keys")));
  assert(errors.every((e) => !e.includes(secret)));
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  assert(
    releaseIssues({ ...config, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt })
      .length > 0,
  );
});
test("rejects mismatched/local endpoints, provisional signing metadata and weak secrets", () => {
  assert(
    releaseIssues({
      ...config,
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54341",
      APP_IDENTIFIER: "com.nexoarena.game",
      EAS_PROJECT_ID: "todo",
      APP_VARIANT: "preview",
      INVITE_SIGNING_SECRET: "weak",
    }).length >= 5,
  );
});
test("restricts offline checks to the guest web target and accepts legacy anon keys", () => {
  assert(releaseIssues({}, { target: "all", offline: true }).length > 0);
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
  assert.deepEqual(
    releaseIssues(
      { ...config, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt },
      { target: "web" },
    ),
    [],
  );
});
test("preserves Xcode project UUID generation with the patched transitive dependency", () => {
  const require = createRequire(import.meta.url),
    xcode = require("xcode"),
    project = xcode.project("unused.pbxproj");
  project.hash = { project: { objects: {} } };
  const ids = Array.from({ length: 100 }, () => project.generateUuid());
  assert(ids.every((id) => /^[A-F0-9]{24}$/.test(id)));
  assert.equal(new Set(ids).size, 100);
  assert.equal(
    createRequire(require.resolve("xcode"))("uuid/package.json").version,
    "11.1.1",
  );
});
