"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { CAMERA_IMPORT_PROVIDERS } from "@/lib/cameraImportProviders";
import type { PhotoRecord } from "@/types/photo";

const SPECIES_OPTIONS = [
  "Buck",
  "Doe",
  "Fawn",
  "Turkey",
  "Bear",
  "Coyote",
  "Other",
];

type ImportDraft = {
  id: string;
  fileName: string;
  photoDate: string;
  extractedTime: string;
  metadataSource: string;
  species: string;
  deerProfileId: string;
  buckName: string;
  notes: string;
  selected: boolean;
};

export default function CameraImportPage() {
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    selectedProperty?.id ?? "",
  );
  const propertyId = selectedPropertyId || selectedProperty?.id || "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === propertyId,
  );
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const cameraId =
    selectedCameraId && propertyCameras.some((camera) => camera.id === selectedCameraId)
      ? selectedCameraId
      : propertyCameras[0]?.id ?? "";
  const cameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === propertyId && check.cameraId === cameraId,
  );
  const [selectedCameraCheckId, setSelectedCameraCheckId] = useState("");
  const cameraCheckId =
    selectedCameraCheckId &&
    cameraChecks.some((check) => check.id === selectedCameraCheckId)
      ? selectedCameraCheckId
      : cameraChecks[0]?.id ?? "";
  const deerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === propertyId,
  );
  const [defaultSpecies, setDefaultSpecies] = useState("Other");
  const [defaultDeerProfileId, setDefaultDeerProfileId] = useState("");
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [message, setMessage] = useState("");
  const selectedDrafts = drafts.filter((draft) => draft.selected);
  const canCreateRecords =
    Boolean(propertyId && cameraId && cameraCheckId) &&
    selectedDrafts.length > 0 &&
    selectedDrafts.every(
      (draft) => draft.fileName.trim() && draft.photoDate.trim() && draft.species.trim(),
    );
  const activePropertyName =
    state.properties.find((property) => property.id === propertyId)?.name ??
    "No property selected";
  const activeCameraName =
    propertyCameras.find((camera) => camera.id === cameraId)?.name ??
    "No camera site selected";
  const selectedCheckLabel = useMemo(() => {
    const check = cameraChecks.find((item) => item.id === cameraCheckId);

    return check?.date || "No camera check selected";
  }, [cameraCheckId, cameraChecks]);

  function handlePropertyChange(nextPropertyId: string) {
    setSelectedPropertyId(nextPropertyId);
    setSelectedCameraId("");
    setSelectedCameraCheckId("");
    setDefaultDeerProfileId("");
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: nextPropertyId,
    }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) return;

    const nextDrafts = files.map((file) =>
      createImportDraft({
        file,
        species: defaultSpecies,
        deerProfileId: defaultDeerProfileId,
      }),
    );

    setDrafts((currentDrafts) => [...currentDrafts, ...nextDrafts]);
    setMessage(`${files.length} photo ${files.length === 1 ? "file" : "files"} added to the inbox.`);
    event.target.value = "";
  }

  function updateDraft<Field extends keyof ImportDraft>(
    draftId: string,
    field: Field,
    value: ImportDraft[Field],
  ) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function applyDefaultsToDrafts() {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.selected
          ? {
              ...draft,
              species: defaultSpecies,
              deerProfileId: defaultDeerProfileId,
            }
          : draft,
      ),
    );
    setMessage("Defaults applied to selected photos.");
  }

  function removeSelectedDrafts() {
    setDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => !draft.selected),
    );
    setMessage("Selected photos removed from the inbox.");
  }

  function createPhotoRecords() {
    if (!canCreateRecords) {
      setMessage(
        "Choose a property, camera site, camera check, and make sure selected photos have a date and species.",
      );
      return;
    }

    const newPhotoRecords: PhotoRecord[] = selectedDrafts.map((draft) => ({
      id: createDeerIntelId("photo"),
      propertyId,
      cameraSiteId: cameraId,
      cameraCheckId,
      fileName: draft.fileName.trim(),
      photoDate: draft.photoDate.trim(),
      species: draft.species.trim(),
      deerProfileId: draft.deerProfileId.trim() || undefined,
      buckName: draft.buckName.trim() || undefined,
      notes: buildImportNotes(draft),
      createdAt: new Date().toISOString(),
    }));

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      photoRecords: [...currentState.photoRecords, ...newPhotoRecords],
    }));
    setDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => !draft.selected),
    );
    setMessage(`${newPhotoRecords.length} photo records created.`);
  }

  return (
    <PageShell>
      <Link href="/cameras" style={backLinkStyle}>
        Back to Cameras
      </Link>

      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Camera Import"
          title="Camera Import Inbox"
          description="Bulk add camera photo records from local files, assign them to a property and camera site, and keep the actual camera-company integrations for a future phase."
          meta={
            <>
              <Badge variant="success">Local Upload</Badge>
              <Badge>{drafts.length} in inbox</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Assign" title="Where These Photos Belong">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before importing camera photos."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <div className="di-form-grid" style={formGridStyle}>
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

              <label style={fieldStyle}>
                <span style={labelStyle}>Camera Site</span>
                <select
                  value={cameraId}
                  onChange={(event) => {
                    setSelectedCameraId(event.target.value);
                    setSelectedCameraCheckId("");
                  }}
                  style={inputStyle}
                >
                  {propertyCameras.length === 0 ? (
                    <option value="">No camera sites yet</option>
                  ) : null}
                  {propertyCameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Camera Check</span>
                <select
                  value={cameraCheckId}
                  onChange={(event) => setSelectedCameraCheckId(event.target.value)}
                  style={inputStyle}
                >
                  {cameraChecks.length === 0 ? (
                    <option value="">No camera checks yet</option>
                  ) : null}
                  {cameraChecks.map((check) => (
                    <option key={check.id} value={check.id}>
                      {check.date || "Camera check"}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Default Deer Profile</span>
                <select
                  value={defaultDeerProfileId}
                  onChange={(event) => setDefaultDeerProfileId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Unknown / not linked</option>
                  {deerProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.nickname}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Default Species</span>
                <select
                  value={defaultSpecies}
                  onChange={(event) => setDefaultSpecies(event.target.value)}
                  style={inputStyle}
                >
                  {SPECIES_OPTIONS.map((species) => (
                    <option key={species} value={species}>
                      {species}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p style={assignmentTextStyle}>
              Importing to {activePropertyName} / {activeCameraName} /{" "}
              {selectedCheckLabel}. Photo records stay local in this browser.
            </p>

            {propertyCameras.length === 0 ? (
              <EmptyState
                title="No camera sites for this property"
                description="Add a camera site before importing photos."
                action={
                  <Link
                    href={propertyId ? `/properties/${propertyId}#camera-sites` : "/properties"}
                    style={primaryLinkStyle}
                  >
                    Add Camera Site
                  </Link>
                }
              />
            ) : null}

            {propertyCameras.length > 0 && cameraChecks.length === 0 ? (
              <EmptyState
                title="No camera checks for this camera"
                description="The current Photo Record model attaches photos to a camera check. Open the camera site and save a check before creating imported photo records."
                action={
                  <Link
                    href={cameraId ? `/properties/${propertyId}/assets/${cameraId}` : "/cameras"}
                    style={primaryLinkStyle}
                  >
                    Open Camera Site
                  </Link>
                }
              />
            ) : null}
          </Card>
        )}
      </Section>

      <Section eyebrow="Upload" title="Add Photos to Inbox">
        <Card as="div" variant="subtle">
          <label style={uploadBoxStyle}>
            <span style={uploadTitleStyle}>Choose camera photos</span>
            <span style={mutedTextStyle}>
              Select multiple JPG, PNG, or image files. Deer Intel reads the
              filename and browser file date where available.
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              style={fileInputStyle}
            />
          </label>

          <div style={buttonRowStyle}>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedDrafts.length === 0}
              onClick={applyDefaultsToDrafts}
            >
              Apply Defaults
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedDrafts.length === 0}
              onClick={removeSelectedDrafts}
            >
              Remove Selected
            </Button>
            <Button
              type="button"
              disabled={!canCreateRecords}
              onClick={createPhotoRecords}
            >
              Create Photo Records
            </Button>
          </div>

          {message ? <p style={messageStyle}>{message}</p> : null}
        </Card>
      </Section>

      <Section eyebrow="Inbox" title="Selected Photos">
        {drafts.length === 0 ? (
          <EmptyState
            title="No photos in the inbox"
            description="Choose multiple photo files above to stage them before creating Photo Records."
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
                      <span style={draftTitleStyle}>{draft.fileName}</span>
                      <span style={draftMetaStyle}>
                        {draft.metadataSource}
                        {draft.extractedTime ? ` / ${draft.extractedTime}` : ""}
                      </span>
                    </span>
                  </label>
                  <Badge>{draft.species || "Species needed"}</Badge>
                </div>

                <div className="di-form-grid" style={draftFormGridStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>File Name or Label</span>
                    <input
                      value={draft.fileName}
                      onChange={(event) =>
                        updateDraft(draft.id, "fileName", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Photo Date and Time</span>
                    <input
                      type="datetime-local"
                      value={draft.photoDate}
                      onChange={(event) =>
                        updateDraft(draft.id, "photoDate", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Species</span>
                    <select
                      value={draft.species}
                      onChange={(event) =>
                        updateDraft(draft.id, "species", event.target.value)
                      }
                      style={inputStyle}
                    >
                      {SPECIES_OPTIONS.map((species) => (
                        <option key={species} value={species}>
                          {species}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Deer Profile</span>
                    <select
                      value={draft.deerProfileId}
                      onChange={(event) =>
                        updateDraft(draft.id, "deerProfileId", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Unknown / not linked</option>
                      {deerProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.nickname}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Buck Name</span>
                    <input
                      value={draft.buckName}
                      onChange={(event) =>
                        updateDraft(draft.id, "buckName", event.target.value)
                      }
                      placeholder="Optional"
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label style={{ ...fieldStyle, marginTop: "1rem" }}>
                  <span style={labelStyle}>Notes</span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft(draft.id, "notes", event.target.value)
                    }
                    placeholder="Direction of travel, behavior, or anything worth remembering"
                    style={textAreaStyle}
                  />
                </label>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Future Providers" title="Camera Company Imports">
        <div style={providerGridStyle}>
          {CAMERA_IMPORT_PROVIDERS.map((provider) => (
            <Card key={provider.id} as="article" variant="subtle">
              <div style={providerHeaderStyle}>
                <h3 style={providerTitleStyle}>{provider.name}</h3>
                <Badge variant="warning">Planned</Badge>
              </div>
              <p style={mutedTextStyle}>{provider.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function createImportDraft({
  file,
  species,
  deerProfileId,
}: {
  file: File;
  species: string;
  deerProfileId: string;
}): ImportDraft {
  const metadata = extractPhotoMetadata(file);

  return {
    id: createDeerIntelId("import-photo"),
    fileName: file.name,
    photoDate: metadata.photoDate,
    extractedTime: metadata.extractedTime,
    metadataSource: metadata.metadataSource,
    species,
    deerProfileId,
    buckName: "",
    notes: "Imported through Camera Import Inbox.",
    selected: true,
  };
}

function extractPhotoMetadata(file: File) {
  const filenameDate = dateTimeFromFileName(file.name);

  if (filenameDate) {
    return {
      photoDate: filenameDate.photoDate,
      extractedTime: filenameDate.extractedTime,
      metadataSource: "Date read from filename",
    };
  }

  if (file.lastModified > 0) {
    const fileDate = new Date(file.lastModified);

    return {
      photoDate: toDateTimeInputValue(fileDate),
      extractedTime: timeLabel(fileDate),
      metadataSource: "Date read from file metadata",
    };
  }

  return {
    photoDate: "",
    extractedTime: "",
    metadataSource: "No date metadata found",
  };
}

function dateTimeFromFileName(fileName: string) {
  const match = /(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[^\d]?(\d{2})[-_]?(\d{2})(?:[-_]?(\d{2}))?)?/.exec(
    fileName,
  );

  if (!match) return null;

  const [, year, month, day, hour = "12", minute = "00", second = "00"] = match;
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    photoDate: toDateTimeInputValue(parsedDate),
    extractedTime: timeLabel(parsedDate),
  };
}

function toDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildImportNotes(draft: ImportDraft) {
  return [
    draft.notes.trim(),
    draft.metadataSource ? `Metadata: ${draft.metadataSource}.` : "",
    draft.extractedTime ? `Time: ${draft.extractedTime}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
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

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
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
  minHeight: "96px",
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

const providerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
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
