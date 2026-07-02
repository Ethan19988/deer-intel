import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "subtle" | "elevated";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
  variant?: CardVariant;
  children: ReactNode;
};

export default function Card({
  as: Component = "article",
  variant = "default",
  className,
  style,
  children,
  ...props
}: CardProps) {
  return (
    <Component
      {...props}
      className={["di-card", className].filter(Boolean).join(" ")}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

const baseStyle: CSSProperties = {
  padding: "1.15rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const variantStyles: Record<CardVariant, CSSProperties> = {
  default: {},
  subtle: {
    border: "1px solid #1e2a1e",
    background: "#0a0f0a",
  },
  elevated: {
    boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
  },
};
