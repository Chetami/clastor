import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@examify-tms/shared";
import { isBiometricEnabled } from "./use-biometric-auth";

/**
 * Pushes the biometric lock screen when the app returns to the foreground
 * (if the user has a session and biometric lock is enabled in Settings).
 *
 * Mount this inside the authenticated tab layout so it only runs when the
 * user is actually logged in.
 */
export function useAppLock() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasBeenActive = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;

      const shouldLock =
        hasBeenActive.current && token && (await isBiometricEnabled());

      if (shouldLock) {
        router.push("/biometric");
      }

      hasBeenActive.current = true;
    });

    return () => subscription.remove();
  }, [token, router]);
}
