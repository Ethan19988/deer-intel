"use client";

import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import PhotoImage from "@/components/photos/PhotoImage";
import Button from "@/components/ui/Button";
import { createDeerIntelId } from "@/lib/deerIntelStore";
import { isImageFile, processImageFile } from "@/lib/imageProcessing";
import { deletePhotoImage, putPhotoImage } from "@/lib/imageStore";
import { readPhotoDateTimeInput } from "@/lib/photoExif";
import { requestPhotoStamp } from "@/lib/photoStampClient";
import { useUnitPreferences } from "@/lib/units";
import type { KnownBuckSummary, PhotoStamp } from "@/types/photoStamp";

export type SelectedPhotoImage = {
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  fileName: string;
  lastModified: number;
  // Capture time from EXIF when the file has it, otherwise from the printed
  // stamp (read by AI only for metadata-stripped files), or "" if neither.
  capturedAt: string;
  // Values read off the photo's printed info bar, or "" if none.
  stampedTemperature: string;
  stampedMoonPhase: string;
  stampedWindDirection: string;
  stampedWindSpeed: string;
  stampedHumidity: string;
  // Animal the AI identified in the frame, or "" if none / not configured.
  detectedSpecies: string;
  detectedBehavior: string;
  // Frame-relative movement ("Left to right", ...), or "" if none. The form
  // converts it to a compass heading using the camera's facing direction.
  detectedFrameDirection: string;
  detectedNotes: string;
  // Saved deer profile the AI matched the buck to, or "" if no match.
  matchedProfileId: string;
  matchConfidence: string;
};

type PhotoUploadFieldProps = {
  imageId: string;
  // Saved deer profiles the AI compares a photographed buck against.
  knownBucks?: KnownBuckSummary[];
  onImageSelected: (image: SelectedPhotoImage) => void;
  onImageCleared: () => void;
};

export default function PhotoUploadField({
  imageId,
  knownBucks = [],
  onImageSelected,
  onImageCleared,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  // Where the auto-filled time came from, so a cellular camera's batch/arrival
  // time can't quietly stand in for the real capture time.
  const [captureNote, setCaptureNote] = useState<{
    tone: "info" | "warn";
    text: string;
  } | null>(null);
  const units = useUnitPreferences();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file after removing it.
    event.target.value = "";

    if (!file) return;

    if (!isImageFile(file)) {
      setError("That file is not an image. Choose a JPG, PNG, or HEIC photo.");
      return;
    }

    setError("");
    setCaptureNote(null);
    setIsProcessing(true);
    setStatusText("Processing photo…");

    try {
      // Read EXIF from the original file before it is resized — the canvas
      // re-encode in processImageFile strips metadata.
      const [processed, exifDate] = await Promise.all([
        processImageFile(file),
        readPhotoDateTimeInput(file),
      ]);
      const newImageId = createDeerIntelId("image");
      const stored = await putPhotoImage(newImageId, processed.blob);

      if (!stored) {
        throw new Error("This browser blocked saving the photo.");
      }

      if (imageId && imageId !== newImageId) {
        await deletePhotoImage(imageId);
      }

      // The AI read identifies the animal and its travel direction (what the
      // per-buck learning trains on), so it runs on every photo. EXIF still
      // owns the capture time below; the AI's date read is only the fallback
      // for metadata-stripped files.
      setStatusText("Reading photo info…");
      const stamp: PhotoStamp | null = await requestPhotoStamp(
        file,
        units.temperature,
        knownBucks,
      );

      // The shutter time comes only from the photo itself: EXIF first, then the
      // date/time the camera printed on the info bar. The file's lastModified is
      // deliberately NOT a source here — for a cellular camera that transmits in
      // batches, that timestamp is when the batch arrived, not when the shot was
      // taken.
      const capturedAt = exifDate || stamp?.dateTime || "";

      setCaptureNote(
        exifDate
          ? {
              tone: "info",
              text: "Capture time read from the photo (EXIF) — the moment the shot was taken, not when your camera sent the batch.",
            }
          : stamp?.dateTime
            ? {
                tone: "info",
                text: "Capture time read from the photo's printed info bar.",
              }
            : {
                tone: "warn",
                text: "No capture time is embedded in this photo, so the date wasn't auto-filled. Set the Photo Date and Time to when the shot was actually taken — a cellular camera's file date is when the batch came through, not the capture time.",
              },
      );

      onImageSelected({
        imageId: newImageId,
        imageWidth: processed.width,
        imageHeight: processed.height,
        fileName: file.name,
        lastModified: file.lastModified,
        capturedAt,
        stampedTemperature: stamp?.temperature ?? "",
        stampedMoonPhase: stamp?.moonPhase ?? "",
        stampedWindDirection: stamp?.windDirection ?? "",
        stampedWindSpeed: stamp?.windSpeed ?? "",
        stampedHumidity: stamp?.humidity ?? "",
        detectedSpecies: stamp?.species ?? "",
        detectedBehavior: stamp?.behavior ?? "",
        detectedFrameDirection: stamp?.travelDirectionInFrame ?? "",
        detectedNotes: stamp?.animalNotes ?? "",
        matchedProfileId: stamp?.matchedProfileId ?? "",
        matchConfidence: stamp?.matchConfidence ?? "",
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not process that photo.",
      );
    } finally {
      setIsProcessing(false);
      setStatusText("");
    }
  }

  async function handleRemove() {
    if (imageId) {
      await deletePhotoImage(imageId);
    }

    setError("");
    setCaptureNote(null);
    onImageCleared();
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <div style={containerStyle}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={hiddenInputStyle}
      />

      {imageId ? (
        <div style={previewWrapStyle}>
          <PhotoImage
            imageId={imageId}
            alt="Selected trail camera photo"
            aspectRatio={4 / 3}
          />
          <div style={previewActionsStyle}>
            <Button
              type="button"
              variant="secondary"
              onClick={openFilePicker}
              disabled={isProcessing}
            >
              {isProcessing ? "Working…" : "Replace Photo"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRemove}
              disabled={isProcessing}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isProcessing}
          style={dropZoneStyle}
        >
          <span style={dropTitleStyle}>
            {isProcessing ? statusText || "Processing photo…" : "Upload a photo"}
          </span>
          <span style={dropHintStyle}>
            Tap to choose from your library or take a photo. The date is read
            from the photo automatically; the weather, wind, and moon fill in,
            and the animal is identified for you to confirm.
          </span>
        </button>
      )}

      {error ? <p style={errorStyle}>{error}</p> : null}

      {!error && captureNote ? (
        <p
          style={captureNote.tone === "warn" ? captureWarnStyle : captureInfoStyle}
        >
          {captureNote.text}
        </p>
      ) : null}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const previewWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const previewActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.6rem",
};

const dropZoneStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  width: "100%",
  padding: "1.4rem",
  border: "1px dashed var(--accent)",
  borderRadius: "10px",
  background: "var(--surface-2)",
  color: "var(--text)",
  textAlign: "center",
  cursor: "pointer",
};

const dropTitleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 800,
};

const dropHintStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  fontSize: "0.85rem",
};

const captureInfoStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const captureWarnStyle: CSSProperties = {
  margin: 0,
  padding: "0.6rem 0.75rem",
  border: "1px solid var(--warning-border)",
  borderLeft: "4px solid var(--warning-text)",
  borderRadius: "8px",
  background: "var(--warning-bg)",
  color: "var(--text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};
