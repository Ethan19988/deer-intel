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
  gap: "0.4rem",
  minHeight: "44px",
  padding: "0.8rem 1rem",
  borderRadius: "8px",
  fontSize: "0.95rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    border: "1px solid #2f6f3e",
    background: "#2f6f3e",
    color: "white",
  },
  secondary: {
    border: "1px solid #444",
    background: "#1b1b1b",
    color: "white",
  },
  danger: {
    border: "1px solid #6f2f2f",
    background: "#3a1717",
    color: "#ffd5d5",
  },
  ghost: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#c6d5c5",
  },
};

const fullWidthStyle: CSSProperties = {
  width: "100%",
};

const disabledStyle: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};
