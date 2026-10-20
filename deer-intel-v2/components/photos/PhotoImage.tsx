"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getDisplayPhotoUrl } from "@/lib/photoCrop";

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

  // Only read (and auto-crop) the image once it's near the screen, so a page
  // of camera cards or a grid of photos doesn't decode every image up front —
  // which made the first card sit on "Loading photo…".
  const frameRef = useRef<HTMLDivElement>(null);
  const [nearView, setNearView] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || nearView) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNearView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearView]);

  useEffect(() => {
    if (!nearView) return;
    let active = true;

    // Screenshots of a camera app are trimmed to just the photo. The URL is
    // cached and shared across the app, so it is not revoked here.
    getDisplayPhotoUrl(imageId).then((url) => {
      if (!active) return;
      setResult({ imageId, url, state: url ? "ready" : "missing" });
    });

    return () => {
      active = false;
    };
  }, [imageId, nearView]);

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
      <div ref={frameRef} style={frameStyle}>
        <span style={messageStyle}>Photo unavailable on this device</span>
      </div>
    );
  }

  if (loadState === "loading" || !objectUrl) {
    // A soft shimmer instead of "Loading photo…" text.
    return (
      <div
        ref={frameRef}
        className="di-photo-loading"
        style={frameStyle}
        role="img"
        aria-label="Loading photo"
      />
    );
  }

  return (
    <div ref={frameRef} style={frameStyle}>
      {/* Blob object URLs are local; next/image cannot optimize them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={objectUrl} alt={alt} style={imageStyle} decoding="async" />
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
  border: "1px solid var(--border)",
  background: "var(--surface-3)",
};

const imageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const messageStyle: CSSProperties = {
  padding: "1.5rem",
  color: "var(--text-faint)",
  fontSize: "0.85rem",
  textAlign: "center",
};
