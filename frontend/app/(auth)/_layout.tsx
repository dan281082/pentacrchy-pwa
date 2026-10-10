import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/src/context/auth";
import { colors } from "@/src/theme";

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === "loading") return null;
  if (status === "ready") return <Redirect href="/(tabs)" />;
  if (status === "pending") return <Redirect href="/pending" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
