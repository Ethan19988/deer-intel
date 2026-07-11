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

// Core label sizing: pick the largest font that fits the owner name (and
// optional acreage line) inside a parcel's on-screen footprint of
// widthPx x heightPx, clamped between minPx and maxPx.
export function fitLabelFontPx(
  widthPx: number,
  heightPx: number,
  ownerName: string,
  acresText: string,
  minPx: number = LAND_OWNER_LABEL_MIN_PX,
  maxPx: number = LAND_OWNER_LABEL_MAX_PX,
): number {
  // Keep the label a touch inside the parcel edges.
  const widthBudget = widthPx * 0.92;

  // Longest line we must fit. Bold sans-serif averages ~0.6em per character.
  const longestChars = Math.max(ownerName.length, acresText.length, 1);
  const fromWidth = widthBudget / (longestChars * 0.6);

  // Stacked lines (name + optional acres) must also fit the parcel's height.
  const lineCount = acresText ? 2 : 1;
  const fromHeight = (heightPx * 0.92) / (lineCount * 1.2);

  return Math.min(Math.max(Math.min(fromWidth, fromHeight), minPx), maxPx);
}
