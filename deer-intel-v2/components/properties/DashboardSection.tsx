import type { CSSProperties, ReactNode } from "react";
import Section from "@/components/ui/Section";

type DashboardSectionProps = {
  id?: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
};

export default function DashboardSection(props: DashboardSectionProps) {
  return <Section {...props} />;
}
