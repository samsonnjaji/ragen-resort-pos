"use client";

import { SessionProvider } from "next-auth/react";
import { PWARegister } from "@/components/pwa-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PWARegister />
      {children}
    </SessionProvider>
  );
}
