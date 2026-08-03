import { ActivityIndicator, StyleSheet, View } from "react-native";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { colors, spacing } from "@/src/theme";

export type ModuleViewStatus =
  | "loading"
  | "empty"
  | "offline"
  | "unauthorised"
  | "error"
  | "ready";

// Shared state renderer so every ecosystem module handles loading / empty /
// offline / unauthorised / error consistently. `ready` renders children.
export function ModuleStateView({
  status,
  children,
  error,
  onRetry,
  onSignIn,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  emptyIcon = "cube-outline",
  testID = "module-state",
}: {
  status: ModuleViewStatus;
  children?: React.ReactNode;
  error?: unknown;
  onRetry?: () => void;
  onSignIn?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: React.ComponentProps<typeof EmptyState>["icon"];
  testID?: string;
}) {
  if (status === "ready") return <>{children}</>;

  if (status === "loading") {
    return (
      <View style={styles.center} testID={`${testID}-loading`}>
        <ActivityIndicator color={colors.brandSecondary} />
      </View>
    );
  }

  if (status === "unauthorised") {
    return (
      <EmptyState
        testID={`${testID}-unauthorised`}
        icon="lock-closed-outline"
        title="Sign in required"
        message="Secure sign-in arrives with the Apeps App Connector. This section will unlock then."
        actionLabel={onSignIn ? "Sign in" : undefined}
        onAction={onSignIn}
      />
    );
  }

  if (status === "offline") {
    return (
      <EmptyState
        testID={`${testID}-offline`}
        icon="cloud-offline-outline"
        title="You’re offline"
        message="Check your connection and try again."
        actionLabel={onRetry ? "Try again" : undefined}
        onAction={onRetry}
      />
    );
  }

  if (status === "error") {
    return <ErrorState testID={`${testID}-error`} error={error} onRetry={onRetry} />;
  }

  // empty
  return (
    <EmptyState testID={`${testID}-empty`} icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
