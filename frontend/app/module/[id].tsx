import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { TopBar } from "@/src/components/ui/TopBar";
import { MODULE_COMPONENTS } from "@/src/modules/component-map";
import { ModuleErrorBoundary } from "@/src/modules/shared/ModuleErrorBoundary";
import { ModulePlaceholder } from "@/src/modules/ModulePlaceholder";
import { getModuleById } from "@/src/modules/registry";
import { colors } from "@/src/theme";

// Generic host for ecosystem modules. Renders a registered component when the
// module is built, otherwise a roadmap placeholder. Adding a module needs NO
// changes here — only a registry entry (+ optional component-map registration).
export default function ModuleHost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const module = getModuleById(String(id));

  if (!module || module.realm !== "customer") {
    return (
      <View style={styles.container} testID="module-not-found">
        <TopBar title="Not found" showBack showBasket={false} />
        <EmptyState icon="help-circle-outline" title="Module unavailable" message="This section isn’t available." />
      </View>
    );
  }

  const Component = MODULE_COMPONENTS[module.id];

  return (
    <View style={styles.container} testID={`module-${module.id}`}>
      <TopBar title={module.title} showBack showBasket={false} />
      <ModuleErrorBoundary>
        {module.status !== "planned" && Component ? <Component /> : <ModulePlaceholder module={module} />}
      </ModuleErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
});
