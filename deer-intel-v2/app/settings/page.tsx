"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import AccountPanel from "@/components/auth/AccountPanel";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  setThemePreference,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_PREFERENCES,
  useThemePreference,
} from "@/lib/theme";
import type { DeerIntelState } from "@/types/deerIntelStore";

function recordCount(candidate: DeerIntelState) {
  return (
    candidate.properties.length +
    candidate.cameras.length +
    candidate.cameraChecks.length +
    candidate.stands.length +
    candidate.pins.length +
    candidate.hunts.length +
    candidate.photoRecords.length +
    candidate.deerProfiles.length
  );
}

export default function SettingsPage() {
  const state = useDeerIntelStore();
  const themePreference = useThemePreference();
  const { configured, status, user } = useAuth();
  const cloudActive = configured && status === "signed-in";
  const totalRecords = recordCount(state);
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    state: DeerIntelState;
    fileName: string;
  } | null>(null);

  function handleExport() {
    setImportError(null);
    setImportMessage(null);

    const exportPayload = JSON.stringify(state, null, 2);
    const blob = new Blob([exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `deer-intel-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportButtonClick() {
    setImportError(null);
    setImportMessage(null);
    fileInputRef.current?.click();
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Reset the input so selecting the same file again still fires onChange.
    event.target.value = "";

    if (!file) return;

    setImportError(null);
    setImportMessage(null);

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));

        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray((parsed as { properties?: unknown }).properties)
        ) {
          setImportError(
            "That file doesn't look like a Deer Intel backup (no properties list found). Nothing was changed.",
          );
          return;
        }

        setPendingImport({
          state: parsed as DeerIntelState,
          fileName: file.name,
        });
      } catch {
        setImportError(
          "Couldn't read that file as JSON. Nothing was changed.",
        );
      }
    };

    reader.onerror = () => {
      setImportError("Couldn't read that file. Nothing was changed.");
    };

    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (!pendingImport) return;

    saveDeerIntelStore(pendingImport.state);
    setImportMessage(
      `Import complete. Replaced local data with the backup from "${pendingImport.fileName}".`,
    );
    setPendingImport(null);
  }

  function handleCancelImport() {
    setPendingImport(null);
  }

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Settings"
          title="Deer Intel Settings"
          description="Review how Deer Intel is storing data right now and jump to the sections that help keep the app organized."
          meta={
            <>
              <Badge variant="success">
                {cloudActive ? "Cloud Sync On" : "Local Persistence"}
              </Badge>
              <Badge>{totalRecords} saved records</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Appearance" title="Theme">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Choose how Deer Intel looks. Night mode uses red on black to protect
            your night vision on the walk in before first light. This is saved
            on this device only.
          </p>
          <div style={themeGridStyle}>
            {THEME_PREFERENCES.map((preference) => {
              const active = preference === themePreference;

              return (
                <button
                  key={preference}
                  type="button"
                  onClick={() => setThemePreference(preference)}
                  aria-pressed={active}
                  style={{
                    ...themeOptionStyle,
                    ...(active ? themeOptionActiveStyle : null),
                  }}
                >
                  <span style={themeOptionLabelStyle}>
                    {THEME_LABELS[preference]}
                  </span>
                  <span style={themeOptionDescStyle}>
                    {THEME_DESCRIPTIONS[preference]}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section eyebrow="Storage" title="Current Data Setup">
        <div style={settingsGridStyle}>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Storage Mode</p>
            <h2 style={cardTitleStyle}>
              {cloudActive ? "Cloud Sync" : "This Browser"}
            </h2>
            <p style={mutedTextStyle}>
              {cloudActive
                ? `Signed in as ${user?.email ?? "your account"}. Data is saved locally and backed up to the cloud, syncing across your devices.`
                : configured
                  ? "Deer Intel is saved in this browser. Sign in below to back up your data and sync it across devices."
                  : "Deer Intel is currently saved in local browser storage. No account, database, or cloud sync is connected yet."}
            </p>
          </Card>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Active Property</p>
            <h2 style={cardTitleStyle}>{selectedProperty?.name ?? "None yet"}</h2>
            <p style={mutedTextStyle}>
              The active property controls map assets, camera views, stand lists,
              and intelligence summaries.
            </p>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Saved Data" title="Local Record Counts">
        <div style={statGridStyle}>
          <StatCard
            label="Properties"
            value={state.properties.length}
            detail="Hunting properties"
          />
          <StatCard
            label="Camera Sites"
            value={state.cameras.length}
            detail={`${state.cameraChecks.length} checks saved`}
          />
          <StatCard
            label="Stands"
            value={state.stands.length}
            detail="Stand workspaces"
          />
          <StatCard
            label="Hunts"
            value={state.hunts.length}
            detail="Hunt log entries"
          />
          <StatCard
            label="Photo Records"
            value={state.photoRecords.length}
            detail="Camera history"
          />
          <StatCard
            label="Deer Profiles"
            value={state.deerProfiles.length}
            detail="Tracked deer"
          />
        </div>
      </Section>

      <Section eyebrow="Backup" title="Export & Import Data">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Everything in Deer Intel lives only in this browser&apos;s local
            storage. Download a backup regularly, especially before clearing
            browser data, switching browsers, or moving to a new device.
            Importing a backup file replaces everything currently saved in
            this browser.
          </p>
          <div style={backupActionsStyle}>
            <Button type="button" variant="primary" onClick={handleExport}>
              Download Backup ({totalRecords} records)
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleImportButtonClick}
            >
              Import Backup File
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            style={hiddenInputStyle}
          />
          {importError ? (
            <p style={errorTextStyle} role="alert">
              {importError}
            </p>
          ) : null}
          {importMessage ? (
            <p style={successTextStyle} role="status">
              {importMessage}
            </p>
          ) : null}
        </Card>
      </Section>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace all local data?"
        description={
          pendingImport
            ? `"${pendingImport.fileName}" contains ${recordCount(pendingImport.state)} records. Importing it will permanently replace the ${totalRecords} records currently saved in this browser. This can't be undone unless you have another backup.`
            : ""
        }
        confirmLabel="Replace Data"
        confirmVariant="danger"
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
      />

      <Section eyebrow="Navigation" title="Keep Building Your Data">
        <div style={actionGridStyle}>
          <ActionCard
            href="/properties"
            title="Properties"
            description="Add or open a property command center."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/cameras"
            title="Cameras"
            description="Review camera sites for the active property."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/stands"
            title="Stands"
            description="Review stand sites and wind notes."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/hunt-log"
            title="Hunt Log"
            description="Add field history tied to properties and stands."
          />
          <ActionCard
            href="/ai"
            title="Intelligence"
            description="Review local recommendations and property patterns."
          />
          <ActionCard
            href="/map"
            title="Map"
            description="Open the property map and saved assets."
          />
        </div>
      </Section>

      <Section eyebrow="Account" title="Account & Cloud Sync">
        <AccountPanel />
      </Section>

      <Section eyebrow="Future Settings" title="Not Connected Yet">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Real AI calls and paid map layers are intentionally not connected
            yet. Local JSON export/import above is always available as a manual
            backup option, independent of cloud sync.
          </p>
          <Link href="/" style={primaryLinkStyle}>
            Back to Dashboard
          </Link>
        </Card>
      </Section>
    </PageShell>
  );
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const settingsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const themeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
  marginTop: "1rem",
};

const themeOptionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.3rem",
  minHeight: "auto",
  padding: "0.85rem 0.9rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
  color: "var(--text)",
  textAlign: "left",
  cursor: "pointer",
};

const themeOptionActiveStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
  boxShadow: "0 0 0 1px var(--accent)",
};

const themeOptionLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: "1rem",
};

const themeOptionDescStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "1rem",
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const cardTitleStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  fontSize: "1.4rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const backupActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1rem",
};

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const errorTextStyle: CSSProperties = {
  margin: "0.85rem 0 0",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const successTextStyle: CSSProperties = {
  margin: "0.85rem 0 0",
  color: "var(--success-text)",
  lineHeight: 1.5,
};
