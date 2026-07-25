import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import PartyPanel from "@/components/party/PartyPanel";

export const metadata: Metadata = {
  title: "Party · Deer Intel",
};

export default function PartyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Hunting party"
        title="Party"
        description="Share pins and see your crew's live location on the map while they're on the ground. Everyone in the party joins with one invite code."
      />
      <PartyPanel />
    </PageShell>
  );
}
