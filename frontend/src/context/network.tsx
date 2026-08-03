// Network connectivity context + persistent offline banner.
// Wraps NetInfo so any screen can react to connectivity, and renders a
// slim offline indicator pinned under the status bar per the brief.

import NetInfo from "@react-native-community/netinfo";
import { createContext, useContext, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

const NetworkContext = createContext<{ isOnline: boolean }>({ isOnline: true });

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
      {!isOnline && (
        <View
          testID="offline-banner"
          style={[styles.banner, { top: insets.top }]}
          accessibilityRole="alert"
          accessibilityLabel="You are offline"
        >
          <Ionicons name="cloud-offline-outline" size={16} color={colors.onSurface} />
          <Text style={styles.text}>No internet connection</Text>
        </View>
      )}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.error,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.onSurface,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
