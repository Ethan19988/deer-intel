"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getPhotoImage } from "@/lib/imageStore";

type PhotoImageProps = {
  imageId: string;
  alt: string;
  aspectRatio?: number;
  style?: CSSProperties;
};

type LoadState = "loading" | "ready" | "missing";

type LoadResult = {
  imageId: string;
  url: string | null;
  state: LoadState;
};

export default function PhotoImage({
  imageId,
  alt,
  aspectRatio,
  style,
}: PhotoImageProps) {
  const [result, setResult] = useState<LoadResult>({
    imageId: "",
    url: null,
    state: "loading",
  });

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    getPhotoImage(imageId).then((blob) => {
      if (!active) return;

      if (!blob) {
        setResult({ imageId, url: null, state: "missing" });
        return;
      }

      createdUrl = URL.createObjectURL(blob);
      setResult({ imageId, url: createdUrl, state: "ready" });
    });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [imageId]);

  // Until the effect resolves for this imageId, treat it as still loading so a
  // stale result from a previous imageId never flashes.
  const current: LoadResult =
    result.imageId === imageId
      ? result
      : { imageId, url: null, state: "loading" };
  const { url: objectUrl, state: loadState } = current;

  const frameStyle: CSSProperties = {
    ...baseFrameStyle,
    ...(aspectRatio ? { aspectRatio: String(aspectRatio) } : null),
    ...style,
  };

  if (loadState === "missing") {
    return (
      <div style={frameStyle}>
        <span style={messageStyle}>Photo unavailable on this device</span>
      </div>
    );
  }

  if (loadState === "loading" || !objectUrl) {
    return (
      <div style={frameStyle}>
        <span style={messageStyle}>Loading photo…</span>
      </div>
    );
  }

  return (
    <div style={frameStyle}>
      {/* Blob object URLs are local; next/image cannot optimize them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={objectUrl} alt={alt} style={imageStyle} />
    </div>
  );
}

const baseFrameStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #243224",
  background: "#050705",
};

const imageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const messageStyle: CSSProperties = {
  padding: "1.5rem",
  color: "#7f8d7e",
  fontSize: "0.85rem",
  textAlign: "center",
};
