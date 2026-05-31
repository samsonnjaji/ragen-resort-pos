"use client";

import { useConnection } from "@/contexts/connection-context";
import { useToast } from "@/hooks/use-toast";

/** Block critical server actions when cloud/server is unreachable. */
export function useRequireConnection() {
  const { isConnected } = useConnection();
  const { toast } = useToast();

  const blockIfOffline = (actionLabel = "This action") => {
    if (isConnected) return false;
    toast({
      title: "Connection lost",
      description: `${actionLabel} requires an internet connection to the server. Please check your network and retry.`,
      variant: "destructive",
    });
    return true;
  };

  return { isConnected, blockIfOffline, disabled: !isConnected };
}
