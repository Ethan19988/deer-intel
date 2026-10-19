import { PIN_LAYER_LOOKUP } from "@/lib/propertyMap";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";
import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

// "Finish setting up <property>" — the handful of things the Today verdict,
// stand check, walk-in scent check, and terrain read need. Each item is one tap
// to the exact place to fix it; the card disappears once the list is empty.

export type SetupItem = {
  id: string;
  label: string;
  /** Why it matters, in one short line. */
  detail: string;
  href: string;
  action: string;
};

// Stands without winds each get their own row, but only a few — past that the
// Stands page is the better place to work through them.
const MAX_STAND_WIND_ITEMS = 3;

export function buildSetupChecklist({
  property,
  stands,
  cameras,
  pins,
}: {
  property: Property;
  stands: Stand[];
  cameras: Camera[];
  pins: MapPin[];
}): SetupItem[] {
  const items: SetupItem[] = [];
  const layers = new Set(pins.map((pin) => PIN_LAYER_LOOKUP[pin.type]));

  if (!hasPropertyCoordinate(property)) {
    items.push({
      id: "center",
      label: "Set the property's center point",
      detail: "Weather, sun times, and rut timing key off it.",
      href: `/properties?edit=${property.id}`,
      action: "Set point",
    });
  }

  if (!property.huntArea || property.huntArea.length < 3) {
    items.push({
      id: "hunt-area",
      label: "Draw your hunt area",
      detail: "Keeps terrain picks and parcel lines to your ground.",
      href: "/map",
      action: "Open map",
    });
  }

  if (stands.length === 0) {
    items.push({
      id: "stands",
      label: "Add your first stand",
      detail: "The daily verdict picks from your stands.",
      href: "/stands#add-stand",
      action: "Add stand",
    });
  }

  const windless = stands.filter((stand) => !stand.bestWinds.trim());
  windless.slice(0, MAX_STAND_WIND_ITEMS).forEach((stand) => {
    items.push({
      id: `winds-${stand.id}`,
      label: `Set winds for ${stand.name}`,
      detail: "Without them the stand check can't call the wind.",
      href: `/stands#stand-${stand.id}`,
      action: "Set winds",
    });
  });
  if (windless.length > MAX_STAND_WIND_ITEMS) {
    const more = windless.length - MAX_STAND_WIND_ITEMS;
    items.push({
      id: "winds-more",
      label: `${more} more stand${more === 1 ? "" : "s"} need winds`,
      detail: "Tap a stand's wind rose to set them.",
      href: "/stands",
      action: "Open stands",
    });
  }

  if (cameras.length === 0) {
    items.push({
      id: "cameras",
      label: "Add a trail camera",
      detail: "Camera checks drive buck activity and deer hours.",
      href: "/cameras#add-camera",
      action: "Add camera",
    });
  }

  if (!layers.has("parking") && !layers.has("gates")) {
    items.push({
      id: "parking",
      label: "Drop a parking or gate pin",
      detail: "The walk-in scent check starts from where you park.",
      href: "/map",
      action: "Drop pin",
    });
  }

  if (!layers.has("bedding")) {
    items.push({
      id: "bedding",
      label: "Mark a bedding area",
      detail: "Lets the scent check warn when your walk blows into beds.",
      href: "/map",
      action: "Drop pin",
    });
  }

  return items;
}
