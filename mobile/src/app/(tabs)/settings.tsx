import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@examify-tms/shared";
import { useLogout } from "@/features/auth/hooks";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={styles.name}>{user?.name || "Signed in"}</Text>
        {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

        <Pressable
          style={[styles.button, logout.isPending && styles.buttonDisabled]}
          onPress={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <Text style={styles.buttonText}>
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24, alignItems: "center", marginTop: 32 },
  name: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  button: {
    marginTop: 32,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#b91c1c", fontSize: 15, fontWeight: "600" },
});
