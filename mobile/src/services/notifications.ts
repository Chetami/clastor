import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";

/**
 * Notification handler — only registered when not in Expo Go, since
 * expo-notifications remote-push support was removed from Expo Go in SDK 53.
 * Wrapped in try-catch so it never crashes the app on platforms where the
 * native module isn't fully available.
 */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // expo-notifications not available (e.g. Expo Go) — silently skip.
}

/**
 * Requests notification permissions and registers for an Expo push token.
 */
async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4f46e5",
      });
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Hook that initialises push notifications and wires up tap-to-navigate.
 * Fails silently in Expo Go.
 */
export function usePushNotifications(enabled: boolean) {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!enabled) return;

    registerForPushNotifications().then((token) => {
      if (token) setPushToken(token);
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification.request.content.title);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data && typeof data.screen === "string") {
          try {
            router.push(data.screen);
          } catch {
            // route may not exist — ignore
          }
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [enabled]);

  return { pushToken };
}
