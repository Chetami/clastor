import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore, queryClient } from "@examify-tms/shared";
import type { LoginResponse } from "@examify-tms/interfaces";
import { loginRequest, logoutRequest, googleSignInRequest } from "./requests";

// Configure the native Google Sign-In SDK once. `webClientId` is the OAuth
// Web client ID (the one Firebase lists under "Web SDK configuration") and is
// what Firebase uses to verify the returned ID token. `iosClientId` selects
// the iOS OAuth client. Both must match the clients registered in Google Cloud.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
});

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      // Drop any data cached from a previous session before establishing the
      // new identity.
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useMutation({
    mutationFn: () => logoutRequest(refreshToken),
    onSettled: () => {
      queryClient.clear();
      clearAuth();
    },
  });
}

/**
 * Google sign-in via the native Google Sign-In SDK. The whole flow — opening
 * the native sheet, obtaining a Google ID token, and exchanging it — lives in
 * the mutation so any error surfaces through `error` for the UI to show.
 */
export function useGoogleSignIn() {
  const setAuth = useAuthStore((s) => s.setAuth);

  const { mutateAsync, isPending, isError, error } = useMutation<
    LoginResponse | null
  >({
    mutationFn: async () => {
      // Android: ensure Google Play Services are available (no-op on iOS).
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      // `type === 'cancelled'` means the user dismissed the sheet — abort
      // silently rather than show an error.
      if (!isSuccessResponse(response)) return null;

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token.");
      }
      return googleSignInRequest(idToken);
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });

  async function signIn() {
    await mutateAsync();
  }

  return { signIn, isPending, isError, error };
}
