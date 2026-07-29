import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, useAuthStore, useVerifyToken } from "@examify-tms/shared";

import { initShared } from "@/lib/shared-bootstrap";

// Initialise the shared data layer once, before anything renders.
initShared();

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const segments = useSegments();

  // Validates a persisted token on cold start (no-op when there is none).
  const verify = useVerifyToken();

  const inLogin = segments[0] === "login";
  const isAuthed = !!token && !!user;
  // While a warm session is being verified we neither redirect nor render a
  // route, so the user never sees the login screen flash before being let in.
  const isResolvingSession = !!token && !user && verify.isLoading;

  useEffect(() => {
    if (verify.isError) {
      queryClient.clear();
      clearAuth();
    }
  }, [verify.isError, clearAuth]);

  useEffect(() => {
    if (isResolvingSession) return;
    if (!isAuthed && !inLogin) router.replace("/login");
    else if (isAuthed && inLogin) router.replace("/(tabs)");
  }, [isAuthed, inLogin, isResolvingSession, router]);

  if (isResolvingSession) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="students/[id]" />
      <Stack.Screen name="payments/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootNavigator />
    </QueryClientProvider>
  );
}
