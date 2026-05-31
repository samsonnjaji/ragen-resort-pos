"use client";

import { SessionProvider } from "next-auth/react";
import { PWARegister } from "@/components/pwa-register";
import { ConnectionProvider } from "@/contexts/connection-context";
import { OfflineBanner } from "@/components/offline-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <ConnectionProvider>
        <PWARegister />
        <OfflineBanner />
        {children}
      </ConnectionProvider>
    </SessionProvider>
  );
}
