import { Component, ReactNode } from "react";

import { ErrorState } from "@/src/components/ui/ErrorState";

// Generic error boundary so a crash inside one module never takes down the app.
// Wrap module screens with this in the module host.
interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  hasError: boolean;
  error: unknown;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Hook for the Phase-2 error-monitoring layer (no secrets logged).
    console.warn("[module-error-boundary]", error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          testID="module-error-boundary"
          title="Something went wrong"
          error={this.state.error}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
