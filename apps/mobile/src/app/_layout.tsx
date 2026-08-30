import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";

import { AuthProvider } from "@/lib/auth";
import "../global.css";

// Arabic-first app: enable RTL layout (applies fully after first restart).
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// TanStack Query: tie its online state to real device connectivity so
// queries pause/refetch correctly when the network changes.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // matches the web app's standardized 5 minutes
      retry: (failureCount, error) => {
        // Do not retry deterministic client-side errors (PostgREST 4xx).
        const status = (error as { code?: number; status?: number })?.code ?? (error as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f8fafc" } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
