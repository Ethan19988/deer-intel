"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { CameraIcon } from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  EMPTY_CAMERA_CHECK_FORM_VALUES,
  createCameraCheckFromValues,
} from "@/lib/cameraCheckFormValues";
import {
  EMPTY_DEER_PROFILE_FORM_VALUES,
  createDeerProfileFromValues,
} from "@/lib/deerProfileFormValues";
import PhotoImage from "@/components/photos/PhotoImage";
import { processImageFile } from "@/lib/imageProcessing";
import { deletePhotoImage, putPhotoImage } from "@/lib/imageStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { describeMoonPhase } from "@/lib/moonPhase";
import { buildPhotoWeatherSnapshot } from "@/lib/photoWeather";
import { readPhotoDateTimeInput } from "@/lib/photoExif";
import { requestPhotoStamp } from "@/lib/photoStampClient";
import { COMPASS_16, frameDirectionToHeading } from "@/lib/travelDirection";
import { useUnitPreferences } from "@/lib/units";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

// Sentinel for the Camera Check dropdown: create a fresh check on import
// instead of attaching photos to an existing one.
const NEW_CHECK_OPTION = "new-check";

// Default note seeded when the AI reported no animal notes; used to tell a real
// AI description (worth seeding a buck profile with) from the placeholder.
const IMPORTED_NOTE = "Imported through Camera Import Inbox.";

const SPECIES_OPTIONS = [
  "Buck",
  "Doe",
  "Fawn",
  "Turkey",
  "Bear",
  "Coyote",
  "Other",
];

