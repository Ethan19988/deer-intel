import type { CSSProperties, ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
};

export default function PageShell({
  children,
  maxWidth = "1180px",
}: PageShellProps) {
  return (
    <main style={pageStyle}>
      <div style={{ ...contentStyle, maxWidth }}>{children}</div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 4vw, 2rem)",
  background: "#050806",
  color: "white",
};

const contentStyle: CSSProperties = {
  width: "100%",
  margin: "0 auto",
};
