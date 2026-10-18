import type { NextConfig } from "next";
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (publicKey) {
  let privileged = publicKey.startsWith("sb_secret_");
  if (publicKey.startsWith("eyJ")) {
    try {
      privileged =
        JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString())
          .role !== "anon";
    } catch {
      privileged = true;
    }
  }
  if (privileged)
    throw new Error(
      "Only a Supabase publishable or legacy anon key belongs in public build variables.",
    );
}

const config: NextConfig = {
  output: "export",
  transpilePackages: ["@nexo/engine", "@nexo/shared", "@nexo/online"],
  poweredByHeader: false,
  webpack(config) {
    if (process.env.NEXO_BUILD_CACHE === "0") config.cache = false;
    return config;
  },
};
export default config;
