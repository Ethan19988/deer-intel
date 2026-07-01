import Link from "next/link";
import type { CSSProperties } from "react";
import Card from "./Card";
import PageHeader from "./PageHeader";
import PageShell from "./PageShell";

type ComingSoonPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function ComingSoonPage({
  eyebrow,
  title,
  description,
}: ComingSoonPageProps) {
  return (
    <PageShell maxWidth="860px">
      <Link href="/" style={backLinkStyle}>
        Back to Home
      </Link>

      <Card as="section" variant="elevated" style={cardStyle}>
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
      </Card>
    </PageShell>
  );
}

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "#c6d5c5",
  fontWeight: 700,
  textDecoration: "none",
};

const cardStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "1.5rem",
};
