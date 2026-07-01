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
    border: "1px solid #2d402d",
    background: "#101a10",
    color: "#c6d5c5",
  },
  success: {
    border: "1px solid #3b6843",
    background: "#18351d",
    color: "#c6f0c6",
  },
  warning: {
    border: "1px solid #514c31",
    background: "#272411",
    color: "#eee1a8",
  },
  danger: {
    border: "1px solid #6f2f2f",
    background: "#3a1717",
    color: "#ffd5d5",
  },
};
