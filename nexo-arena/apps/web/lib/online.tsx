"use client";
import { useEffect, useState, type ReactNode } from "react";
import { makeOnlineClient, validateOnlineConfig } from "@nexo/online";
import { AccountProvider } from "@nexo/online/react";
import type { SupabaseClient } from "@supabase/supabase-js";
let singleton: SupabaseClient | null = null;
export function WebAccountProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    const config = validateOnlineConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    if (config) {
      singleton ??= makeOnlineClient(config);
      setClient(singleton);
    }
  }, []);
  return <AccountProvider client={client}>{children}</AccountProvider>;
}
