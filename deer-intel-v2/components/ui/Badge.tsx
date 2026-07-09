import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

export default function Badge({
  variant = "default",
  style,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.3rem 0.55rem",
  borderRadius: "8px",
  fontSize: "0.75rem",
  fontWeight: 700,
  lineHeight: 1,
};

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  default: {
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text-muted)",
  },
  success: {
    border: "1px solid var(--success-border)",
    background: "var(--success-bg)",
    color: "var(--success-text)",
  },
  warning: {
    border: "1px solid var(--warning-border)",
    background: "var(--warning-bg)",
    color: "var(--warning-text)",
  },
  danger: {
    border: "1px solid var(--danger-border)",
    background: "var(--danger-bg)",
    color: "var(--danger-text)",
  },
};
