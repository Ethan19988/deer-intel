import type { MapAsset } from "@/lib/propertyMap";

// Compact, filled silhouette glyphs (drawn in a 24×24 box) that sit inside the
// white ring of a teardrop map pin — so a camera, stand, or bedding pin reads at
// a glance the way a dedicated hunting app's markers do, instead of a letter.
// Paths are pure SVG inner markup; the caller wraps them in a <g fill="…">.

export type PinIconName =
  | "camera"
  | "stand"
  | "bedding"
  | "food"
  | "water"
  | "scrape"
  | "rub"
  | "trail"
  | "parking"
  | "gate"
  | "deer"
  | "plant"
  | "dot";

export const PIN_ICON_PATHS: Record<PinIconName, string> = {
  camera:
    '<path fill-rule="evenodd" d="M4 8.6A1.6 1.6 0 0 1 5.6 7H8l1.1-1.7A1 1 0 0 1 9.9 5h4.2a1 1 0 0 1 .8.4L16 7h2.4A1.6 1.6 0 0 1 20 8.6v7.8A1.6 1.6 0 0 1 18.4 18H5.6A1.6 1.6 0 0 1 4 16.4V8.6zM12 16a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 16z"/>',
  stand:
    '<path d="M8.2 3H10v18H8.2zM14 3h1.8v18H14zM8.2 6.6h7.6v1.7H8.2zM8.2 10.4h7.6v1.7H8.2zM8.2 14.2h7.6v1.7H8.2z"/>',
  bedding: '<path d="M14.5 3.2A9 9 0 1 0 20.8 16 7.2 7.2 0 0 1 14.5 3.2z"/>',
  food: '<path d="M20 4C10.6 4 4 10.6 4 20c9.4 0 16-6.6 16-16z"/>',
  water:
    '<path d="M12 3.2s6.2 6.6 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
  scrape:
    '<path d="M12 12.4c2.5 0 4.4 2 4.4 4 0 1.5-1.4 2.3-3 2.3h-2.8c-1.6 0-3-.8-3-2.3 0-2 1.9-4 4.4-4z"/><ellipse cx="7.6" cy="10.6" rx="1.6" ry="2"/><ellipse cx="10.6" cy="8.2" rx="1.6" ry="2.1"/><ellipse cx="13.4" cy="8.2" rx="1.6" ry="2.1"/><ellipse cx="16.4" cy="10.6" rx="1.6" ry="2"/>',
  rub: '<path d="M12 3l3.4 5.2h-2l3 4.6h-2.1l3 4.6H6.7l3-4.6H7.6l3-4.6h-2z"/><path d="M11 16.8h2V21h-2z"/>',
  trail:
    '<path d="M8 3h3.4v8.4l6.6 3.2v3.9H8a1.9 1.9 0 0 1-1.9-1.9V4.9A1.9 1.9 0 0 1 8 3z"/>',
  parking:
    '<path fill-rule="evenodd" d="M8 4h5.6a4.4 4.4 0 0 1 0 8.8H10V20H8V4zm2 2.1v4.6h3.6a2.3 2.3 0 0 0 0-4.6H10z"/>',
  gate: '<path d="M4.2 5H6v14H4.2zM18 5h1.8v14H18zM6 7.6h12v1.8H6zM6 12.4h12v1.8H6zM6 8l12 6.6v-1.9L6 6.1z"/>',
  deer:
    '<path d="M9.4 4.6c1.4 0 2.2 2.1 2.2 5.3s-.8 6-2.2 6-2.2-2.8-2.2-6 .8-5.3 2.2-5.3z"/><path d="M14.6 4.6c1.4 0 2.2 2.1 2.2 5.3s-.8 6-2.2 6-2.2-2.8-2.2-6 .8-5.3 2.2-5.3z"/>',
  plant:
    '<path d="M11.3 12.5h1.4V21h-1.4z"/><path d="M12 13c0-3.2 2.2-5.4 6.2-5.4 0 3.2-2.2 5.4-6.2 5.4z"/><path d="M12 13c0-3.2-2.2-5.4-6.2-5.4 0 3.2 2.2 5.4 6.2 5.4z"/>',
  dot: '<circle cx="12" cy="12" r="4.6"/>',
};

// Map an asset to its glyph. Layer-backed assets key off the layer; the "other"
// bucket (sightings, vegetation) keys off the pin's type label.
export function pinIconForAsset(asset: MapAsset): PinIconName {
  switch (asset.layerId) {
    case "cameras":
      return "camera";
    case "stands":
      return "stand";
    case "bedding":
      return "bedding";
    case "food":
      return "food";
    case "water":
      return "water";
    case "scrapes":
      return "scrape";
    case "rubs":
      return "rub";
    case "trails":
      return "trail";
    case "parking":
      return "parking";
    case "gates":
      return "gate";
    default:
      break;
  }

  const type = asset.typeLabel.toLowerCase();
  if (type.includes("buck") || type.includes("doe") || type.includes("deer")) {
    return "deer";
  }
  if (type.includes("veg") || type.includes("plant") || type.includes("food")) {
    return "plant";
  }
  return "dot";
}