// Must match the BEHAVIOR_VALUES the photo vision reports.
const BEHAVIOR_OPTIONS = [
  "Traveling",
  "Feeding",
  "Chasing",
  "At scrape or rub",
  "Bedded",
  "Alert",
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
  // What the animal was doing and the compass point it was headed — pre-filled
  // from the AI (direction converted through the camera's facing direction),
  // editable on the card before saving.
  behavior: string;
  travelDirection: string;
  notes: string;
  selected: boolean;
  // Values read off the photo's printed info bar, "" when nothing was read.
  stampedTemperature: string;
  stampedMoonPhase: string;
  stampedWindDirection: string;
  stampedWindSpeed: string;
  stampedHumidity: string;
  // What the AI identified in the frame ("" when nothing / not configured).
  // Kept separate from `species` so the badge still shows the AI's call after
  // the hunter adjusts the dropdown.
  aiSpecies: string;
  aiBehavior: string;
  // Frame-relative movement the AI saw ("Left to right", ...), "" when none.
  aiFrameDirection: string;
  // "Big 8 (likely)" when the AI matched a saved deer profile, else "".
  aiMatchLabel: string;
  // The stored (resized) image blob's id and dimensions; "" / 0 when storing
  // the image failed and the record will be metadata-only.
  imageId: string;
  imageWidth: number;
  imageHeight: number;
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
  const activeCamera = propertyCameras.find((camera) => camera.id === cameraId);
  // Cellular cameras transmit photos over service, so there is no card-pull
  // check — those imports attach directly to the camera site.
  const isCellularCamera = activeCamera?.cameraType === "Cellular";
  const cameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === propertyId && check.cameraId === cameraId,
  );
  const [selectedCameraCheckId, setSelectedCameraCheckId] = useState("");
  // For standard cameras the effective selection is either an existing check id
  // or the sentinel NEW_CHECK_OPTION (a check is created on import). When a
  // camera has no checks yet, default to creating one rather than blocking.
  const standardCheckSelection =
    selectedCameraCheckId === NEW_CHECK_OPTION ||
    (selectedCameraCheckId &&
      cameraChecks.some((check) => check.id === selectedCameraCheckId))
      ? selectedCameraCheckId
      : cameraChecks[0]?.id ?? NEW_CHECK_OPTION;
  const cameraCheckSelection = isCellularCamera ? "" : standardCheckSelection;
  const willCreateCheck =
    !isCellularCamera && cameraCheckSelection === NEW_CHECK_OPTION;
  const deerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === propertyId,
  );
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [message, setMessage] = useState("");
  const [savedCameraId, setSavedCameraId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const units = useUnitPreferences();
  const selectedDrafts = drafts.filter((draft) => draft.selected);
  const missingRequirements: string[] = [];
  if (!propertyId) missingRequirements.push("a property");
  if (!cameraId) missingRequirements.push("a camera site");
  if (selectedDrafts.length === 0) {
    missingRequirements.push("at least one selected photo");
  } else if (
    !selectedDrafts.every(
      (draft) => draft.fileName.trim() && draft.photoDate.trim() && draft.species.trim(),
    )
  ) {
    missingRequirements.push("a file name, date, and species on every selected photo");
  }
  const canCreateRecords = missingRequirements.length === 0;
  const activePropertyName =
    state.properties.find((property) => property.id === propertyId)?.name ??
    "No property selected";
  const activeCameraName =
    propertyCameras.find((camera) => camera.id === cameraId)?.name ??
    "No camera site selected";
  const selectedCheckLabel = useMemo(() => {
    if (isCellularCamera) return "Sent over service (no check)";

    if (cameraCheckSelection === NEW_CHECK_OPTION) {
      return "New check (created on import)";
    }

    const check = cameraChecks.find((item) => item.id === cameraCheckSelection);

    return check?.date || "New check (created on import)";
  }, [isCellularCamera, cameraCheckSelection, cameraChecks]);

  function handlePropertyChange(nextPropertyId: string) {
    setSelectedPropertyId(nextPropertyId);
    setSelectedCameraId("");
    setSelectedCameraCheckId("");
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: nextPropertyId,
    }));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (files.length === 0) return;

    setMessage("Saving photos and reading their dates and stamps…");

    // The saved deer profiles' descriptions let vision recognize individual
    // bucks by their characteristics.
    const knownBucks = deerProfiles.map((profile) => ({
      id: profile.id,
      name: profile.nickname,
      description: [profile.estimatedAge, profile.notes]
        .filter(Boolean)
        .join(" — "),
    }));

    // Store each image (resized, in IndexedDB) and read its EXIF capture time.
    // This must all happen now — the File objects are not kept once staged.
    const nextDrafts = await Promise.all(
      files.map(async (file) => {
        const [exifDate, storedImage] = await Promise.all([
          readPhotoDateTimeInput(file),
          storeImportImage(file),
        ]);
        // The AI read identifies the animal and which way it moved through the
        // frame — the inputs the per-buck travel learning trains on — so it runs
        // on every photo. EXIF still owns the date (below); the AI's own date
        // read is only a fallback for metadata-stripped files.
        const stamp = await requestPhotoStamp(
          file,
          units.temperature,
          knownBucks,
        );
        const matchedProfile = stamp?.matchedProfileId
          ? deerProfiles.find((profile) => profile.id === stamp.matchedProfileId)
          : undefined;
        const frameDirection = stamp?.travelDirectionInFrame ?? "";

        return createImportDraft({
          file,
          // The AI's identification pre-fills the species ("Other" when it
          // couldn't tell); the hunter can change it on the card before saving.
          species: stamp?.species || "Other",
          deerProfileId: matchedProfile?.id ?? "",
          buckName: matchedProfile?.nickname ?? "",
          behavior: stamp?.behavior ?? "",
          // The AI's frame-relative read only becomes a compass heading when
          // this camera site's facing direction is known; either way it stays
          // editable on the card.
          travelDirection: frameDirectionToHeading(
            frameDirection,
            activeCamera?.facingDirection ?? "",
          ),
          aiFrameDirection: frameDirection,
          exifDate,
          stampDate: stamp?.dateTime ?? "",
          stampedTemperature: stamp?.temperature ?? "",
          stampedMoonPhase: stamp?.moonPhase ?? "",
          stampedWindDirection: stamp?.windDirection ?? "",
          stampedWindSpeed: stamp?.windSpeed ?? "",
          stampedHumidity: stamp?.humidity ?? "",
          aiSpecies: stamp?.species ?? "",
          aiBehavior: stamp?.behavior ?? "",
          aiMatchLabel: matchedProfile
            ? `${matchedProfile.nickname}${stamp?.matchConfidence ? ` (${stamp.matchConfidence})` : ""}`
            : "",
          animalNotes: stamp?.animalNotes ?? "",
          imageId: storedImage?.imageId ?? "",
          imageWidth: storedImage?.width ?? 0,
          imageHeight: storedImage?.height ?? 0,
        });
      }),
    );

    setDrafts((currentDrafts) => [...currentDrafts, ...nextDrafts]);
    setMessage(
      `${files.length} ${files.length === 1 ? "photo" : "photos"} ready below — check them and press Save Photos.`,
    );
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

  // Create a deer profile straight from a reviewed photo, seeded with the AI's
  // read of the animal, and link this photo to it. Later imports pass the new
  // profile to the AI so this buck's future photos can be matched to him — the
  // reference a hunter needs to tell "same buck" apart.
  function createBuckFromDraft(draft: ImportDraft) {
    if (!propertyId) return;

    const defaultName =
      draft.buckName.trim() || `Buck ${deerProfiles.length + 1}`;
    const nickname = window.prompt("Name this buck", defaultName)?.trim();

    if (!nickname) return;

    // The AI's description (in notes) is the seed to match his later photos on;
    // never seed with the generic import placeholder.
    const seededNotes =
      draft.notes && draft.notes !== IMPORTED_NOTE ? draft.notes : "";
    const seenDate = draft.photoDate ? draft.photoDate.slice(0, 10) : "";
    const id = createDeerIntelId("deer");
    const profile = createDeerProfileFromValues({
      id,
      propertyId,
      values: {
        ...EMPTY_DEER_PROFILE_FORM_VALUES,
        nickname,
        firstSeen: seenDate,
        lastSeen: seenDate,
        notes: seededNotes,
      },
    });

    if (!profile) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      deerProfiles: [...currentState.deerProfiles, profile],
    }));

    // Link this photo to the new buck and mirror his name onto the card.
    setDrafts((currentDrafts) =>
      currentDrafts.map((item) =>
        item.id === draft.id
          ? { ...item, deerProfileId: id, buckName: nickname }
          : item,
      ),
    );
  }

  function removeSelectedDrafts() {
    // Also drop the stored image blobs so removed photos don't leak storage.
    for (const draft of drafts) {
      if (draft.selected && draft.imageId) {
        void deletePhotoImage(draft.imageId);
      }
    }

    setDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => !draft.selected),
    );
    setMessage("Selected photos removed from the inbox.");
  }

  async function createPhotoRecords() {
    if (!canCreateRecords || isSaving) {
      if (!canCreateRecords) {
        setMessage(
          "Choose a property and camera site, and make sure selected photos have a file name, date, and species.",
        );
      }
      return;
    }

    setIsSaving(true);
    setMessage("Looking up the weather each photo was taken in…");

    // When importing to a site with no check selected, create one dated to the
    // earliest photo — importing a batch of card photos is itself a card pull.
    const newCheck: CameraCheck | null = willCreateCheck
      ? createCameraCheckFromValues({
          id: createDeerIntelId("camera-check"),
          propertyId,
          cameraId,
          values: {
            ...EMPTY_CAMERA_CHECK_FORM_VALUES,
            date: deriveCheckDate(selectedDrafts),
            notes: "Created automatically from a Camera Import.",
          },
        })
      : null;
    const targetCheckId = newCheck ? newCheck.id : cameraCheckSelection;

    // The moon phase comes from the date alone (no network); temp/wind come from
    // Open-Meteo history for the property's location at each photo's hour.
    const property =
      state.properties.find((item) => item.id === propertyId) ?? null;
    const weatherPoint = resolvePropertyWeatherPoint(
      property,
      propertyCameras,
      state.pins.filter((pin) => pin.propertyId === propertyId),
    );

    let historyCount = 0;

    const newPhotoRecords: PhotoRecord[] = await Promise.all(
      selectedDrafts.map(async (draft) => {
        const weatherSnapshot = await buildPhotoWeatherSnapshot(
          draft.photoDate,
          weatherPoint,
          units,
          {
            temperature: draft.stampedTemperature,
            moonPhase: draft.stampedMoonPhase,
            windDirection: draft.stampedWindDirection,
            windSpeed: draft.stampedWindSpeed,
            humidity: draft.stampedHumidity,
          },
        );

        if (weatherSnapshot?.temperature || weatherSnapshot?.windDirection) {
          historyCount += 1;
        }

        return {
          id: createDeerIntelId("photo"),
          propertyId,
          cameraSiteId: cameraId,
          cameraCheckId: targetCheckId,
          fileName: draft.fileName.trim(),
          photoDate: draft.photoDate.trim(),
          species: draft.species.trim(),
          deerProfileId: draft.deerProfileId.trim() || undefined,
          buckName: draft.buckName.trim() || undefined,
          travelDirection: draft.travelDirection.trim() || undefined,
          behavior: draft.behavior.trim() || undefined,
          notes: buildImportNotes(draft),
          createdAt: new Date().toISOString(),
          imageId: draft.imageId || undefined,
          imageWidth:
            draft.imageId && draft.imageWidth > 0 ? draft.imageWidth : undefined,
          imageHeight:
            draft.imageId && draft.imageHeight > 0
              ? draft.imageHeight
              : undefined,
          weatherSnapshot,
        };
      }),
    );

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      cameraChecks: newCheck
        ? [...currentState.cameraChecks, newCheck]
        : currentState.cameraChecks,
      photoRecords: [...currentState.photoRecords, ...newPhotoRecords],
    }));
    setSelectedCameraCheckId(targetCheckId);
    setDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => !draft.selected),
    );

    const base = newCheck
      ? `${newPhotoRecords.length} ${newPhotoRecords.length === 1 ? "photo" : "photos"} saved (with a new camera check for ${newCheck.date}).`
      : `${newPhotoRecords.length} ${newPhotoRecords.length === 1 ? "photo" : "photos"} saved.`;
    const weatherNote = historyCount
      ? ` Temp, wind, and moon phase saved for ${historyCount} of them.`
      : " Moon phase saved (add a property/camera location for temp and wind).";

    setMessage(base + weatherNote);
    setSavedCameraId(cameraId);
    setIsSaving(false);
  }

  return (
    <PageShell>
      <Link href="/cameras" style={backLinkStyle}>
        Back to Cameras
      </Link>

      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          icon={<CameraIcon size={26} />}
          eyebrow="Camera Import"
          title="Import Photos"
          description="Pick your camera photos and Deer Intel fills in the rest — date, weather, wind, moon, and the animal it sees. Check the cards, fix anything, then press Save Photos."
          meta={<Badge>{drafts.length} ready to save</Badge>}
        />
      </Card>

      <Section eyebrow="Step 1" title="Where These Photos Belong">
        {state.properties.length === 0 ? (
          <EmptyState
            illustration={<CameraIcon size={30} />}
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
                {isCellularCamera ? (
                  <span style={readonlyFieldStyle}>
                    Not needed — cellular camera sends photos over service
                  </span>
                ) : (
                  <select
                    value={cameraCheckSelection}
                    onChange={(event) => setSelectedCameraCheckId(event.target.value)}
                    style={inputStyle}
                  >
                    <option value={NEW_CHECK_OPTION}>
                      New check (created on import)
                    </option>
                    {cameraChecks.map((check) => (
                      <option key={check.id} value={check.id}>
                        {check.date || "Camera check"}
                      </option>
                    ))}
                  </select>
                )}
              </label>

            </div>

            <p style={assignmentTextStyle}>
              Importing to {activePropertyName} / {activeCameraName} /{" "}
              {selectedCheckLabel}.
            </p>

            {propertyCameras.length === 0 ? (
              <EmptyState
                illustration={<CameraIcon size={30} />}
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

            {propertyCameras.length > 0 && willCreateCheck ? (
              <p style={assignmentTextStyle}>
                This camera site has no matching check selected, so importing
                will create a new camera check dated to your earliest photo. You
                can review or edit it later from the camera site.
              </p>
            ) : null}

            {activeCamera && !activeCamera.facingDirection ? (
              <div style={facingWarningStyle}>
                <span style={facingWarningTitleStyle}>
                  ⚠ {activeCamera.name} isn&apos;t pointed yet
                </span>
                <span>
                  Without a facing direction, the AI can see which way a deer
                  moves in the frame but can&apos;t turn it into a compass
                  heading — so travel direction stays blank on these photos.
                  Point it first, then import.
                </span>
                <Link href="/map" style={facingWarningLinkStyle}>
                  Point {activeCamera.name} on the map →
                </Link>
              </div>
            ) : null}
          </Card>
        )}
      </Section>

      <Section eyebrow="Step 2" title="Add Your Photos">
        <Card as="div" variant="subtle">
          <label style={uploadBoxStyle}>
            <span style={uploadTitleStyle}>Choose camera photos</span>
            <span style={mutedTextStyle}>
              Pick one or more photos. Deer Intel reads each one and fills in
              the date, weather, wind, moon, and the animal it sees for you —
              just check the cards below and press Save Photos.
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              style={fileInputStyle}
            />
          </label>
        </Card>
      </Section>

      <Section eyebrow="Step 3" title="Check Your Photos">
        {drafts.length === 0 ? (
          <EmptyState
            illustration={<CameraIcon size={30} />}
            title="No photos yet"
            description="Choose your camera photos above and they will show up here, filled in and ready to save."
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
                        {draft.stampedTemperature
                          ? ` / ${draft.stampedTemperature}° stamped`
                          : ""}
                        {draft.stampedMoonPhase
                          ? ` / ${draft.stampedMoonPhase} moon (stamped)`
                          : moonLabelForDate(draft.photoDate)
                            ? ` / ${moonLabelForDate(draft.photoDate)} moon`
                            : ""}
                      </span>
                    </span>
                  </label>
                  <div style={draftBadgeRowStyle}>
                    {draft.aiSpecies ? (
                      <Badge variant="success">
                        AI saw: {draft.aiSpecies}
                        {draft.aiBehavior ? ` — ${draft.aiBehavior}` : ""}
                        {draft.aiFrameDirection
                          ? `, ${draft.aiFrameDirection.toLowerCase()}`
                          : ""}
                        {draft.travelDirection
                          ? ` (headed ${draft.travelDirection})`
                          : ""}
                      </Badge>
                    ) : null}
                    {draft.aiMatchLabel ? (
                      <Badge variant="warning">
                        Looks like: {draft.aiMatchLabel}
                      </Badge>
                    ) : null}
                    <Badge>{draft.species || "Species needed"}</Badge>
                  </div>
                </div>

                {draft.imageId ? (
                  <div style={draftThumbStyle}>
                    <PhotoImage
                      imageId={draft.imageId}
                      alt={`Staged photo — ${draft.fileName}`}
                      aspectRatio={
                        draft.imageWidth && draft.imageHeight
                          ? draft.imageWidth / draft.imageHeight
                          : 4 / 3
                      }
                    />
                  </div>
                ) : null}

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
                    <span style={labelStyle}>Behavior</span>
                    <select
                      value={draft.behavior}
                      onChange={(event) =>
                        updateDraft(draft.id, "behavior", event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="">Not observed</option>
                      {BEHAVIOR_OPTIONS.map((behavior) => (
                        <option key={behavior} value={behavior}>
                          {behavior}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelStyle}>Headed (compass)</span>
                    <select
                      value={draft.travelDirection}
                      onChange={(event) =>
                        updateDraft(
                          draft.id,
                          "travelDirection",
                          event.target.value,
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="">Direction unknown</option>
                      {COMPASS_16.map((point) => (
                        <option key={point} value={point}>
                          {point}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={fieldStyle}>
                    <span style={labelStyle}>Deer Profile</span>
                    <select
                      aria-label="Deer profile"
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
                    {(draft.species === "Buck" || draft.aiSpecies === "Buck") &&
                    !draft.deerProfileId ? (
                      <button
                        type="button"
                        onClick={() => createBuckFromDraft(draft)}
                        style={newBuckButtonStyle}
                      >
                        + New buck from this photo
                      </button>
                    ) : null}
                  </div>

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

      <Section eyebrow="Step 4" title="Save">
        <Card as="div" variant="subtle">
          <div style={buttonRowStyle}>
            <Button
              type="button"
              disabled={!canCreateRecords || isSaving}
              onClick={createPhotoRecords}
            >
              {isSaving ? "Saving…" : "Save Photos"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedDrafts.length === 0 || isSaving}
              onClick={removeSelectedDrafts}
            >
              Remove Selected
            </Button>
          </div>

          {!canCreateRecords && drafts.length > 0 ? (
            <p style={hintStyle}>
              To save you still need {formatRequirementList(missingRequirements)}.
            </p>
          ) : null}

          {message ? <p style={messageStyle}>{message}</p> : null}

          {savedCameraId && !isSaving ? (
            <Link
              href={`/properties/${propertyId}/assets/${savedCameraId}`}
              style={{ ...primaryLinkStyle, marginTop: "0.75rem" }}
            >
              View Saved Photos
            </Link>
          ) : null}
        </Card>
      </Section>
    </PageShell>
  );
}

function moonLabelForDate(photoDate: string): string {
  if (!photoDate) return "";

  const parsed = new Date(photoDate);

  return Number.isNaN(parsed.getTime())
    ? ""
    : describeMoonPhase(parsed.getTime());
}

// Resize and persist one imported file's image so the saved Photo Record shows
// the actual picture. Returns null when the browser blocks storage — the record
// then saves as metadata-only instead of failing the whole import.
async function storeImportImage(
  file: File,
): Promise<{ imageId: string; width: number; height: number } | null> {
  try {
    const processed = await processImageFile(file);
    const imageId = createDeerIntelId("image");
    const stored = await putPhotoImage(imageId, processed.blob);

    if (!stored) return null;

    return { imageId, width: processed.width, height: processed.height };
  } catch {
    return null;
  }
}

function createImportDraft({
  file,
  species,
  deerProfileId,
  buckName,
  behavior,
  travelDirection,
  aiFrameDirection,
  exifDate,
  stampDate,
  stampedTemperature,
  stampedMoonPhase,
  stampedWindDirection,
  stampedWindSpeed,
  stampedHumidity,
  aiSpecies,
  aiBehavior,
  aiMatchLabel,
  animalNotes,
  imageId,
  imageWidth,
  imageHeight,
}: {
  file: File;
  species: string;
  deerProfileId: string;
  buckName: string;
  behavior: string;
  travelDirection: string;
  aiFrameDirection: string;
  exifDate: string;
  stampDate: string;
  stampedTemperature: string;
  stampedMoonPhase: string;
  stampedWindDirection: string;
  stampedWindSpeed: string;
  stampedHumidity: string;
  aiSpecies: string;
  aiBehavior: string;
  aiMatchLabel: string;
  animalNotes: string;
  imageId: string;
  imageWidth: number;
  imageHeight: number;
}): ImportDraft {
  const metadata = extractPhotoMetadata(file, exifDate, stampDate);

  return {
    id: createDeerIntelId("import-photo"),
    fileName: file.name,
    photoDate: metadata.photoDate,
    extractedTime: metadata.extractedTime,
    metadataSource: metadata.metadataSource,
    species,
    deerProfileId,
    buckName,
    behavior,
    travelDirection,
    // Seed the notes with what the AI saw so it lands on the record; the
    // hunter can edit or clear it on the draft card.
    notes: animalNotes || IMPORTED_NOTE,
    selected: true,
    stampedTemperature,
    stampedMoonPhase,
    stampedWindDirection,
    stampedWindSpeed,
    stampedHumidity,
    aiSpecies,
    aiBehavior,
    aiFrameDirection,
    aiMatchLabel,
    imageId,
    imageWidth,
    imageHeight,
  };
}

function extractPhotoMetadata(file: File, exifDate: string, stampDate: string) {
  // A trail cam writes the same local capture time into EXIF and onto the
  // printed stamp, so EXIF — read losslessly, no OCR guesswork — is the date
  // when present. The AI-read stamp is the fallback for metadata-stripped
  // files (screenshots, some app exports), where EXIF is gone.
  if (exifDate) {
    const parsed = new Date(exifDate);

    return {
      photoDate: exifDate,
      extractedTime: Number.isNaN(parsed.getTime()) ? "" : timeLabel(parsed),
      metadataSource: "Date read from photo (EXIF)",
    };
  }

  if (stampDate) {
    const parsed = new Date(
      stampDate.length <= 10 ? `${stampDate}T12:00` : stampDate,
    );

    return {
      photoDate: stampDate.length <= 10 ? `${stampDate}T12:00` : stampDate,
      extractedTime: Number.isNaN(parsed.getTime()) ? "" : timeLabel(parsed),
      metadataSource: "Date read from photo stamp",
    };
  }

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

function deriveCheckDate(drafts: ImportDraft[]): string {
  // Photo dates are datetime-local values (YYYY-MM-DDThh:mm); the check stores a
  // plain date. Use the earliest photo's date, falling back to today.
  const dates = drafts
    .map((draft) => draft.photoDate.trim().slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  if (dates.length > 0) return dates[0];

  const today = new Date();

  return `${today.getFullYear()}-${padNumber(today.getMonth() + 1)}-${padNumber(
    today.getDate(),
  )}`;
}

function formatRequirementList(requirements: string[]) {
  if (requirements.length === 0) return "";
  if (requirements.length === 1) return requirements[0];
  if (requirements.length === 2) return `${requirements[0]} and ${requirements[1]}`;

  return `${requirements.slice(0, -1).join(", ")}, and ${
    requirements[requirements.length - 1]
  }`;
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

const readonlyFieldStyle: CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  color: "var(--text-muted)",
  fontWeight: 700,
};

const assignmentTextStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const facingWarningStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  margin: "1rem 0 0",
  padding: "0.85rem 1rem",
  border: "1px solid var(--accent-2)",
  borderLeft: "4px solid var(--accent-2)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  lineHeight: 1.5,
};

const facingWarningTitleStyle: CSSProperties = {
  fontWeight: 800,
};

const facingWarningLinkStyle: CSSProperties = {
  justifySelf: "start",
  color: "var(--accent)",
  fontWeight: 800,
  textDecoration: "underline",
};

const newBuckButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "40px",
  padding: "0.45rem 0.7rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--accent)",
  fontSize: "0.85rem",
  fontWeight: 800,
  cursor: "pointer",
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

const hintStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--text-muted)",
  fontWeight: 700,
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

const draftThumbStyle: CSSProperties = {
  maxWidth: "260px",
  marginTop: "0.75rem",
};

const draftBadgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  flexWrap: "wrap",
};

const draftFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
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
