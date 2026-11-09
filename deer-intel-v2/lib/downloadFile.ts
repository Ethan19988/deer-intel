"use client";

// How long a download's object URL stays alive. iOS Safari (and some Android
// browsers) start reading the blob after click() returns — revoking it
// immediately yields an empty or "failed" download — and there's no event for
// when the save finishes, so keep it around for a minute.
export const DOWNLOAD_URL_LIFETIME_MS = 60_000;

/**
 * Save a Blob as a file via a temporary <a download>. The link is attached to
 * the document before the click (Firefox/iOS ignore clicks on detached links)
 * and removed after; the object URL is revoked after DOWNLOAD_URL_LIFETIME_MS.
 * Can't tell whether the user actually saved it — callers treat the click as
 * the best available signal.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}
