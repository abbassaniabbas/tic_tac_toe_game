import "react-native-url-polyfill/auto";
import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  createChunkedStorage,
  makeOnlineClient,
  validateOnlineConfig,
} from "@nexo/online";
import { AccountProvider } from "@nexo/online/react";
const config = validateOnlineConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const storage = createChunkedStorage(
  {
    get: SecureStore.getItemAsync,
    set: (key, value) =>
      SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    remove: SecureStore.deleteItemAsync,
  },
  Crypto.randomUUID,
);
const client = config
  ? makeOnlineClient(config, Platform.OS === "web" ? undefined : storage)
  : null;
export function NativeAccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!client || Platform.OS === "web") return;
    const update = (state: string) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const listener = AppState.addEventListener("change", update);
    return () => {
      listener.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);
  return <AccountProvider client={client}>{children}</AccountProvider>;
}
export function invitationLink(token: string): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  if (web) {
    try {
      const url = new URL(web);
      if (
        url.protocol === "https:" ||
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ) {
        url.searchParams.set("invite", token);
        return url.toString();
      }
    } catch {}
  }
  // Pasteable codes work across native and web builds even without a hosted website.
  return token;
}
