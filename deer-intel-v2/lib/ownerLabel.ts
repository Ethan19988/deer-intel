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

// The owner name as printed on the map: county records carry legal suffixes
// ("ETAL", "ET UX") that eat label width without telling a hunter anything,
// and state game lands often come as "COMMONWEALTH OF PA STATE GAME LANDS".
// The full record name still shows on the owner card.
export function ownerDisplayName(owner: string): string {
  let name = owner.trim().replace(/\s+/g, " ").toUpperCase();
  const gameLands = /STATE GAME LANDS?(\s*(NO\.?|#)?\s*\d+)?/.exec(name);
  if (gameLands) return gameLands[0].replace(/LAND$/, "LANDS");
  name = name.replace(/[\s,&]+(ETAL|ET AL|ET UX|ETUX|ET VIR|ETVIR)\.?$/, "");
  return name.replace(/[\s,&]+$/, "") || owner.trim().toUpperCase();
}
