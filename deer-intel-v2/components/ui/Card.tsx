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
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
};

const variantStyles: Record<CardVariant, CSSProperties> = {
  default: {},
  subtle: {
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    boxShadow: "none",
  },
  elevated: {
    boxShadow: "var(--shadow-md)",
  },
};
