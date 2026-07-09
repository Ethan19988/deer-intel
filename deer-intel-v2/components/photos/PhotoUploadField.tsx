"use client";

import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import PhotoImage from "@/components/photos/PhotoImage";
import Button from "@/components/ui/Button";
import { createDeerIntelId } from "@/lib/deerIntelStore";
import { isImageFile, processImageFile } from "@/lib/imageProcessing";
import { deletePhotoImage, putPhotoImage } from "@/lib/imageStore";

export type SelectedPhotoImage = {
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  fileName: string;
  lastModified: number;
};

type PhotoUploadFieldProps = {
  imageId: string;
  onImageSelected: (image: SelectedPhotoImage) => void;
  onImageCleared: () => void;
};

export default function PhotoUploadField({
  imageId,
  onImageSelected,
  onImageCleared,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

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
    setIsProcessing(true);

    try {
      const processed = await processImageFile(file);
      const newImageId = createDeerIntelId("image");
      const stored = await putPhotoImage(newImageId, processed.blob);

      if (!stored) {
        throw new Error("This browser blocked saving the photo.");
      }

      if (imageId && imageId !== newImageId) {
        await deletePhotoImage(imageId);
      }

      onImageSelected({
        imageId: newImageId,
        imageWidth: processed.width,
        imageHeight: processed.height,
        fileName: file.name,
        lastModified: file.lastModified,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not process that photo.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRemove() {
    if (imageId) {
      await deletePhotoImage(imageId);
    }

    setError("");
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
            {isProcessing ? "Processing photo…" : "Upload a photo"}
          </span>
          <span style={dropHintStyle}>
            Tap to choose from your library or take a photo. Large images are
            resized automatically.
          </span>
        </button>
      )}

      {error ? <p style={errorStyle}>{error}</p> : null}
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
