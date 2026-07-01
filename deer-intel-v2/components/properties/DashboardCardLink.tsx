import type { ReactNode } from "react";
import ActionCard from "@/components/ui/ActionCard";

type DashboardCardLinkProps = {
  href: string;
  title: string;
  description: string;
  badge?: string;
  icon?: ReactNode;
  size?: "default" | "large";
  tone?: "default" | "primary";
};

export default function DashboardCardLink(props: DashboardCardLinkProps) {
  return <ActionCard {...props} />;
}
