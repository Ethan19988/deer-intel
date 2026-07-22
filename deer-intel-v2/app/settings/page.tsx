"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import {
  CameraIcon,
  ClipboardIcon,
  DeerIcon,
  GearIcon,
  ImageIcon,
  MapPinIcon,
  StandIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import AccountPanel from "@/components/auth/AccountPanel";
import DataPrivacyManager from "@/components/settings/DataPrivacyManager";
import NotificationsManager from "@/components/settings/NotificationsManager";
import OfflineMapsManager from "@/components/settings/OfflineMapsManager";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import { backupLocalImages } from "@/lib/imageStore";
import {
  setThemePreference,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_PREFERENCES,
  useThemePreference,
} from "@/lib/theme";
import {
  setTemperatureUnit,
  setWindUnit,
  useUnitPreferences,
} from "@/lib/units";
import {
  setDefaultMapLayer,
  setDefaultMapOverlay,
  setShowSampleTerrain,
  useDefaultMapLayer,
  useDefaultMapOverlays,
  useShowSampleTerrain,
} from "@/lib/mapPreferences";
import { setAiScoutEnabled, useAiScoutEnabled } from "@/lib/aiScoutPreferences";
import {
  setRutPeak,
  setSeasonOpener,
  useSeasonCalendar,
} from "@/lib/seasonCalendar";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";
import SeasonRutCard from "@/components/season/SeasonRutCard";
import { MAP_LAYERS, MAP_OVERLAYS } from "@/lib/propertyMap";
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
  const units = useUnitPreferences();
  const defaultMapLayer = useDefaultMapLayer();
  const defaultMapOverlays = useDefaultMapOverlays();
  const showSampleTerrain = useShowSampleTerrain();
  const seasonCalendar = useSeasonCalendar();
  const aiScoutEnabled = useAiScoutEnabled();
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
  const [isBackingUpPhotos, setIsBackingUpPhotos] = useState(false);
  const [photoBackupStatus, setPhotoBackupStatus] = useState<string | null>(
    null,
  );

  async function handleBackupPhotos() {
    setIsBackingUpPhotos(true);
    setPhotoBackupStatus("Backing up your photos…");

    try {
      const result = await backupLocalImages((done, total) => {
        setPhotoBackupStatus(`Backing up ${done} of ${total}…`);
      });

      setPhotoBackupStatus(
        result.total === 0
          ? "No photos are stored on this device. Open this on the device that has your pictures (usually your phone)."
          : `Backed up ${result.uploaded} of ${result.total} photo${
              result.total === 1 ? "" : "s"
            }${
              result.failed
                ? ` — ${result.failed} couldn't upload, tap again to retry.`
                : ". They're protected and will show on all your devices."
            }`,
      );
    } catch {
      setPhotoBackupStatus("Couldn't back up right now. Tap to try again.");
    } finally {
      setIsBackingUpPhotos(false);
    }
  }

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

  // Settings are grouped into tabs rather than one long scroll: each tab is a
  // self-contained area (look, alerts, data, offline, account) so a setting is
  // a click away instead of a hunt down the page.
  const generalTab = (
    <>
      <Section eyebrow="Appearance" title="Theme">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Choose how Deer Intel looks. Night mode uses red on black to protect
            your night vision on the walk in before first light. This is saved
            on this device only.
          </p>
          <div style={optionGridStyle}>
            {THEME_PREFERENCES.map((preference) => {
              const active = preference === themePreference;

              return (
                <button
                  key={preference}
                  type="button"
                  onClick={() => setThemePreference(preference)}
                  aria-pressed={active}
                  style={{
                    ...optionButtonStyle,
                    ...(active ? optionButtonActiveStyle : null),
                  }}
                >
                  <span style={optionLabelStyle}>
                    {THEME_LABELS[preference]}
                  </span>
                  <span style={optionDescStyle}>
                    {THEME_DESCRIPTIONS[preference]}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section eyebrow="Units" title="Measurement Units">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Choose how live weather is shown across the dashboard, forecast, and
            the live-weather auto-fill. Records you already saved keep the units
            they were recorded in. This is saved on this device only.
          </p>
          <div style={unitSettingsStyle}>
            <UnitSetting
              label="Temperature"
              value={units.temperature}
              onSelect={setTemperatureUnit}
              options={[
                { value: "F", label: "°F" },
                { value: "C", label: "°C" },
              ]}
            />
            <UnitSetting
              label="Wind speed"
              value={units.wind}
              onSelect={setWindUnit}
              options={[
                { value: "mph", label: "mph" },
                { value: "kmh", label: "km/h" },
              ]}
            />
          </div>
        </Card>
      </Section>

      <Section eyebrow="Map" title="Default Map Layer">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Choose which base layer the map opens on. A shortcut link (like the
            sidebar&apos;s LiDAR) still overrides it for that visit, and you can
            always switch layers on the map. Saved on this device only.
          </p>
          <div style={mapLayerGridStyle}>
            {MAP_LAYERS.map((layer) => {
              const active = layer.id === defaultMapLayer;

              return (
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDefaultMapLayer(layer.id)}
                  style={{
                    ...mapLayerOptionStyle,
                    ...(active ? mapLayerOptionActiveStyle : null),
                  }}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section eyebrow="Map" title="Default Overlays">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Choose which data overlays the map opens with. These stack on top of
            the base layer, so any combination can be on. You can still toggle
            each one on the map itself. Saved on this device only.
          </p>
          <div style={optionGridStyle}>
            {MAP_OVERLAYS.map((overlay) => {
              const active = defaultMapOverlays[overlay.id];

              return (
                <button
                  key={overlay.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDefaultMapOverlay(overlay.id, !active)}
                  style={{
                    ...optionButtonStyle,
                    ...(active ? optionButtonActiveStyle : null),
                  }}
                >
                  <span style={optionLabelStyle}>{overlay.label}</span>
                  <span style={optionDescStyle}>{overlay.description}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section eyebrow="Terrain" title="Sample Terrain Reads">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Two example properties (Moore Hill, Sideling Hill) ship with a built-in
            high-res terrain read. Leave this on to see them near those spots. Turn
            it off and every property — including yours — only ever shows its own
            read: the live read, or a 1 m set generated for it. Saved on this
            device only.
          </p>
          <div style={optionGridStyle}>
            <button
              type="button"
              aria-pressed={showSampleTerrain}
              onClick={() => setShowSampleTerrain(!showSampleTerrain)}
              style={{
                ...optionButtonStyle,
                ...(showSampleTerrain ? optionButtonActiveStyle : null),
              }}
            >
              <span style={optionLabelStyle}>Show built-in sample terrain</span>
              <span style={optionDescStyle}>
                {showSampleTerrain
                  ? "On — the Moore Hill & Sideling samples can appear near those spots"
                  : "Off — only this property's own read is shown"}
              </span>
            </button>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Season" title="Season & Rut Calendar">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Set your season opener and local rut peak to see where you are in the
            season — the phase, a countdown to the peak, and what deer are doing.
            Leave the rut peak blank to use the estimate for your area
            {selectedProperty && hasPropertyCoordinate(selectedProperty)
              ? ` (based on ${selectedProperty.name})`
              : ""}
            . Saved on this device only.
          </p>
          <div style={seasonFieldRowStyle}>
            <label style={seasonFieldStyle}>
              <span style={unitLabelStyle}>Season opener</span>
              <input
                type="date"
                value={seasonCalendar.seasonOpener ?? ""}
                onChange={(event) =>
                  setSeasonOpener(event.target.value || null)
                }
                style={seasonInputStyle}
              />
            </label>
            <label style={seasonFieldStyle}>
              <span style={unitLabelStyle}>Rut peak</span>
              <input
                type="date"
                value={seasonCalendar.rutPeak ?? ""}
                onChange={(event) => setRutPeak(event.target.value || null)}
                style={seasonInputStyle}
              />
            </label>
          </div>
          <SeasonRutCard
            latitude={
              selectedProperty && hasPropertyCoordinate(selectedProperty)
                ? selectedProperty.latitude
                : undefined
            }
          />
        </Card>
      </Section>
    </>
  );

  const alertsTab = (
    <Section eyebrow="Notifications" title="Field Alerts">
      <Card as="div" variant="subtle">
        <NotificationsManager />
      </Card>
    </Section>
  );

  const dataTab = (
    <>
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
            icon={<MapPinIcon size={18} />}
            tone="green"
          />
          <StatCard
            label="Camera Sites"
            value={state.cameras.length}
            detail={`${state.cameraChecks.length} checks saved`}
            icon={<CameraIcon size={18} />}
            tone="green"
          />
          <StatCard
            label="Stands"
            value={state.stands.length}
            detail="Stand workspaces"
            icon={<StandIcon size={18} />}
            tone="neutral"
          />
          <StatCard
            label="Hunts"
            value={state.hunts.length}
            detail="Hunt log entries"
            icon={<ClipboardIcon size={18} />}
            tone="neutral"
          />
          <StatCard
            label="Photo Records"
            value={state.photoRecords.length}
            detail="Camera history"
            icon={<ImageIcon size={18} />}
            tone="neutral"
          />
          <StatCard
            label="Deer Profiles"
            value={state.deerProfiles.length}
            detail="Tracked deer"
            icon={<DeerIcon size={18} />}
            tone="blaze"
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

      {cloudActive ? (
        <Section eyebrow="Backup" title="Back Up Photos to the Cloud">
          <Card as="div" variant="subtle">
            <p style={mutedTextStyle}>
              Photo details sync automatically, but the pictures are saved on
              each device and a phone can clear them to free space. Tap below on
              the device that has your photos (usually your phone) to upload
              them all to your account — then they&apos;re protected and show on
              every device. Photos you add from now on back up on their own.
            </p>
            <div style={backupActionsStyle}>
              <Button
                type="button"
                variant="primary"
                disabled={isBackingUpPhotos}
                onClick={handleBackupPhotos}
              >
                {isBackingUpPhotos ? "Backing up…" : "Back Up My Photos"}
              </Button>
            </div>
            {photoBackupStatus ? (
              <p style={successTextStyle} role="status">
                {photoBackupStatus}
              </p>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section eyebrow="Import" title="Import Pins from Other Apps">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Already have waypoints saved in onX Hunt, HuntStand, BaseMap,
            Spartan Forge, Garmin, or Google Earth? Export them as a GPX, KML,
            or KMZ file, then upload it here to bring your stands, cameras,
            bedding, scrapes, and more onto your Deer Intel map. You review
            every pin and pick a property before anything is saved.
          </p>
          <Link href="/pins/import" style={primaryLinkStyle}>
            Open Pin Importer
          </Link>
        </Card>
      </Section>

    </>
  );

  const offlineTab = (
    <Section eyebrow="Offline" title="Offline Maps">
      <Card as="div" variant="subtle">
        <OfflineMapsManager />
      </Card>
    </Section>
  );

  const accountTab = (
    <>
      <Section eyebrow="Account" title="Account & Cloud Sync">
        <AccountPanel />
      </Section>

      <Section eyebrow="AI Scout" title="AI Recommendations">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            AI Scout reads this property&apos;s saved stands, hunts, camera
            checks, and buck photos to recommend where to hunt. It&apos;s
            opt-in and pay-per-call: it only runs when you tap &ldquo;Ask AI
            Scout,&rdquo; and only if an <code style={inlineCodeStyle}>ANTHROPIC_API_KEY</code>{" "}
            is set on the server. When you ask, that property&apos;s data is
            sent to Anthropic to generate the recommendation.
          </p>
          <p style={mutedTextStyle}>
            Turn it off to keep AI Scout hidden and never send any data to
            Anthropic — the rule-based insights on the Hunt Plan page keep
            working either way. Saved on this device only.
          </p>
          <div style={aiScoutToggleRowStyle}>
            <span style={unitLabelStyle}>AI Scout recommendations</span>
            <div style={unitSegmentGroupStyle}>
              <button
                type="button"
                aria-pressed={aiScoutEnabled}
                onClick={() => setAiScoutEnabled(true)}
                style={{
                  ...unitSegmentStyle,
                  ...(aiScoutEnabled ? unitSegmentActiveStyle : null),
                }}
              >
                On
              </button>
              <button
                type="button"
                aria-pressed={!aiScoutEnabled}
                onClick={() => setAiScoutEnabled(false)}
                style={{
                  ...unitSegmentStyle,
                  ...(!aiScoutEnabled ? unitSegmentActiveStyle : null),
                }}
              >
                Off
              </button>
            </div>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Data & Privacy" title="Your Data">
        <Card as="div" variant="subtle">
          <DataPrivacyManager
            recordCount={totalRecords}
            cloudActive={cloudActive}
          />
        </Card>
      </Section>
    </>
  );

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          icon={<GearIcon size={26} />}
          eyebrow="Settings"
          title="Deer Intel Settings"
          description="Choose how Deer Intel looks, what it alerts you to, and how it stores your data. Each area has its own tab."
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

      <Tabs
        items={[
          { id: "general", label: "General", content: generalTab },
          { id: "alerts", label: "Alerts", content: alertsTab },
          { id: "data", label: "Data", content: dataTab },
          { id: "offline", label: "Offline", content: offlineTab },
          { id: "account", label: "Account", content: accountTab },
        ]}
      />

      {/* Page-level, so switching tabs mid-import can't unmount the confirm. */}
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
    </PageShell>
  );
}

function UnitSetting<T extends string>({
  label,
  value,
  onSelect,
  options,
}: {
  label: string;
  value: T;
  onSelect: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div style={unitSettingStyle}>
      <span style={unitLabelStyle}>{label}</span>
      <div style={unitSegmentGroupStyle}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              style={{
                ...unitSegmentStyle,
                ...(active ? unitSegmentActiveStyle : null),
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const unitSettingsStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
};

const unitSettingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.75rem",
};

const unitLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: "0.95rem",
};

const unitSegmentGroupStyle: CSSProperties = {
  display: "inline-flex",
  padding: "0.2rem",
  gap: "0.2rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
};

const unitSegmentStyle: CSSProperties = {
  minHeight: "40px",
  minWidth: "56px",
  padding: "0.4rem 0.9rem",
  border: "1px solid transparent",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-muted)",
  fontWeight: 800,
  cursor: "pointer",
};

const unitSegmentActiveStyle: CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const aiScoutToggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1rem",
};

const inlineCodeStyle: CSSProperties = {
  padding: "0.1rem 0.3rem",
  borderRadius: "4px",
  background: "var(--surface-3)",
  fontSize: "0.85em",
};

const mapLayerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.6rem",
  marginTop: "1rem",
};

const seasonFieldRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
  margin: "1rem 0",
};

const seasonFieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const seasonInputStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0.6rem 0.7rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};

const mapLayerOptionStyle: CSSProperties = {
  minHeight: "48px",
  padding: "0.6rem 0.8rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
};

const mapLayerOptionActiveStyle: CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const settingsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const optionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
  marginTop: "1rem",
};

const optionButtonStyle: CSSProperties = {
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

const optionButtonActiveStyle: CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  boxShadow: "0 0 0 1px var(--accent)",
};

const optionLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: "1rem",
};

const optionDescStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
