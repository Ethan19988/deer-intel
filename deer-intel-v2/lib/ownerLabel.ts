// Shared sizing for land-owner map labels. The statewide parcel-tiles overlay
// (components/map/ParcelTilesLayer.tsx) sizes each owner name to fit inside its
// parcel's on-screen footprint, Spartan-Forge style.

// Owner labels scale with zoom to sit inside the parcel, but stay clamped so a
// huge tract isn't a billboard and a tiny lot's name is still readable.
export const LAND_OWNER_LABEL_MIN_PX = 9;
export const LAND_OWNER_LABEL_MAX_PX = 28;

// The acreage caption under an owner name ("12 ac"), or "" below the acreage
// worth showing.
export function ownerAcresText(acres: number): string {
  return acres > 0 ? `${acres.toFixed(acres >= 10 ? 0 : 1)} ac` : "";
}

// The largest font that lets the owner name (and optional acreage line) fit
// inside a parcel's on-screen footprint of widthPx x heightPx — before any
// min/max clamp. Callers use this raw value to decide whether a parcel is even
// big enough on screen to be worth labeling: if the ideal size is below the
// readable minimum, the parcel is too small at this zoom (zoom in to reveal it)
// rather than cramming a clamped-up name that overflows the boundary.
export function idealLabelFontPx(
  widthPx: number,
  heightPx: number,
  ownerName: string,
  acresText: string,
): number {
  // Keep the label a touch inside the parcel edges.
  const widthBudget = widthPx * 0.92;

  // Longest line we must fit. Bold sans-serif averages ~0.6em per character.
  const longestChars = Math.max(ownerName.length, acresText.length, 1);
  const fromWidth = widthBudget / (longestChars * 0.6);

  // Stacked lines (name + optional acres) must also fit the parcel's height.
  const lineCount = acresText ? 2 : 1;
  const fromHeight = (heightPx * 0.92) / (lineCount * 1.2);

  return Math.min(fromWidth, fromHeight);
}

// Core label sizing: the ideal fit clamped into the readable [minPx, maxPx]
// range so a huge tract isn't a billboard and a tight fit stays legible.
export function fitLabelFontPx(
  widthPx: number,
  heightPx: number,
  ownerName: string,
  acresText: string,
  minPx: number = LAND_OWNER_LABEL_MIN_PX,
  maxPx: number = LAND_OWNER_LABEL_MAX_PX,
): number {
  const ideal = idealLabelFontPx(widthPx, heightPx, ownerName, acresText);
  return Math.min(Math.max(ideal, minPx), maxPx);
}
