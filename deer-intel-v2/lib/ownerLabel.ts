// Shared formatting for land-owner map labels rendered by the statewide
// parcel-tiles overlay (components/map/ParcelTilesLayer.tsx).

// The acreage caption shown under an owner name, Spartan-Forge style: the value
// with up to two decimals (trailing zeros trimmed) and the word "acre(s)"
// spelled out — "0.21 acres", "1.03 acres", "12 acres". Empty when there's no
// usable acreage to show.
export function ownerAcresText(acres: number): string {
  if (!(acres > 0)) return "";
  const rounded = acres >= 100 ? acres.toFixed(0) : acres.toFixed(2);
  const trimmed = rounded.includes(".")
    ? rounded.replace(/\.?0+$/, "")
    : rounded;
  return `${trimmed} ${trimmed === "1" ? "acre" : "acres"}`;
}
