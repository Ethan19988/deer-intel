import type { Property } from "@/types/property";

// Older saves (and the store's defaults) wrote these placeholders into blank
// property fields instead of leaving them empty. Treat them as blank so they
// never show as real values or count as filled-in notes.
const PLACEHOLDER_VALUES = new Set(["unknown", "unknown acres", "no notes yet."]);

/** The field's real value, or "" when it's blank or an old placeholder. */
export function cleanPropertyField(value: string | undefined | null): string {
  const text = (value ?? "").trim();

  return PLACEHOLDER_VALUES.has(text.toLowerCase()) ? "" : text;
}

/** County, acres and notes with placeholders stripped, for display and edit prefill. */
export function cleanPropertyDetails(
  property: Pick<Property, "county" | "acres" | "notes">,
) {
  return {
    county: cleanPropertyField(property.county),
    acres: cleanPropertyField(property.acres),
    notes: cleanPropertyField(property.notes),
  };
}

/** "Northern PA · 120 acres", or "" when neither is set. */
export function propertyRegionLabel(
  property: Pick<Property, "county" | "acres">,
  separator = " · ",
): string {
  const county = cleanPropertyField(property.county);
  const acres = cleanPropertyField(property.acres);

  return [county, acres ? `${acres} acres` : ""].filter(Boolean).join(separator);
}
