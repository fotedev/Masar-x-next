import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "./supabase";

// Live updates: the same Supabase Realtime mechanism the web app uses
// (postgres_changes channels — see apps/web PlatformSettingsContext /
// useNotifications). When a table row changes on the backend, the matching
// TanStack Query cache entry is invalidated and refetched — no manual
// refresh needed on the phone.
export type RealtimeStatus = "connecting" | "live" | "offline";

const INVALIDATIONS: Array<{ table: string; queryKey: string }> = [
  { table: "subjects", queryKey: "subjects" },
  { table: "summaries", queryKey: "summaries" },
  { table: "news", queryKey: "news" },
  { table: "platform_settings", queryKey: "platform-settings" },
];

export function useLiveInvalidation(queryClient: QueryClient): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    let channel = supabase.channel("masarx-live-updates");
    for (const { table, queryKey } of INVALIDATIONS) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        },
      );
    }
    channel
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("live");
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("offline");
        else setStatus("connecting");
      });
    return () => {
      supabase.removeChannel(channel);
      setStatus("connecting");
    };
  }, [queryClient]);

  return status;
}
