"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { usePartyLocations, usePartyPins, usePartyRoster } from "@/lib/useParty";
import type { Party } from "@/types/party";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

// The whole hunting-party control surface: create or join a party, share the
// invite code, pick the active party, toggle live location sharing, and see who
// is currently inside the shared hunt area.
export default function PartyPanel() {
  const { user } = useAuth();
  const {
    available,
    parties,
    activeParty,
    activePartyId,
    setActivePartyId,
    sharingEnabled,
    setSharingEnabled,
    pinSharingEnabled,
    setPinSharingEnabled,
    loading,
    error,
    createParty,
    joinParty,
    leaveParty,
  } = useActiveParty();

  const defaultName = user?.email ? user.email.split("@")[0] : "Hunter";
  const [partyName, setPartyName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState(defaultName);
  const [inviteCode, setInviteCode] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!available) {
    return (
      <Section eyebrow="Hunting party" title="Share the hunt with your crew">
        <Card>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Parties are tied to your account so pins and live locations can sync
            between phones.{" "}
            <Link href="/login" style={{ color: "var(--accent-text)", fontWeight: 700 }}>
              Sign in
            </Link>{" "}
            to create or join a party.
          </p>
        </Card>
      </Section>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await createParty(partyName, createDisplayName);
      setPartyName("");
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await joinParty(inviteCode, joinDisplayName);
      setInviteCode("");
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the code is visible on screen to type manually.
    }
  }

  return (
    <>
      <Section eyebrow="Hunting party" title="Your parties">
        {loading ? (
          <Card>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading…</p>
          </Card>
        ) : parties.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              You&rsquo;re not in a party yet. Create one and share the invite
              code, or join with a code someone sent you.
            </p>
          </Card>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {parties.map((party) => (
              <PartyRow
                key={party.id}
                party={party}
                active={party.id === activePartyId}
                onSelect={() => setActivePartyId(party.id)}
                onCopy={() => handleCopy(party.invite_code)}
                onLeave={() => leaveParty(party.id)}
              />
            ))}
            {copied ? (
              <p style={{ margin: 0, color: "var(--accent-text)", fontWeight: 700 }}>
                Invite code copied.
              </p>
            ) : null}
          </div>
        )}
        {error ? (
          <p style={{ marginTop: "0.75rem", color: "var(--danger-text)" }}>{error}</p>
        ) : null}
      </Section>

      {activeParty ? (
        <Section eyebrow="Live location" title={`Who's out — ${activeParty.name}`}>
          <SharingControls
            sharingEnabled={sharingEnabled}
            setSharingEnabled={setSharingEnabled}
          />
          <LiveMembers party={activeParty} selfId={user?.id ?? null} />
        </Section>
      ) : null}

      {activeParty ? (
        <Section eyebrow="Shared pins" title="Pins everyone can see">
          <PinSharingControls
            pinSharingEnabled={pinSharingEnabled}
            setPinSharingEnabled={setPinSharingEnabled}
          />
          <SharedPinsSummary party={activeParty} selfId={user?.id ?? null} />
        </Section>
      ) : null}

      <Section eyebrow="Get started" title="Create or join">
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <Card>
            <form onSubmit={handleCreate}>
              <h3 style={cardHeadingStyle}>Create a party</h3>
              <label style={labelStyle}>
                Party name
                <input
                  style={inputStyle}
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Moore Hill Crew"
                />
              </label>
              <label style={labelStyle}>
                Your name in the party
                <input
                  style={inputStyle}
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  placeholder="Dad"
                />
              </label>
              <Button type="submit" disabled={busy} fullWidth>
                Create party
              </Button>
            </form>
          </Card>

          <Card>
            <form onSubmit={handleJoin}>
              <h3 style={cardHeadingStyle}>Join with a code</h3>
              <label style={labelStyle}>
                Invite code
                <input
                  style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.15em" }}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="K7P2QX"
                  maxLength={6}
                />
              </label>
              <label style={labelStyle}>
                Your name in the party
                <input
                  style={inputStyle}
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  placeholder="Sam"
                />
              </label>
              <Button type="submit" variant="secondary" disabled={busy} fullWidth>
                Join party
              </Button>
            </form>
          </Card>
        </div>
        {formError ? (
          <p style={{ marginTop: "0.75rem", color: "var(--danger-text)" }}>{formError}</p>
        ) : null}
      </Section>
    </>
  );
}

