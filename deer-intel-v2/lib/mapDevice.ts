export const MOBILE_MAP_MEDIA_QUERY =
  "(max-width: 720px), (hover: none), (pointer: coarse)";

export function isMobileMapDevice() {
  if (typeof window === "undefined") return false;

  return window.matchMedia(MOBILE_MAP_MEDIA_QUERY).matches;
}
