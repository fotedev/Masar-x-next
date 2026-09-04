/**
 * Network status via @react-native-community/netinfo (spec FR-011):
 * `isInternetReachable === false` means we render the offline state;
 * unknown (still probing) counts as online so the UI never flashes.
 */
import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export interface NetworkStatus {
  online: boolean;
  /** Null until the first probe completes. */
  known: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({ online: true, known: false });

  useEffect(() => {
    const update = (state: NetInfoState) => {
      setStatus({
        online: state.isInternetReachable !== false,
        known: state.isInternetReachable !== null,
      });
    };

    void NetInfo.fetch().then(update);
    const unsubscribe = NetInfo.addEventListener(update);
    return unsubscribe;
  }, []);

  return status;
}