import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Bump whenever a cached response shape changes in a backward-incompatible way.
// A stale persisted cache with a different buster is discarded, not crashed on.
export const CACHE_BUSTER = "v1";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // Must stay >= persistOptions.maxAge below, or a query can be garbage
      // collected from memory before the persister ever writes it out.
      gcTime: ONE_DAY_MS,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "SIGNALFLOW_QUERY_CACHE",
  throttleTime: 1000,
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: ONE_DAY_MS,
  buster: CACHE_BUSTER,
};

// Call on logout so one account's cached watchlists/rules/signals never
// flashes on screen for the next account that logs in on this device.
export function clearQueryCache() {
  queryClient.clear();
}
