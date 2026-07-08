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
    borderColor: "#3b6843",
    background: "#18351d",
    color: "white",
  },
  secondary: {
    borderColor: "#2b3a2b",
    background: "#101710",
    color: "#f1f5ef",
  },
  danger: {
    borderColor: "#6f2f2f",
    background: "#3a1717",
    color: "#ffd5d5",
  },
  ghost: {
    borderColor: "transparent",
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
