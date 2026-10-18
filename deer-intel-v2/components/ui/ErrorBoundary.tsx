"use client";

import { Component, type CSSProperties, type ReactNode } from "react";
import Card from "@/components/ui/Card";

type ErrorBoundaryProps = {
  children: ReactNode;
  // Shown in place of the crashed subtree. Defaults to a generic message.
  fallbackTitle?: string;
  fallbackDescription?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

/**
 * Catches render/runtime errors in its children and shows a readable message
 * instead of blanking the whole page. Scope it around a section so one bad
 * record degrades that section, not the entire screen.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card as="div" variant="subtle">
        <p style={titleStyle}>
          {this.props.fallbackTitle ?? "This section couldn't load"}
        </p>
        <p style={descriptionStyle}>
          {this.props.fallbackDescription ??
            "Something went wrong rendering this content. The rest of the page still works — try reloading."}
        </p>
        {this.state.message ? (
          <p style={detailStyle}>Details: {this.state.message}</p>
        ) : null}
      </Card>
    );
  }
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 800,
};

const descriptionStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const detailStyle: CSSProperties = {
  margin: "0.6rem 0 0",
  color: "var(--text-faint)",
  fontSize: "0.82rem",
  lineHeight: 1.5,
  wordBreak: "break-word",
};
