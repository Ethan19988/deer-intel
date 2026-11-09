"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { isPhotoReadingEnabled } from "@/lib/photoStampClient";

// One plain line, shown only when AI photo reading is on: the hunter should
// know a copy of each photo leaves the device before picking any.
export default function PhotoAiPrivacyNote({ style }: { style?: CSSProperties }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void isPhotoReadingEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  return (
    <p style={{ ...noteStyle, ...style }}>
      AI photo reading is on: a resized copy of each photo is sent to the AI
      service to read the stamp and identify the animal.
    </p>
  );
}

const noteStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};
