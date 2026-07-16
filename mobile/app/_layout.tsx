import "../global.css";
import "../src/lib/polyfills";

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  queryClient,
  useAuthStore,
  useVerifyToken,
} from "@examify-tms/shared";

import { bootstrapShared } from "@/lib/shared-bootstrap";
import { isFirebaseConfigured } from "@/config/firebase";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";

function useAuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const firebaseReady = isFirebaseConfigured();

  // useVerifyToken has enabled: !!token, so it's a no-op until bootstrap
  // hydrates the token from storage.
  const { isLoading } = useVerifyToken();

  const inAuthGroup = segments[0] === "login";

  useEffect(() => {
    if (isLoading) return;

    if (!firebaseReady && segments[0] !== "setup") {
      router.replace("/setup");
      return;
    }

    if (firebaseReady && !token && !inAuthGroup && segments[0] !== "setup") {
      router.replace("/login");
      return;
    }

    if (firebaseReady && token && (inAuthGroup || segments[0] === "setup")) {
      router.replace("/");
    }
  }, [isLoading, token, segments, router, firebaseReady, inAuthGroup]);
}

function ThemedStatusBar() {
  const { resolved } = useTheme();
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapShared().then(() => setReady(true));
  }, []);

  // Hooks must run unconditionally — call before any early return.
  useAuthGate();

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: "#f9fafb" }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f9fafb" },
      }}
    >
      <Stack.Screen name="setup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="biometric" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedStatusBar />
            <App />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
