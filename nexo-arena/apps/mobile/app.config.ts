import type { ConfigContext, ExpoConfig } from "expo/config";

const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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

const appConfig = ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? "production";
  const suffix =
    variant === "development"
      ? ".dev"
      : variant === "preview"
        ? ".preview"
        : "";
  // Provisional identifier. Replace with an identifier you control before store submission.
  const identifier = `${process.env.APP_IDENTIFIER ?? "com.nexoarena.game"}${suffix}`;
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    name: `NEXO Arena${suffix === ".dev" ? " Dev" : suffix === ".preview" ? " Preview" : ""}`,
    slug: "nexo-arena",
    version: "1.0.0",
    scheme: suffix ? `nexoarena${suffix.replace(".", "-")}` : "nexoarena",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icon.png",
    ios: {
      bundleIdentifier: identifier,
      supportsTablet: true,
      buildNumber: "1",
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: identifier,
      versionCode: 1,
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#101115",
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash.png",
          imageWidth: 160,
          resizeMode: "contain",
          backgroundColor: "#101115",
          dark: { backgroundColor: "#101115" },
        },
      ],
      [
        "expo-secure-store",
        { configureAndroidBackup: true, faceIDPermission: false },
      ],
      [
        "expo-audio",
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
          enableBackgroundRecording: false,
        },
      ],
      "expo-font",
    ],
    experiments: { typedRoutes: true },
    extra: {
      appVariant: variant,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};

export default appConfig;
