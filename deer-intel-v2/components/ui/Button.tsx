import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export default function Button({
  variant = "primary",
  fullWidth = false,
  style,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={["di-button", props.className].filter(Boolean).join(" ")}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...(fullWidth ? fullWidthStyle : null),
        ...(disabled ? disabledStyle : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.45rem",
  minHeight: "46px",
  padding: "0.72rem 0.95rem",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.15rem",
  fontWeight: 400,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1,
  cursor: "pointer",
  textAlign: "center",
  boxShadow: "var(--shadow-sm)",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  // Blaze is the call to action in the tactical look.
  primary: {
    borderColor: "var(--accent-2)",
    background: "var(--accent-2)",
    color: "var(--accent-2-fg)",
  },
  secondary: {
    borderColor: "var(--border-strong)",
    background: "transparent",
    color: "var(--text)",
  },
  danger: {
    borderColor: "var(--danger-border)",
    background: "var(--danger-bg)",
    color: "var(--danger-text)",
  },
  ghost: {
    borderColor: "transparent",
    background: "transparent",
    color: "var(--text-muted)",
    boxShadow: "none",
  },
};

const fullWidthStyle: CSSProperties = {
  width: "100%",
};

const disabledStyle: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};
