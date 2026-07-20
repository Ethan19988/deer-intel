"use client";

import { useSyncExternalStore } from "react";
import { AI_KEY_HEADER, sanitizeAiKey } from "@/lib/aiKeyHeader";

// A hunter's own Anthropic API key, so their photo reads and AI Scout calls
// bill their account instead of the deployment operator's. Device-local in its
// own localStorage entry — deliberately OUTSIDE deerIntelStore, so it is never
// cloud-synced, never included in backup exports, and never leaves this
// browser except as a header on this deployment's own AI routes.
const AI_KEY_STORAGE_KEY = "deer-intel:anthropic-api-key";

export function readAiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return sanitizeAiKey(window.localStorage.getItem(AI_KEY_STORAGE_KEY));
  } catch {
    return "";
  }
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setAiKey(value: string): void {
  const key = sanitizeAiKey(value);

  try {
    if (key) {
      window.localStorage.setItem(AI_KEY_STORAGE_KEY, key);
    } else {
      window.localStorage.removeItem(AI_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore write failures (private mode / quota).
  }
  notifyListeners();
}

export function clearAiKey(): void {
  setAiKey("");
}

/** Header object to spread into an AI route fetch; {} when no key is saved. */
export function aiKeyHeader(): Record<string, string> {
  const key = readAiKey();

  return key ? { [AI_KEY_HEADER]: key } : {};
}

/** "sk-ant-…-abcd" style display form — never render the full key. */
export function maskAiKey(key: string): string {
  if (key.length <= 12) return "…";

  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== AI_KEY_STORAGE_KEY && event.key !== null) return;
    notifyListeners();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): string {
  return readAiKey();
}

function getServerSnapshot(): string {
  return "";
}

export function useAiKey(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
