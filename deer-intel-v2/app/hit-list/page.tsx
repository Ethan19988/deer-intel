"use client";

import { useMemo } from "react";
import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import Card from "@/components/ui/Card";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { DeerIcon } from "@/components/ui/FieldIcons";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { usePartyBucks, usePartyBuckPhotos, usePartyRoster } from "@/lib/useParty";
import { getDeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import type { PartyBuck } from "@/types/party";

type Stat = { label: string; value: string };

export default function HitListPage() {
  const state = useDeerIntelStore();
  const { user } = useAuth();
  const {
    available,
    activeParty,
    buckSharingEnabled,
    setBuckSharingEnabled,
  } = useActiveParty();

  const propertyNameById = useMemo(
    () => new Map(state.properties.map((p) => [p.id, p.name])),
    [state.properties],
  );

  // Each tracked buck with its computed movement pattern. A single buck whose
  // data trips up the intelligence read is skipped rather than blanking the
  // whole page.
  const myBucks = useMemo(
    () =>
      state.deerProfiles
        .map((profile) => {
          try {
            const propertyName = propertyNameById.get(profile.propertyId) ?? "";
            const intel = getDeerProfileIntelligence({
              profile,
              propertyName,
              cameras: state.cameras,
              photoRecords: state.photoRecords,
              cameraChecks: state.cameraChecks,
              hunts: state.hunts,
              pins: state.pins,
            });
            return { profile, propertyName, intel };
          } catch {
            return null;
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [state, propertyNameById],
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Hit list"
        title="Buck inventory"
        description="Every buck you're tracking, with the movement pattern the app has learned from your trail-cam photos. Share the list with your party so everyone hunts the same targets."
        icon={<DeerIcon size={26} />}
      />

      {available ? (
        <CollapsibleSection
          title="Share your hit list"
          description="Show your bucks and their patterns to your party"
        >
          <label style={toggleRowStyle}>
            <input
              type="checkbox"
              checked={buckSharingEnabled}
              onChange={(e) => setBuckSharingEnabled(e.target.checked)}
              style={{ marginTop: "0.2rem", width: "1.1rem", height: "1.1rem" }}
              disabled={!activeParty}
            />
            <span>
              <strong>Share my buck hit list with the party</strong>
              <span style={mutedBlockStyle}>
                {activeParty
                  ? `Your bucks and their movement patterns show up on every ${activeParty.name} member's hit list. Photos stay private to your device — this shares the card and stats only.`
                  : "Pick an active party on the Party page first, then turn this on."}
              </span>
            </span>
          </label>
        </CollapsibleSection>
      ) : (
        <CollapsibleSection
          title="Share your hit list"
          description="Sign in and join a party to share with the crew"
        >
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            <Link href="/login" style={linkStyle}>
              Sign in
            </Link>{" "}
            and join a party to share your hit list with the crew.
          </p>
        </CollapsibleSection>
      )}

      <ErrorBoundary fallbackTitle="Your buck list couldn't load">
        <Section eyebrow="Your bucks" title={`Tracking ${myBucks.length} buck${myBucks.length === 1 ? "" : "s"}`}>
          {myBucks.length === 0 ? (
            <Card>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                No bucks yet. Add deer profiles on a property and link trail-cam
                photos — the movement pattern builds itself from there.
              </p>
            </Card>
          ) : (
            <div style={gridStyle}>
              {myBucks.map(({ profile, propertyName, intel }) => (
                <BuckCard
                  key={profile.id}
                  title={(profile.nickname ?? "").trim() || "Unnamed buck"}
                  subtitle={propertyName}
                  badges={[(profile.estimatedAge ?? "").trim(), intel.maturityStatus.title].filter(Boolean)}
                  stats={[
                    { label: "Sightings", value: String(intel.sightingCount) },
                    { label: "Last seen", value: intel.mostRecentSighting.title },
                    { label: "Best time", value: intel.commonTimeOfDay.title },
                    { label: "Common area", value: intel.commonArea.title },
                    {
                      label: "Cameras",
                      value: intel.associatedCameraSites.join(", ") || "—",
                    },
                  ]}
                  notable={(profile.notes ?? "").trim()}
                />
              ))}
            </div>
          )}
        </Section>
      </ErrorBoundary>

      {activeParty ? (
        <ErrorBoundary fallbackTitle="The party hit list couldn't load">
          <PartyHitList partyId={activeParty.id} partyName={activeParty.name} selfId={user?.id ?? null} />
        </ErrorBoundary>
      ) : null}
    </PageShell>
  );
}

function PartyHitList({
  partyName,
  selfId,
}: {
  partyId: string;
  partyName: string;
  selfId: string | null;
}) {
  const { activeParty } = useActiveParty();
  const bucks = usePartyBucks(activeParty);
  const photos = usePartyBuckPhotos(activeParty);
  const { nameById } = usePartyRoster(activeParty);

  // Shared thumbnails keyed by the buck they belong to (member + profile).
  const photosByBuck = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const photo of photos) {
      const key = `${photo.created_by}::${photo.source_id}`;
      const list = map.get(key) ?? [];
      list.push(photo.data_url);
      map.set(key, list);
    }
    return map;
  }, [photos]);

  // Others' bucks, plus mine, all in one combined crew list.
  const sorted = useMemo(
    () => [...bucks].sort((a, b) => b.sighting_count - a.sighting_count),
    [bucks],
  );

  return (
    <Section eyebrow="Party hit list" title={`${partyName} — everyone's targets`}>
      {sorted.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            No shared bucks yet. Turn on sharing above, and ask the crew to do the
            same.
          </p>
        </Card>
      ) : (
        <div style={gridStyle}>
          {sorted.map((buck) => (
            <PartyBuckCard
              key={`${buck.created_by}-${buck.source_id}`}
              buck={buck}
              sharer={nameById.get(buck.created_by) ?? "A hunter"}
              isMine={buck.created_by === selfId}
              photos={photosByBuck.get(`${buck.created_by}::${buck.source_id}`) ?? []}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function PartyBuckCard({
  buck,
  sharer,
  isMine,
  photos,
}: {
  buck: PartyBuck;
  sharer: string;
  isMine: boolean;
  photos: string[];
}) {
  return (
    <BuckCard
      title={buck.nickname || "Unnamed buck"}
      subtitle={`${sharer}${isMine ? " (you)" : ""}${buck.property_name ? ` · ${buck.property_name}` : ""}`}
      badges={[buck.estimated_age, buck.status].filter(Boolean)}
      stats={[
        { label: "Sightings", value: String(buck.sighting_count) },
        { label: "Last seen", value: buck.most_recent || "—" },
        { label: "Best time", value: buck.common_time || "—" },
        { label: "Common area", value: buck.common_area || "—" },
        { label: "Cameras", value: buck.cameras || "—" },
      ]}
      notable={buck.notable}
      photos={photos}
    />
  );
}

function BuckCard({
  title,
  subtitle,
  badges,
  stats,
  notable,
  photos = [],
}: {
  title: string;
  subtitle: string;
  badges: string[];
  stats: Stat[];
  notable: string;
  photos?: string[];
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "1.1rem" }}>{title}</strong>
        {subtitle ? (
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{subtitle}</span>
        ) : null}
      </div>
      {badges.length > 0 ? (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {badges.map((b) => (
            <span key={b} style={badgeStyle}>
              {b}
            </span>
          ))}
        </div>
      ) : null}
      {photos.length > 0 ? (
        <div style={photoStripStyle}>
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${title} trail-cam photo`}
              style={thumbStyle}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
      <dl style={statGridStyle}>
        {stats.map((s) => (
          <div key={s.label}>
            <dt style={statLabelStyle}>{s.label}</dt>
            <dd style={statValueStyle}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {notable ? (
        <p style={{ margin: "0.6rem 0 0", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          {notable}
        </p>
      ) : null}
    </Card>
  );
}

const gridStyle = {
  display: "grid",
  gap: "0.85rem",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
} as const;
const toggleRowStyle = {
  display: "flex",
  gap: "0.7rem",
  alignItems: "flex-start",
  cursor: "pointer",
} as const;
const mutedBlockStyle = {
  display: "block",
  marginTop: "0.35rem",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.5,
} as const;
const badgeStyle = {
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--accent-2-text)",
  background: "var(--accent-2-tint)",
  border: "1px solid var(--accent-2-tint-border)",
  padding: "0.15rem 0.5rem",
  borderRadius: "999px",
} as const;
const statGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.5rem 0.75rem",
  margin: "0.75rem 0 0",
} as const;
const statLabelStyle = {
  margin: 0,
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted)",
} as const;
const statValueStyle = {
  margin: "0.1rem 0 0",
  fontSize: "0.92rem",
  fontWeight: 600,
} as const;
const linkStyle = { color: "var(--accent-text)", fontWeight: 700 } as const;
const photoStripStyle = {
  display: "flex",
  gap: "0.4rem",
  flexWrap: "wrap",
  margin: "0.75rem 0 0",
} as const;
const thumbStyle = {
  width: "72px",
  height: "72px",
  objectFit: "cover",
  borderRadius: "8px",
  border: "1px solid var(--border)",
} as const;
