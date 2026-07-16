import { useEffect } from "react";
import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Settings,
} from "lucide-react-native";
import { useAuthStore } from "@examify-tms/shared";
import { useAppLock } from "@/hooks/use-app-lock";
import { usePushNotifications } from "@/services/notifications";

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);

  // Biometric lock: pushes the lock screen on background→foreground.
  useAppLock();

  // Push notifications: registers the device once authenticated.
  usePushNotifications(Boolean(token));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4f46e5",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f3f4f6",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: "Students",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ color, size }) => (
            <CreditCard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
