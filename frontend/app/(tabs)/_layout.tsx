import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";

import { useAuth } from "@/src/context/auth";
import { colors, fontSize, fontWeight } from "@/src/theme";

const icon =
  (outline: keyof typeof Ionicons.glyphMap, filled: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) =>
    <Ionicons name={focused ? filled : outline} size={size} color={color} />;

export default function TabsLayout() {
  const { status, user } = useAuth();

  // Only approved members reach the tabs; everyone else is routed out.
  if (status === "loading") return null;
  if (status === "signedOut") return <Redirect href="/(auth)/login" />;
  if (status === "pending") return <Redirect href="/pending" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandSecondary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: icon("home-outline", "home"), tabBarButtonTestID: "tab-home" }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: "Vials", tabBarIcon: icon("flask-outline", "flask"), tabBarButtonTestID: "tab-shop" }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: "Search", tabBarIcon: icon("search-outline", "search"), tabBarButtonTestID: "tab-search" }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: icon("receipt-outline", "receipt"), tabBarButtonTestID: "tab-orders" }}
      />
      <Tabs.Screen
        name="fulfilment"
        options={{
          title: "Fulfilment",
          href: user?.fulfilment ? undefined : null,
          tabBarIcon: icon("cube-outline", "cube"),
          tabBarButtonTestID: "tab-fulfilment",
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: icon("person-outline", "person"), tabBarButtonTestID: "tab-account" }}
      />
    </Tabs>
  );
}
