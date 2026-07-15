// Turn a property into the exact offline terrain-pipeline command to run on the
// Linux box (pipeline/terrain/run.sh). The app knows where the property is; this
// derives a bounding box around everything the hunter has placed and formats the
// run.sh invocation, so generating a 1 m LiDAR read is copy-paste instead of
// hand-measuring coordinates.

export type Coord = { lat: number; lng: number };

export type PipelineInvocation = {
  slug: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  command: string;
};

// Padding added around the placed-asset extent (degrees). A lone coordinate
// becomes roughly a 1.5–1.8 km box — enough LiDAR to cover a property's core.
const PAD_LAT = 0.008;
const PAD_LNG = 0.01;

export function slugifyProperty(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "property"
  );
}

/**
 * Build the run.sh command for a property from its center and any placed
 * coordinates (pins, cameras). Returns null when there's no location to anchor
 * on — the caller should prompt the hunter to add a coordinate or a pin first.
 */
export function buildPipelineInvocation(
  name: string,
  center: Coord | null,
  extraCoords: Coord[] = [],
): PipelineInvocation | null {
  const coords = [center, ...extraCoords].filter(
    (c): c is Coord =>
      !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng),
  );
  if (coords.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }

  const bbox = {
    minLat: round(minLat - PAD_LAT),
    maxLat: round(maxLat + PAD_LAT),
    minLng: round(minLng - PAD_LNG),
    maxLng: round(maxLng + PAD_LNG),
  };
  const slug = slugifyProperty(name);

  return {
    slug,
    ...bbox,
    command: `./run.sh ${slug} ${bbox.minLng} ${bbox.minLat} ${bbox.maxLng} ${bbox.maxLat}`,
  };
}

export type PipelineManifestEntry = {
  slug: string;
  name: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/**
 * Build a manifest of pipeline invocations for every located property, for the
 * bulk `run_all.sh`. Properties with no location are skipped; duplicate slugs
 * are disambiguated so each run writes a distinct output file.
 */
export function buildPipelineManifest(
  properties: Array<{ name: string; center: Coord | null; extraCoords?: Coord[] }>,
): PipelineManifestEntry[] {
  const entries: PipelineManifestEntry[] = [];
  const seen = new Set<string>();

  for (const property of properties) {
    const invocation = buildPipelineInvocation(
      property.name,
      property.center,
      property.extraCoords ?? [],
    );
    if (!invocation) continue;

    let slug = invocation.slug;
    let suffix = 2;
    while (seen.has(slug)) slug = `${invocation.slug}-${suffix++}`;
    seen.add(slug);

    entries.push({
      slug,
      name: property.name,
      minLng: invocation.minLng,
      minLat: invocation.minLat,
      maxLng: invocation.maxLng,
      maxLat: invocation.maxLat,
    });
  }

  return entries;
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