function PartyRow({
  party,
  active,
  onSelect,
  onCopy,
  onLeave,
}: {
  party: Party;
  active: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onLeave: () => void;
}) {
  const { members } = usePartyRoster(party);
  return (
    <Card variant={active ? "elevated" : "default"} style={active ? activeCardStyle : undefined}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <strong style={{ fontSize: "1.05rem" }}>{party.name}</strong>
            {active ? (
              <span style={activeBadgeStyle}>On the map</span>
            ) : null}
          </div>
          <p style={{ margin: "0.3rem 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {members.length} member{members.length === 1 ? "" : "s"} · Invite code{" "}
            <code style={codeStyle}>{party.invite_code}</code>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!active ? (
            <Button type="button" variant="secondary" onClick={onSelect}>
              Show on map
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onCopy}>
            Copy code
          </Button>
          <Button type="button" variant="ghost" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SharingControls({
  sharingEnabled,
  setSharingEnabled,
}: {
  sharingEnabled: boolean;
  setSharingEnabled: (on: boolean) => void;
}) {
  return (
    <Card style={{ marginBottom: "0.75rem" }}>
      <label style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={sharingEnabled}
          onChange={(e) => setSharingEnabled(e.target.checked)}
          style={{ marginTop: "0.2rem", width: "1.1rem", height: "1.1rem" }}
        />
        <span>
          <strong>Share my live location with this party</strong>
          <span style={{ display: "block", marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Your dot appears to the party <em>only</em> while you&rsquo;re inside a
            saved hunt area, and drops off the moment you leave — nobody sees you
            at home. Works while Deer Intel is open on your phone; it can&rsquo;t
            track in the background when the app is fully closed, so don&rsquo;t
            treat a missing dot as a safety guarantee.
          </span>
        </span>
      </label>
    </Card>
  );
}

function PinSharingControls({
  pinSharingEnabled,
  setPinSharingEnabled,
}: {
  pinSharingEnabled: boolean;
  setPinSharingEnabled: (on: boolean) => void;
}) {
  return (
    <Card style={{ marginBottom: "0.75rem" }}>
      <label style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={pinSharingEnabled}
          onChange={(e) => setPinSharingEnabled(e.target.checked)}
          style={{ marginTop: "0.2rem", width: "1.1rem", height: "1.1rem" }}
        />
        <span>
          <strong>Share my map pins with this party</strong>
          <span style={{ display: "block", marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Your pins — cameras, stands, scrapes, sightings — show up on every
            party member&rsquo;s map, and update as you add or move them. Turn
            this off to pull them all back down. You always see everyone
            else&rsquo;s shared pins regardless of this switch.
          </span>
        </span>
      </label>
    </Card>
  );
}

function SharedPinsSummary({ party, selfId }: { party: Party; selfId: string | null }) {
  const pins = usePartyPins(party);
  const { nameById } = usePartyRoster(party);

  if (pins.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No shared pins yet. Turn on sharing above, or drop pins on the map.
        </p>
      </Card>
    );
  }

  // Tally pins per member so the crew can see who has shared what.
  const counts = new Map<string, number>();
  for (const pin of pins) {
    counts.set(pin.created_by, (counts.get(pin.created_by) ?? 0) + 1);
  }

  return (
    <Card>
      <p style={{ margin: "0 0 0.6rem", fontWeight: 700 }}>
        {pins.length} shared pin{pins.length === 1 ? "" : "s"} on the map
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.4rem" }}>
        {[...counts.entries()].map(([id, count]) => (
          <li key={id} style={{ color: "var(--text-muted)" }}>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>
              {nameById.get(id) ?? "Hunter"}
              {id === selfId ? " (you)" : ""}
            </span>{" "}
            · {count} pin{count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LiveMembers({ party, selfId }: { party: Party; selfId: string | null }) {
  const locations = usePartyLocations(party, null);
  const { nameById } = usePartyRoster(party);

  if (locations.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No one is in a shared hunt area right now.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
        {locations.map((loc) => (
          <li key={loc.user_id} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={liveDotStyle} aria-hidden="true" />
            <span style={{ fontWeight: 700 }}>
              {nameById.get(loc.user_id) ?? "Hunter"}
              {loc.user_id === selfId ? " (you)" : ""}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              in {loc.area_name ?? "the hunt area"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const cardHeadingStyle = { margin: "0 0 0.75rem", fontSize: "1.1rem" } as const;
const labelStyle = {
  display: "block",
  marginBottom: "0.75rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--text-muted)",
} as const;
const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  padding: "0.6rem 0.7rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "1rem",
} as const;
const activeCardStyle = { borderColor: "var(--accent)" } as const;
const activeBadgeStyle = {
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--accent-text)",
  background: "var(--accent-tint, rgba(47,125,67,0.12))",
  padding: "0.15rem 0.5rem",
  borderRadius: "999px",
} as const;
const codeStyle = {
  fontFamily: "var(--font-geist-mono, monospace)",
  fontWeight: 800,
  letterSpacing: "0.1em",
  color: "var(--text)",
} as const;
const liveDotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#2f9e44",
  boxShadow: "0 0 0 3px rgba(47,158,68,0.25)",
  flex: "none",
} as const;
