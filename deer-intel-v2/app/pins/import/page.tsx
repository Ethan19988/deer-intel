"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { MapPinIcon } from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  IMPORT_PIN_TYPES,
  parseWaypointFileFromFile,
  type ImportedWaypoint,
} from "@/lib/pinImport";
import { formatCoordinate } from "@/lib/propertyMap";
import type { MapPin, PinType } from "@/types/mapPin";

// Apps hunters commonly move pins from. Purely informational — every one of them
// can export a GPX or KML file, which is what this importer reads.
const SOURCE_APPS: { name: string; hint: string }[] = [
  { name: "onX Hunt", hint: "Export Waypoints as GPX, KML, or KMZ." },
  { name: "HuntStand", hint: "Share/Export markers as GPX or KML." },
  { name: "BaseMap", hint: "Export waypoints as GPX or KML." },
  { name: "Spartan Forge", hint: "Export saved markers as GPX or KML." },
  { name: "Garmin / handheld GPS", hint: "Export tracks & waypoints as GPX." },
  { name: "Google Earth", hint: "Save Place As KML or KMZ." },
];

type PinDraft = {
  id: string;
  fileName: string;
  name: string;
  type: PinType;
  lat: number;
  lng: number;
  description: string;
  selected: boolean;
};

export default function PinImportPage() {
  const state = useDeerIntelStore();
  const activeProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    activeProperty?.id ?? "",
  );
  const propertyId = selectedPropertyId || activeProperty?.id || "";
  const propertyName =
    state.properties.find((property) => property.id === propertyId)?.name ??
    "No property selected";

  const [drafts, setDrafts] = useState<PinDraft[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedDrafts = drafts.filter((draft) => draft.selected);
  const canImport = Boolean(propertyId) && selectedDrafts.length > 0;

  function handlePropertyChange(nextPropertyId: string) {
    setSelectedPropertyId(nextPropertyId);
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: nextPropertyId,
    }));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    setError("");
    setMessage("");

    const newDrafts: PinDraft[] = [];
    const problems: string[] = [];

    for (const file of files) {
      let result;

      try {
        result = await parseWaypointFileFromFile(file);
      } catch {
        problems.push(`${file.name}: couldn't be read.`);
        continue;
      }

      if (result.error && result.waypoints.length === 0) {
        problems.push(`${file.name}: ${result.error}`);
        continue;
      }

      for (const waypoint of result.waypoints) {
        newDrafts.push(draftFromWaypoint(file.name, waypoint));
      }
    }

    if (newDrafts.length > 0) {
      setDrafts((current) => [...current, ...newDrafts]);
      setMessage(
        `${newDrafts.length} ${newDrafts.length === 1 ? "pin" : "pins"} read from ${files.length} ${files.length === 1 ? "file" : "files"}. Review below, then import.`,
      );
    }

    if (problems.length > 0) {
      setError(problems.join(" "));
    } else if (newDrafts.length === 0) {
      setError("No pins were found in the selected file(s).");
    }
  }

  function updateDraft<Field extends keyof PinDraft>(
    draftId: string,
    field: Field,
    value: PinDraft[Field],
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function setAllSelected(selected: boolean) {
    setDrafts((current) => current.map((draft) => ({ ...draft, selected })));
  }

  function removeSelected() {
    setDrafts((current) => current.filter((draft) => !draft.selected));
    setMessage("Removed selected pins from the review list.");
  }

  function importPins() {
    if (!canImport) {
      setError(
        "Choose a property and select at least one pin to import.",
      );
      return;
    }

    const createdAt = new Date().toISOString();
    const newPins: MapPin[] = selectedDrafts.map((draft) => ({
      id: createDeerIntelId("pin"),
      propertyId,
      type: draft.type,
      lat: draft.lat,
      lng: draft.lng,
      createdAt,
      name: draft.name.trim(),
      notes: buildPinNotes(draft),
    }));

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: [...currentState.pins, ...newPins],
    }));

    setDrafts((current) => current.filter((draft) => !draft.selected));
    setError("");
    setMessage(
      `Imported ${newPins.length} ${newPins.length === 1 ? "pin" : "pins"} to ${propertyName}. Open the Map to see them.`,
    );
  }

  return (
    <PageShell>
      <Link href="/settings" style={backLinkStyle}>
        Back to Settings
      </Link>

      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          icon={<MapPinIcon size={26} />}
          eyebrow="Import Pins"
          title="Import Pins from Other Apps"
          description="Bring your saved waypoints in from onX Hunt, HuntStand, BaseMap, Spartan Forge, Garmin, or Google Earth. Export them as a GPX, KML, or KMZ file, upload it here, review the pins, and add them to a property. Everything stays on this device."
          meta={
            <>
              <Badge variant="success">GPX / KML / KMZ</Badge>
              <Badge>{drafts.length} in review</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Destination" title="Which Property Gets These Pins">
        {state.properties.length === 0 ? (
          <EmptyState
            illustration={<MapPinIcon size={30} />}
            title="No properties yet"
            description="Add a property before importing pins."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Property</span>
              <select
                value={propertyId}
                onChange={(event) => handlePropertyChange(event.target.value)}
                style={inputStyle}
              >
                {state.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <p style={assignmentTextStyle}>
              Imported pins are added to {propertyName}. They show up on the Map
              and in that property&apos;s assets.
            </p>
          </Card>
        )}
      </Section>

      <Section eyebrow="Upload" title="Add a GPX, KML, or KMZ File">
        <Card as="div" variant="subtle">
          <label style={uploadBoxStyle}>
            <span style={uploadTitleStyle}>Choose GPX, KML, or KMZ files</span>
            <span style={mutedTextStyle}>
              Deer Intel reads point waypoints (markers) and suggests a pin type
              from each waypoint&apos;s name. Lines and areas are skipped. You
              can select more than one file.
            </span>
            <input
              type="file"
              multiple
              accept=".gpx,.kml,.kmz,application/gpx+xml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/xml,text/xml"
              onChange={handleFileChange}
              style={fileInputStyle}
            />
          </label>

          {drafts.length > 0 ? (
            <div style={buttonRowStyle}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAllSelected(true)}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAllSelected(false)}
              >
                Deselect All
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={selectedDrafts.length === 0}
                onClick={removeSelected}
              >
                Remove Selected
              </Button>
              <Button
                type="button"
                disabled={!canImport}
                onClick={importPins}
              >
                Import {selectedDrafts.length || ""} Pin
                {selectedDrafts.length === 1 ? "" : "s"}
              </Button>
            </div>
          ) : null}

          {message ? <p style={messageStyle}>{message}</p> : null}
          {error ? (
            <p style={errorTextStyle} role="alert">
              {error}
            </p>
          ) : null}
        </Card>
      </Section>

      <Section eyebrow="Review" title="Pins Ready to Import">
        {drafts.length === 0 ? (
          <EmptyState
            illustration={<MapPinIcon size={30} />}
            title="No pins staged yet"
            description="Upload a GPX or KML file above to see its waypoints here before importing."
          />
        ) : (
          <div style={draftListStyle}>
            {drafts.map((draft) => (
              <Card key={draft.id} as="article" variant="subtle">
                <div style={draftHeaderStyle}>
                  <label style={checkFieldStyle}>
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        updateDraft(draft.id, "selected", event.target.checked)
                      }
                    />
                    <span>
                      <span style={draftTitleStyle}>{draft.name}</span>
                      <span style={draftMetaStyle}>
                        {formatCoordinate(draft.lat)},{" "}
                        {formatCoordinate(draft.lng)} &middot; {draft.fileName}
                      </span>
                    </span>
                  </label>
                  <Badge>{draft.type}</Badge>
                </div>

                <div className="di-form-grid" style={draftFormGridStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Pin Label</span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        updateDraft(draft.id, "name", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Pin Type</span>
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        updateDraft(
                          draft.id,
                          "type",
                          event.target.value as PinType,
                        )
                      }
                      style={inputStyle}
                    >
                      {IMPORT_PIN_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {draft.description ? (
                  <label style={{ ...fieldStyle, marginTop: "1rem" }}>
                    <span style={labelStyle}>Notes from file</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        updateDraft(draft.id, "description", event.target.value)
                      }
                      style={textAreaStyle}
                    />
                  </label>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Where To Export From" title="Supported Apps">
        <div style={providerGridStyle}>
          {SOURCE_APPS.map((app) => (
            <Card key={app.name} as="article" variant="subtle">
              <h3 style={providerTitleStyle}>{app.name}</h3>
              <p style={mutedTextStyle}>{app.hint}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function draftFromWaypoint(
  fileName: string,
  waypoint: ImportedWaypoint,
): PinDraft {
  return {
    id: waypoint.id,
    fileName,
    name: waypoint.name,
    type: waypoint.suggestedType,
    lat: waypoint.lat,
    lng: waypoint.lng,
    description: waypoint.description,
    selected: true,
  };
}

// The waypoint's name lives in the pin's name field now, so notes carry just
// the description and provenance.
function buildPinNotes(draft: PinDraft) {
  return [draft.description.trim(), `Imported from ${draft.fileName}.`]
    .filter(Boolean)
    .join(" — ");
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "var(--text-muted)",
  fontWeight: 800,
  textDecoration: "none",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
};

const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "80px",
  resize: "vertical",
};

const assignmentTextStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const uploadBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "1rem",
  border: "1px dashed var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  cursor: "pointer",
};

const uploadTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1.1rem",
  fontWeight: 850,
};

const fileInputStyle: CSSProperties = {
  marginTop: "0.5rem",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1rem",
};

const messageStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--accent-text)",
  fontWeight: 800,
};

const errorTextStyle: CSSProperties = {
  margin: "0.85rem 0 0",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const draftListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const draftHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const checkFieldStyle: CSSProperties = {
  display: "flex",
  minHeight: "44px",
  alignItems: "flex-start",
  gap: "0.75rem",
};

const draftTitleStyle: CSSProperties = {
  display: "block",
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const draftMetaStyle: CSSProperties = {
  display: "block",
  marginTop: "0.2rem",
  color: "var(--text-faint)",
  fontSize: "0.9rem",
  lineHeight: 1.4,
};

const draftFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const providerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
};

const providerTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  lineHeight: 1.25,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
