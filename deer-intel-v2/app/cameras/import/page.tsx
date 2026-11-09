"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
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
import { daysSince } from "@/lib/cameraHealth";
import { latestCheckForCamera, sortCameraChecksChronologically } from "@/lib/cameraChecks";
import {
  EMPTY_DEER_PROFILE_FORM_VALUES,
  createDeerProfileFromValues,
} from "@/lib/deerProfileFormValues";
import DeerProfileMultiSelect from "@/components/photos/DeerProfileMultiSelect";
import PhotoAiPrivacyNote from "@/components/photos/PhotoAiPrivacyNote";
import PhotoDateTimeFields from "@/components/photos/PhotoDateTimeFields";
import PhotoDetailChips, {
  type PhotoDetailValues,
} from "@/components/photos/PhotoDetailChips";
import PhotoImage from "@/components/photos/PhotoImage";
import SpeciesSelect from "@/components/photos/SpeciesSelect";
import { resolveBuckLinks } from "@/lib/photoFormValues";
import { processImageFile } from "@/lib/imageProcessing";
import { deletePhotoImage, putPhotoImage } from "@/lib/imageStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { describeMoonPhase } from "@/lib/moonPhase";
import { dateInputTime } from "@/lib/photos";
import { buildPhotoWeatherSnapshot } from "@/lib/photoWeather";
import {
  importDuplicateKey,
  importedPhotoKeys,
  isAlreadyImported,
} from "@/lib/photoImportDuplicates";
import { resolveImportCaptureTime, toDateInputValue } from "@/lib/photoDateTime";
import {
  BEHAVIOR_OPTIONS,
  NO_ANIMAL,
  buckOnlyFields,
  deerCountFor,
} from "@/lib/photoOptions";
import { readPhotoDateTimeInput } from "@/lib/photoExif";
import { requestPhotoStamp } from "@/lib/photoStampClient";
import { COMPASS_16, frameDirectionToHeading } from "@/lib/travelDirection";
import { useUnitPreferences } from "@/lib/units";
import type { CameraCheck } from "@/types/cameraCheck";
import type {
  PhotoAgeClass,
  PhotoCaptureTimeSource,
  PhotoRecord,
} from "@/types/photo";

// Sentinel for the Camera Check dropdown: create a fresh check on import
// instead of attaching photos to an existing one.
const NEW_CHECK_OPTION = "new-check";

// A check logged this recently is taken to be this card pull, so the import
// attaches to it by default instead of creating a second check.
const RECENT_CHECK_DAYS = 1;

// Default note seeded when the AI reported no animal notes; used to tell a real
// AI description (worth seeding a buck profile with) from the placeholder.
const IMPORTED_NOTE = "Imported through Camera Import Inbox.";

