import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text, Button, Input, Box } from "@/components/ui";
import { useLogin, useRegister, useGoogleSignIn } from "@/features/auth/hooks";

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useLogin();
  const register = useRegister();
  const googleSignIn = useGoogleSignIn();

  const pending = login.isPending || register.isPending || googleSignIn.isPending;
  const error = (login.error ?? register.error ?? googleSignIn.error)?.message;

  async function handleSubmit() {
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, password });
      } else {
        await register.mutateAsync({ name, email, password });
      }
      router.replace("/");
    } catch {
      /* error shown via mutation state */
    }
  }

  async function handleGoogle() {
    try {
      await googleSignIn.mutateAsync();
      router.replace("/");
    } catch {
      /* error shown via mutation state */
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-1 items-center justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <Box className="w-full max-w-sm">
            <Text variant="h1" className="mb-1">
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>
            <Text variant="muted" className="mb-8">
              {mode === "login"
                ? "Sign in to manage your tutoring business."
                : "Start managing your tutoring business."}
            </Text>

            {mode === "register" && (
              <Box className="mb-4">
                <Text variant="label" className="mb-1.5">Name</Text>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Jane Doe"
                  autoCapitalize="words"
                />
              </Box>
            )}

            <Box className="mb-4">
              <Text variant="label" className="mb-1.5">Email</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </Box>

            <Box className="mb-6">
              <Text variant="label" className="mb-1.5">Password</Text>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                textContentType="password"
              />
            </Box>

            {error && (
              <Text className="mb-4 text-sm text-red-500">{error}</Text>
            )}

            <Button loading={pending} onPress={handleSubmit} className="mb-4">
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>

            {GOOGLE_IOS_CLIENT_ID ? (
              <>
                <View className="flex-row items-center mb-4">
                  <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <Text variant="muted" className="px-3">or</Text>
                  <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </View>
                <Button
                  variant="secondary"
                  loading={googleSignIn.isPending}
                  onPress={handleGoogle}
                  className="mb-4"
                >
                  Continue with Google
                </Button>
              </>
            ) : (
              <Text variant="muted" className="mb-4 text-center text-xs">
                Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env for Google Sign-In
              </Text>
            )}

            <Button
              variant="ghost"
              disabled={pending}
              onPress={() => setMode((m) => (m === "login" ? "register" : "login"))}
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
