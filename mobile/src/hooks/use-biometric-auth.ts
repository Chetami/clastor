import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "biometricLockEnabled";

/**
 * Whether the user has enabled the biometric lock in Settings.
 * Stored in AsyncStorage (not SecureStore — it's a preference, not a secret).
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}

/**
 * Wraps expo-local-authentication. Reports hardware availability, the
 * enrolled security level, and exposes an `authenticate()` that triggers the
 * native Face ID / Touch ID / fingerprint prompt.
 */
export function useBiometricAuth() {
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [supportedType, setSupportedType] = useState<
    LocalAuthentication.AuthenticationType[]
  >([]);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      setHasHardware(compatible);
      setIsEnrolled(enrolled);
      setSupportedType(types);
    })();
  }, []);

  const authenticate = useCallback(
    async (
      reason = "Authenticate to unlock Examify",
    ): Promise<boolean> => {
      if (!hasHardware || !isEnrolled) return true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
      });
      return result.success;
    },
    [hasHardware, isEnrolled],
  );

  const biometricLabel = (() => {
    if (supportedType.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
    }
    if (supportedType.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    }
    return "Biometrics";
  })();

  return {
    hasHardware,
    isEnrolled,
    isAvailable: hasHardware && isEnrolled,
    biometricLabel,
    authenticate,
  };
}
