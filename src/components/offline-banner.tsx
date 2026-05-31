"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useConnection } from "@/contexts/connection-context";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const { isConnected, isOnline, isServerReachable, checkConnection } = useConnection();

  if (isConnected) return null;

  const title = !isOnline ? "Connection lost — no internet" : "Server unavailable";
  const message = !isOnline
    ? "Check your tablet Wi-Fi or mobile data. Sales and sync are paused until you're back online."
    : "Cannot reach the RAGEN RESORT POS cloud server. Check your connection or try again shortly.";

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] border-b border-red-500/40 bg-red-950/95 px-4 py-3 backdrop-blur-sm safe-top">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <WifiOff className="h-6 w-6 shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-semibold text-red-200">{title}</p>
            <p className="text-sm text-red-200/80">{message}</p>
            <p className="text-xs text-red-300/60 mt-1">
              New sales, payments, and inventory updates are blocked until connection returns.
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0 h-11 border-red-400/40 text-red-100 hover:bg-red-900 touch-target" onClick={() => checkConnection()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  );
}

export function ConnectionStatusBadge() {
  const { isConnected } = useConnection();
  if (isConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs text-red-300">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      Offline
    </span>
  );
}
