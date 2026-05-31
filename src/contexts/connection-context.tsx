"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ConnectionContextValue {
  isOnline: boolean;
  isServerReachable: boolean;
  isConnected: boolean;
  checkConnection: () => Promise<boolean>;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  isOnline: true,
  isServerReachable: true,
  isConnected: true,
  checkConnection: async () => true,
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setIsServerReachable(false);
      return false;
    }
    setIsOnline(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("/api/health", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const ok = res.ok;
      setIsServerReachable(ok);
      return ok;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    checkConnection();

    const onOnline = () => {
      setIsOnline(true);
      checkConnection();
    };
    const onOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(checkConnection, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  return (
    <ConnectionContext.Provider
      value={{
        isOnline,
        isServerReachable,
        isConnected: isOnline && isServerReachable,
        checkConnection,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
