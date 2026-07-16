import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text, Button } from "@/components/ui";
import { useBiometricAuth } from "@/hooks/use-biometric-auth";

export default function BiometricScreen() {
  const { authenticate, biometricLabel, isAvailable } = useBiometricAuth();

  async function tryAuth() {
    const success = await authenticate();
    if (success) {
      router.back();
    }
  }

  // Auto-trigger the prompt as soon as the lock screen appears.
  useEffect(() => {
    void tryAuth();
  }, []);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
      <View className="items-center px-8">
        <Text variant="h2" className="mb-2">
          {biometricLabel} required
        </Text>
        <Text variant="muted" className="mb-8 text-center">
          Authenticate with {biometricLabel} to unlock Examify.
        </Text>

        <Button onPress={tryAuth}>Try again</Button>

        {!isAvailable && (
          <Text className="mt-6 text-center text-sm text-amber-600">
            {biometricLabel} isn't set up on this device. Configure it in your
            system settings.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
