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
  borderRadius: "8px",
  fontSize: "0.95rem",
  fontWeight: 850,
  lineHeight: 1,
  cursor: "pointer",
  textAlign: "center",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    borderColor: "var(--accent)",
    background: "var(--accent)",
    color: "white",
  },
  secondary: {
    borderColor: "var(--border)",
    background: "var(--surface-2)",
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
  },
};

const fullWidthStyle: CSSProperties = {
  width: "100%",
};

const disabledStyle: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};
