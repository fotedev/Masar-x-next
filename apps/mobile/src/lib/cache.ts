import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { QueryClient } from "@tanstack/react-query";

// Offline resilience: the whole query cache is persisted to AsyncStorage and
// rehydrated on launch, so previously loaded subjects/summaries/news render
// instantly (even with no network) while fresh data is fetched in the
// background. Pairs with the retry/offline handling in the QueryClient.
export const persister = createAsyncStoragePersister({
  storage: {
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
    getItem: (key: string) => AsyncStorage.getItem(key) as Promise<string | null>,
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  },
  throttleTime: 2000,
});

export function persistQueryClient(client: QueryClient) {
  // Imported lazily by the root layout to keep this module side-effect free.
  return import("@tanstack/react-query-persist-client").then(() => client);
}