type ImportDraft = {
  id: string;
  fileName: string;
  // The file's own name and first-read capture date, kept when the label or
  // date are edited: together they are how a repeat import is recognized.
  originalFileName: string;
  originalPhotoDate: string;
  // The same photo was already staged in this inbox when this one was picked.
  inboxDuplicate: boolean;
  // "YYYY-MM-DDTHH:mm" when a real time was read, else "YYYY-MM-DD".
  photoDate: string;
  // Where photoDate came from; "" when nothing was found.
  captureTimeSource: PhotoCaptureTimeSource | "";
  // The file's modified clock time, offered (never applied) as a one-tap fill.
  fileTimeHint: string;
  // Stamp and EXIF disagree, or one had an impossible date.
  clockWarning: boolean;
  // "" until the AI or the hunter picks one — never a silent "Other".
  species: string;
  // A photo can show more than one buck: linked deer profile ids plus loose
  // buck names (typed in without a saved profile).
  deerProfileIds: string[];
  buckNames: string[];
  behavior: string;
  // The AI's raw frame read ("Left to right", ...), "" when none.
  frameDirection: string;
  // The hunter's own heading pick; null = use the AI read turned through the
  // currently selected camera's facing (so switching cameras recomputes it).
  travelDirectionOverride: string | null;
  deerCount?: number;
  ageClass: PhotoAgeClass | "";
  antlerPoints?: number;
  notes: string;
  selected: boolean;
  // Values read off the photo's printed info bar, "" when nothing was read.
  // (The stamped moon is not used — the date-based phase is exact.)
  stampedTemperature: string;
  stampedWindDirection: string;
  stampedWindSpeed: string;
  stampedHumidity: string;
  // What the AI identified in the frame ("" when nothing / not configured).
  // Kept separate from `species` so the badge still shows the AI's call after
  // the hunter adjusts the dropdown.
  aiSpecies: string;
  aiBehavior: string;
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
  // The hunter picks the camera: photos filed to the wrong site corrupt that
  // site's pattern. Only a property with a single camera is preselected.
  const cameraId =
    selectedCameraId && propertyCameras.some((camera) => camera.id === selectedCameraId)
      ? selectedCameraId
      : propertyCameras.length === 1
        ? propertyCameras[0].id
        : "";
  const activeCamera = propertyCameras.find((camera) => camera.id === cameraId);
  const activeFacing = activeCamera?.facingDirection ?? "";
  // Cellular cameras transmit photos over service, so there is no card-pull
  // check — those imports attach directly to the camera site.
  const isCellularCamera = activeCamera?.cameraType === "Cellular";
  // Newest first, so the most likely check is at the top of the list.
  const cameraChecks = sortCameraChecksChronologically(
    state.cameraChecks.filter(
      (check) => check.propertyId === propertyId && check.cameraId === cameraId,
    ),
  ).reverse();
  const newestCheck = latestCheckForCamera(cameraChecks, cameraId);
  const newestCheckAge = newestCheck ? daysSince(newestCheck.date, new Date()) : null;
  const [selectedCameraCheckId, setSelectedCameraCheckId] = useState("");
  // For standard cameras the effective selection is either an existing check id
  // or the sentinel NEW_CHECK_OPTION (a check dated today is created on
  // import). By default a check logged today or yesterday is this card pull;
  // anything older gets a new check — never the camera's oldest check.
  const standardCheckSelection =
    selectedCameraCheckId === NEW_CHECK_OPTION ||
    (selectedCameraCheckId &&
      cameraChecks.some((check) => check.id === selectedCameraCheckId))
      ? selectedCameraCheckId
      : newestCheck && newestCheckAge !== null && newestCheckAge <= RECENT_CHECK_DAYS
        ? newestCheck.id
        : NEW_CHECK_OPTION;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const units = useUnitPreferences();
  const selectedDrafts = drafts.filter((draft) => draft.selected);
  // Photos already saved on this camera site, to flag a batch picked twice.
  const importedKeys = useMemo(
    () => importedPhotoKeys(state.photoRecords, cameraId),
    [state.photoRecords, cameraId],
  );
  const draftAlreadyImported = (draft: ImportDraft) =>
    isAlreadyImported(
      { fileName: draft.originalFileName, photoDate: draft.originalPhotoDate },
      cameraId,
      importedKeys,
    );
  // The heading saved for a draft: the hunter's pick, else the AI frame read
  // through the selected camera's facing ("" when the camera isn't pointed).
  const draftHeading = (draft: ImportDraft) =>
    draft.travelDirectionOverride ??
    frameDirectionToHeading(draft.frameDirection, activeFacing);
  const missingSpeciesCount = selectedDrafts.filter((draft) => !draft.species.trim()).length;
  const missingRequirements: string[] = [];
  if (!propertyId) missingRequirements.push("a property");
  if (!cameraId) missingRequirements.push("a camera site");
  if (selectedDrafts.length === 0) {
    missingRequirements.push("at least one selected photo");
  } else {
    if (missingSpeciesCount > 0) {
      missingRequirements.push(
        `a species on ${missingSpeciesCount} ${missingSpeciesCount === 1 ? "photo" : "photos"} (pick "No animal" for an empty frame)`,
      );
    }
    if (!selectedDrafts.every((draft) => draft.fileName.trim() && draft.photoDate.trim())) {
      missingRequirements.push("a file name and date on every selected photo");
    }
  }
  const canCreateRecords = missingRequirements.length === 0;
  const activePropertyName =
    state.properties.find((property) => property.id === propertyId)?.name ??
    "No property selected";
  const activeCameraName = activeCamera?.name ?? "No camera site selected";
  const selectedCheckLabel = useMemo(() => {
    if (isCellularCamera) return "Sent over service (no check)";

    if (cameraCheckSelection === NEW_CHECK_OPTION) {
      return "New check dated today";
    }

    const check = cameraChecks.find((item) => item.id === cameraCheckSelection);

    return check?.date ? `check of ${check.date}` : "New check dated today";
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
        // frame, and its printed-stamp read is the capture time (checked
        // against EXIF in resolveImportCaptureTime). So it runs on every photo.
        const stamp = await requestPhotoStamp(
          file,
          units.temperature,
          knownBucks,
        );
        const matchedProfile = stamp?.matchedProfileId
          ? deerProfiles.find((profile) => profile.id === stamp.matchedProfileId)
          : undefined;
        // The AI's call pre-fills the species; when it couldn't tell (or AI
        // reading is off) the species stays blank for the hunter to pick.
        const species = stamp?.species ?? "";
        const time = resolveImportCaptureTime({
          fileName: file.name,
          lastModified: file.lastModified,
          exifDate,
          stampDate: stamp?.dateTime ?? "",
        });

        return {
          id: createDeerIntelId("import-photo"),
          fileName: file.name,
          originalFileName: file.name,
          originalPhotoDate: time.photoDate,
          inboxDuplicate: false,
          photoDate: time.photoDate,
          captureTimeSource: time.captureTimeSource,
          fileTimeHint: time.fileTimeHint,
          clockWarning: time.clockWarning,
          species,
          deerProfileIds: matchedProfile ? [matchedProfile.id] : [],
          buckNames: [],
          behavior: stamp?.behavior ?? "",
          frameDirection: stamp?.travelDirectionInFrame ?? "",
          travelDirectionOverride: null,
          deerCount: deerCountFor(species, stamp?.deerCount),
          ageClass: species === "Buck" ? (stamp?.ageClass ?? "") : "",
          antlerPoints:
            species === "Buck" && stamp?.antlerPoints ? stamp.antlerPoints : undefined,
          // Seed the notes with what the AI saw so it lands on the record; the
          // hunter can edit or clear it on the draft card.
          notes: stamp?.animalNotes || IMPORTED_NOTE,
          selected: true,
          stampedTemperature: stamp?.temperature ?? "",
          stampedWindDirection: stamp?.windDirection ?? "",
          stampedWindSpeed: stamp?.windSpeed ?? "",
          stampedHumidity: stamp?.humidity ?? "",
          aiSpecies: species,
          aiBehavior: stamp?.behavior ?? "",
          aiMatchLabel: matchedProfile
            ? `${matchedProfile.nickname}${stamp?.matchConfidence ? ` (${stamp.matchConfidence})` : ""}`
            : "",
          imageId: storedImage?.imageId ?? "",
          imageWidth: storedImage?.width ?? 0,
          imageHeight: storedImage?.height ?? 0,
        } satisfies ImportDraft;
      }),
    );

    // A photo already saved on this camera, or already staged here, is left
    // unselected with a note, so picking the same batch twice can't double it.
    const stagedKeys = new Set(
      drafts.map((draft) =>
        importDuplicateKey("inbox", draft.originalFileName, draft.originalPhotoDate),
      ),
    );
    let repeatCount = 0;
    const flaggedDrafts = nextDrafts.map((draft) => {
      const inboxKey = importDuplicateKey("inbox", draft.originalFileName, draft.originalPhotoDate);
      const inboxDuplicate = Boolean(inboxKey) && stagedKeys.has(inboxKey);
      if (inboxKey) stagedKeys.add(inboxKey);
      const repeat = inboxDuplicate || draftAlreadyImported(draft);
      if (repeat) repeatCount += 1;

      return repeat ? { ...draft, inboxDuplicate, selected: false } : draft;
    });
    const needSpecies = flaggedDrafts.filter((draft) => !draft.species).length;

    setDrafts((currentDrafts) => [...currentDrafts, ...flaggedDrafts]);
    setMessage(
      `${files.length} ${files.length === 1 ? "photo" : "photos"} ready below — check them and press Save Photos.` +
        (needSpecies > 0
          ? ` ${needSpecies} ${needSpecies === 1 ? "needs" : "need"} a species picked.`
          : "") +
        (repeatCount > 0
          ? ` ${repeatCount} already imported (or already staged) — left unselected.`
          : ""),
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

  function patchDraft(draftId: string, patch: Partial<ImportDraft>) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  // Create a deer profile straight from a reviewed photo, seeded with the AI's
  // read of the animal, and link this photo to it. Later imports pass the new
  // profile to the AI so this buck's future photos can be matched to him — the
  // reference a hunter needs to tell "same buck" apart.
  function createBuckFromDraft(draft: ImportDraft) {
    if (!propertyId) return;

    const linkedNickname = deerProfiles.find((profile) =>
      draft.deerProfileIds.includes(profile.id),
    )?.nickname;
    const defaultName =
      draft.buckNames[0] || linkedNickname || `Buck ${deerProfiles.length + 1}`;
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
        // The age class judged on this photo seeds the profile's estimate.
        estimatedAge: draft.ageClass,
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

    // Add the new buck to whatever this photo was already tagged with.
    setDrafts((currentDrafts) =>
      currentDrafts.map((item) =>
        item.id === draft.id
          ? {
              ...item,
              deerProfileIds: [...new Set([...item.deerProfileIds, id])],
            }
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
          `Before saving, add ${formatRequirementList(missingRequirements)}.`,
        );
      }
      return;
    }

    setIsSaving(true);
    setMessage("Looking up the weather each photo was taken in…");

    // Importing a batch of card photos is itself a card pull, so a new check
    // is dated today — the day the card was pulled, not the oldest photo.
    const newCheck: CameraCheck | null = willCreateCheck
      ? createCameraCheckFromValues({
          id: createDeerIntelId("camera-check"),
          propertyId,
          cameraId,
          values: {
            ...EMPTY_CAMERA_CHECK_FORM_VALUES,
            date: toDateInputValue(new Date()),
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
            windDirection: draft.stampedWindDirection,
            windSpeed: draft.stampedWindSpeed,
            humidity: draft.stampedHumidity,
          },
        );

        if (weatherSnapshot?.temperature || weatherSnapshot?.windDirection) {
          historyCount += 1;
        }

        const { deerProfileIds, buckNames } = resolveBuckLinks(
          {
            deerProfileIds: draft.deerProfileIds,
            buckNames: draft.buckNames,
          },
          deerProfiles,
        );
        const species = draft.species.trim();
        const emptyFrame = species === NO_ANIMAL;

        return {
          id: createDeerIntelId("photo"),
          propertyId,
          cameraSiteId: cameraId,
          cameraCheckId: targetCheckId,
          fileName: draft.fileName.trim(),
          photoDate: draft.photoDate.trim(),
          captureTimeSource: draft.captureTimeSource || undefined,
          species,
          // Singular fields stay populated with the primary (first) link for
          // backward-compatible reads; the plural fields carry the full set.
          deerProfileId: deerProfileIds[0],
          buckName: buckNames[0],
          deerProfileIds: deerProfileIds.length > 0 ? deerProfileIds : undefined,
          buckNames: buckNames.length > 0 ? buckNames : undefined,
          travelDirection: emptyFrame ? undefined : draftHeading(draft).trim() || undefined,
          frameDirection: emptyFrame ? undefined : draft.frameDirection || undefined,
          behavior: emptyFrame ? undefined : draft.behavior.trim() || undefined,
          deerCount: deerCountFor(species, draft.deerCount),
          ...buckOnlyFields(species, draft.ageClass, draft.antlerPoints),
          notes: draft.notes.trim(),
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
              <Link href="/properties" style={primaryLinkStyle} className="di-navbtn">
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
                  aria-invalid={!cameraId}
                  style={{ ...inputStyle, ...(cameraId ? null : needsChoiceStyle) }}
                >
                  {propertyCameras.length === 0 ? (
                    <option value="">No camera sites yet</option>
                  ) : !cameraId ? (
                    <option value="">Choose the camera these came from…</option>
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
                    disabled={!cameraId}
                    style={inputStyle}
                  >
                    <option value={NEW_CHECK_OPTION}>
                      New check dated today
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
              Importing to {activePropertyName} / {activeCameraName}
              {cameraId ? ` / ${selectedCheckLabel}` : ""}.
            </p>

            {propertyCameras.length === 0 ? (
              <EmptyState
                illustration={<CameraIcon size={30} />}
                title="No camera sites for this property"
                description="Add a camera site before importing photos."
                action={
                  <Link
                    href={propertyId ? "/cameras#add-camera" : "/properties"}
                    style={primaryLinkStyle}
                    className="di-navbtn"
                  >
                    Add Camera Site
                  </Link>
                }
              />
            ) : null}

            {cameraId && willCreateCheck ? (
              <p style={assignmentTextStyle}>
                Saving will log a new camera check for {activeCameraName} dated
                today (this card pull). Pick an earlier check above if these
                photos belong to one.
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
          {/* The whole tile is the tap target so it's obvious where to press. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={hiddenInputStyle}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={uploadButtonStyle}
          >
            <span style={uploadIconStyle} aria-hidden="true">
              +
            </span>
            <span style={uploadTitleStyle}>Choose camera photos</span>
            <span style={uploadHintStyle}>
              Pick one or more photos. Deer Intel reads each one and fills in
              the date, weather, wind, moon, and the animal it sees for you —
              just check the cards below and press Save Photos.
            </span>
          </button>
          <PhotoAiPrivacyNote style={{ marginTop: "0.75rem" }} />
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
            {drafts.map((draft) => {
              const heading = draftHeading(draft);
              const moon = moonLabelForDate(draft.photoDate);

              return (
              <Card key={draft.id} as="article" variant="subtle">
                <div style={draftHeaderStyle}>
                  <label style={checkFieldStyle}>
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        updateDraft(draft.id, "selected", event.target.checked)
                      }
                      style={checkboxStyle}
                    />
                    <span>
                      <span style={draftTitleStyle}>{draft.fileName}</span>
                      <span style={draftMetaStyle}>
                        {[
                          draft.stampedTemperature
                            ? `${draft.stampedTemperature}° stamped`
                            : "",
                          moon ? `${moon} moon` : "",
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                  </label>
                  <div style={draftBadgeRowStyle}>
                    {draftAlreadyImported(draft) ? (
                      <Badge variant="warning">Already imported</Badge>
                    ) : draft.inboxDuplicate ? (
                      <Badge variant="warning">Already in the inbox</Badge>
                    ) : null}
                    {draft.aiSpecies ? (
                      <Badge variant="success">
                        AI saw: {draft.aiSpecies}
                        {draft.aiBehavior ? ` — ${draft.aiBehavior}` : ""}
                        {draft.frameDirection
                          ? `, ${draft.frameDirection.toLowerCase()}`
                          : ""}
                        {heading ? ` (headed ${heading})` : ""}
                      </Badge>
                    ) : null}
                    {draft.aiMatchLabel ? (
                      <Badge variant="warning">
                        Looks like: {draft.aiMatchLabel}
                      </Badge>
                    ) : null}
                    {draft.species ? null : (
                      <Badge variant="warning">Pick species</Badge>
                    )}
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
                    <span style={labelStyle}>Species</span>
                    <SpeciesSelect
                      value={draft.species}
                      onChange={(species) => updateDraft(draft.id, "species", species)}
                      style={inputStyle}
                    />
                  </label>

                  <div style={wideFieldStyle}>
                    <PhotoDateTimeFields
                      idPrefix={`import-${draft.id}`}
                      value={draft.photoDate}
                      source={draft.captureTimeSource}
                      fileTimeHint={draft.fileTimeHint}
                      clockWarning={draft.clockWarning}
                      onChange={(photoDate, captureTimeSource) =>
                        patchDraft(draft.id, { photoDate, captureTimeSource })
                      }
                    />
                  </div>

                  {draft.species === NO_ANIMAL ? null : (
                    <>
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
                          value={heading}
                          onChange={(event) =>
                            updateDraft(
                              draft.id,
                              "travelDirectionOverride",
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
                    </>
                  )}
                </div>

                <div style={chipWrapStyle}>
                  <PhotoDetailChips
                    idPrefix={`import-${draft.id}`}
                    species={draft.species}
                    deerCount={draft.deerCount}
                    ageClass={draft.ageClass}
                    antlerPoints={draft.antlerPoints}
                    onChange={(patch: PhotoDetailValues) => patchDraft(draft.id, patch)}
                  />
                </div>

                {draft.species === NO_ANIMAL ? null : (
                <div style={buckLinkWrapStyle}>
                  <DeerProfileMultiSelect
                    deerProfiles={deerProfiles}
                    selectedProfileIds={draft.deerProfileIds}
                    buckNames={draft.buckNames}
                    idPrefix={`import-${draft.id}`}
                    onChange={(deerProfileIds, buckNames) =>
                      patchDraft(draft.id, { deerProfileIds, buckNames })
                    }
                  />
                  {(draft.species === "Buck" || draft.aiSpecies === "Buck") &&
                  draft.deerProfileIds.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => createBuckFromDraft(draft)}
                      style={newBuckButtonStyle}
                    >
                      + New buck from this photo
                    </button>
                  ) : null}
                </div>
                )}

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
              );
            })}
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
              className="di-navbtn"
            >
              View Saved Photos
            </Link>
          ) : null}
        </Card>
      </Section>
    </PageShell>
  );
}

// The moon phase computed from the date (never the camera's stamped icon).
function moonLabelForDate(photoDate: string): string {
  if (!photoDate) return "";

  // Local midnight for a bare "YYYY-MM-DD" (new Date() would read it as UTC).
  const time = dateInputTime(photoDate);

  return Number.isNaN(time) ? "" : describeMoonPhase(time);
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

function formatRequirementList(requirements: string[]) {
  if (requirements.length === 0) return "";
  if (requirements.length === 1) return requirements[0];
  if (requirements.length === 2) return `${requirements[0]} and ${requirements[1]}`;

  return `${requirements.slice(0, -1).join(", ")}, and ${
    requirements[requirements.length - 1]
  }`;
}

const needsChoiceStyle: CSSProperties = {
  borderColor: "var(--warning-border)",
  boxShadow: "inset 3px 0 0 var(--warning-text)",
};

const wideFieldStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const chipWrapStyle: CSSProperties = {
  marginTop: "0.75rem",
};

const checkboxStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  marginTop: "0.1rem",
  flexShrink: 0,
};

// The PageHeader now carries the golden-hour band itself (di-section-hero), so
// this wrapper card just passes through without its own surface/padding.
const heroCardStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
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
  borderRadius: "var(--radius-sm)",
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
  border: "1px solid var(--warning-border)",
  borderLeft: "4px solid var(--warning-text)",
  borderRadius: "var(--radius-sm)",
  background: "var(--warning-bg)",
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
  minHeight: "44px",
  padding: "0.45rem 0.7rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--accent)",
  fontSize: "0.85rem",
  fontWeight: 800,
  cursor: "pointer",
};

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const uploadButtonStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.5rem",
  width: "100%",
  padding: "2rem 1.4rem",
  border: "2px dashed var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  textAlign: "center",
  cursor: "pointer",
};

const uploadIconStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  borderRadius: "999px",
  background: "var(--accent)",
  color: "white",
  fontSize: "1.8rem",
  fontWeight: 800,
  lineHeight: 1,
};

const uploadTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1.15rem",
  fontWeight: 850,
};

const uploadHintStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
  maxWidth: "34rem",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const buckLinkWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
