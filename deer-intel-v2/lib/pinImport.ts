import { PIN_TYPES, type PinType } from "@/types/mapPin";

/**
 * A single waypoint pulled out of a GPX or KML file exported by another hunting
 * app (onX Hunt, HuntStand, BaseMap, Spartan Forge, Garmin, Google Earth, …).
 * It carries a suggested Deer Intel pin type guessed from the waypoint's name,
 * description, and symbol — the hunter can override it before importing.
 */
export type ImportedWaypoint = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  suggestedType: PinType;
  /** Original marker symbol/type from the source file, kept for the notes. */
  sourceSymbol: string;
};

export type WaypointFileFormat = "gpx" | "kml" | "kmz";

export type WaypointParseResult = {
  fileName: string;
  format: WaypointFileFormat | null;
  waypoints: ImportedWaypoint[];
  /** Set when the file couldn't be read; waypoints will be empty. */
  error?: string;
};

/**
 * The pin types offered when reviewing an import. These mirror the property
 * asset pins plus the deer-sighting markers other apps commonly export, so the
 * dropdown stays focused on what a hunter actually drops on the map.
 */
export const IMPORT_PIN_TYPES: readonly PinType[] = [
  "Stand",
  "Camera Site",
  "Bedding",
  "Food",
  "Water",
  "Scrape",
  "Rub",
  "Trail",
  "Parking",
  "Gate",
  "Buck Sighting",
  "Doe Sighting",
];

// Ordered most-specific-first so, e.g., "trail camera" matches the camera rule
// before the generic "trail" rule. Each keyword is matched as a whole word or
// substring against the lowercased name + description + symbol.
const PIN_TYPE_KEYWORDS: ReadonlyArray<{ type: PinType; keywords: string[] }> = [
  {
    type: "Camera Site",
    keywords: ["trail cam", "trailcam", "camera", "cam ", "cell cam", "cuddeback"],
  },
  {
    type: "Stand",
    keywords: [
      "stand",
      "treestand",
      "tree stand",
      "ladder",
      "hang on",
      "hang-on",
      "climber",
      "saddle",
      "blind",
      "box blind",
      "ground blind",
    ],
  },
  { type: "Bedding", keywords: ["bed", "bedding", "sanctuary", "thicket"] },
  {
    type: "Food",
    keywords: [
      "food",
      "plot",
      "feed",
      "corn",
      "bait",
      "mast",
      "acorn",
      "oak",
      "apple",
      "clover",
      "field",
      "ag ",
      "crop",
    ],
  },
  {
    type: "Water",
    keywords: ["water", "pond", "creek", "stream", "spring", "seep", "waterhole"],
  },
  { type: "Scrape", keywords: ["scrape", "licking branch"] },
  { type: "Rub", keywords: ["rub"] },
  {
    type: "Trail",
    keywords: [
      "trail",
      "path",
      "runway",
      "run ",
      "funnel",
      "pinch",
      "travel",
      "crossing",
      "entry",
      "exit",
      "access",
    ],
  },
  {
    type: "Parking",
    keywords: ["park", "truck", "vehicle", "atv", "utv", "trailhead", "lot"],
  },
  { type: "Gate", keywords: ["gate", "fence"] },
  { type: "Buck Sighting", keywords: ["buck", "shooter", "target buck", "sighting"] },
  { type: "Doe Sighting", keywords: ["doe", "fawn"] },
];

// Fallback when nothing in the name/description/symbol matches. "Trail" reads as
// a neutral "point of interest" the hunter can quickly retype in the review list.
const DEFAULT_PIN_TYPE: PinType = "Trail";

/**
 * Guess a Deer Intel pin type from a waypoint's text. Case-insensitive keyword
 * match; falls back to a neutral marker so an unmatched waypoint still imports.
 */
export function guessPinType(...fields: Array<string | undefined>): PinType {
  const haystack = fields
    .filter((field): field is string => typeof field === "string")
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return DEFAULT_PIN_TYPE;

  for (const { type, keywords } of PIN_TYPE_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return type;
  }

  return DEFAULT_PIN_TYPE;
}

export function detectWaypointFormat(
  fileName: string,
  text: string,
): WaypointFileFormat | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".gpx")) return "gpx";
  if (lowerName.endsWith(".kml")) return "kml";

  // Fall back to sniffing the contents when the extension is missing/unknown.
  if (/<gpx[\s>]/i.test(text)) return "gpx";
  if (/<kml[\s>]/i.test(text)) return "kml";

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // Skip 0,0 "null island" points some exports leave for empty waypoints.
    !(lat === 0 && lng === 0)
  );
}

function textContent(parent: Element, tagName: string): string {
  // Match on local name so namespaced KML tags (e.g. gx:*) still resolve.
  const nodes = parent.getElementsByTagName(tagName);
  const value = nodes.length > 0 ? nodes[0].textContent : null;

  return (value ?? "").trim();
}

function makeWaypointId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `wpt-${crypto.randomUUID()}`;
  }

  return `wpt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseGpxWaypoints(doc: Document): ImportedWaypoint[] {
  const waypoints: ImportedWaypoint[] = [];
  const nodes = doc.getElementsByTagName("wpt");

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const lat = Number(node.getAttribute("lat"));
    const lng = Number(node.getAttribute("lon"));

    if (!isValidLatLng(lat, lng)) continue;

    const name = textContent(node, "name");
    const description =
      textContent(node, "desc") || textContent(node, "cmt");
    const symbol = textContent(node, "sym") || textContent(node, "type");

    waypoints.push({
      id: makeWaypointId(),
      name: name || "Unnamed waypoint",
      description,
      lat,
      lng,
      suggestedType: guessPinType(name, description, symbol),
      sourceSymbol: symbol,
    });
  }

  return waypoints;
}

function parseKmlWaypoints(doc: Document): ImportedWaypoint[] {
  const waypoints: ImportedWaypoint[] = [];
  const placemarks = doc.getElementsByTagName("Placemark");

  for (let index = 0; index < placemarks.length; index += 1) {
    const placemark = placemarks[index];
    const points = placemark.getElementsByTagName("Point");

    // Only import single-point markers; lines/polygons (tracks, hunt areas,
    // property boundaries) aren't pins and are skipped.
    if (points.length === 0) continue;

    const coordinates = textContent(points[0], "coordinates");
    if (!coordinates) continue;

    // KML coordinates are "lng,lat[,alt]" and there can be several separated by
    // whitespace; a Point uses the first tuple.
    const firstTuple = coordinates.split(/\s+/)[0] ?? "";
    const [lngRaw, latRaw] = firstTuple.split(",");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (!isValidLatLng(lat, lng)) continue;

    const name = textContent(placemark, "name");
    const description = textContent(placemark, "description");

    waypoints.push({
      id: makeWaypointId(),
      name: name || "Unnamed waypoint",
      description,
      lat,
      lng,
      suggestedType: guessPinType(name, description),
      sourceSymbol: "",
    });
  }

  return waypoints;
}

/**
 * Parse the text of a GPX or KML file into reviewable waypoints. Runs in the
 * browser only (uses DOMParser). Never throws — problems come back as `error`.
 */
export function parseWaypointFile(
  fileName: string,
  text: string,
): WaypointParseResult {
  const format = detectWaypointFormat(fileName, text);

  if (!format) {
    return {
      fileName,
      format: null,
      waypoints: [],
      error:
        "Unsupported file. Export your pins as a GPX, KML, or KMZ file and try again.",
    };
  }

  if (typeof DOMParser === "undefined") {
    return {
      fileName,
      format,
      waypoints: [],
      error: "File import is only available in the browser.",
    };
  }

  let doc: Document;

  try {
    doc = new DOMParser().parseFromString(text, "application/xml");
  } catch {
    return {
      fileName,
      format,
      waypoints: [],
      error: "That file couldn't be read as XML. Nothing was imported.",
    };
  }

  if (doc.getElementsByTagName("parsererror").length > 0) {
    return {
      fileName,
      format,
      waypoints: [],
      error: "That file looks corrupt or isn't valid XML. Nothing was imported.",
    };
  }

  const waypoints =
    format === "gpx" ? parseGpxWaypoints(doc) : parseKmlWaypoints(doc);

  if (waypoints.length === 0) {
    return {
      fileName,
      format,
      waypoints,
      error:
        "No point waypoints were found in that file. Lines and areas can't be imported as pins.",
    };
  }

  return { fileName, format, waypoints };
}

/** Type guard used when reading a saved/edited pin type back from the UI. */
export function isImportablePinType(value: string): value is PinType {
  return (PIN_TYPES as readonly string[]).includes(value);
}

// --- KMZ support -----------------------------------------------------------
// A KMZ file is a ZIP archive holding one KML document (plus optional assets).
// Rather than pull in a zip dependency, we read the archive's central directory
// by hand and inflate the KML entry with the browser's built-in
// DecompressionStream. Only the deflate/store methods KMZ exporters actually use
// are supported; ZIP64 archives (never produced for a single KML) are not.

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIR_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream unavailable");
  }

  const stream = new Response(data as unknown as BodyInit).body;

  if (!stream) throw new Error("No body stream");

  const inflated = stream.pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(inflated).arrayBuffer();

  return new Uint8Array(buffer);
}

/**
 * Pull the KML text out of a KMZ archive. Returns null when the archive holds no
 * KML entry. Throws only if decompression itself isn't available/fails, which
 * the caller turns into a friendly error.
 */
async function extractKmlFromKmz(buffer: ArrayBuffer): Promise<string | null> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");

  // The End Of Central Directory record sits near the end, after an optional
  // comment of up to 65535 bytes. Scan backwards for its signature.
  const minEocd = 22;
  let eocdOffset = -1;
  const scanStart = buffer.byteLength - minEocd;
  const scanEnd = Math.max(0, buffer.byteLength - (minEocd + 0xffff));

  for (let offset = scanStart; offset >= scanEnd; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) return null;

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  type ZipEntry = {
    name: string;
    method: number;
    compressedSize: number;
    localHeaderOffset: number;
  };

  const entries: ZipEntry[] = [];
  let pointer = centralDirOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      pointer + 46 > buffer.byteLength ||
      view.getUint32(pointer, true) !== ZIP_CENTRAL_DIR_SIGNATURE
    ) {
      break;
    }

    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeaderOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

    entries.push({ name, method, compressedSize, localHeaderOffset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  // Prefer the conventional doc.kml, otherwise the first .kml in the archive.
  const kmlEntry =
    entries.find((entry) => entry.name.toLowerCase() === "doc.kml") ??
    entries.find((entry) => entry.name.toLowerCase().endsWith(".kml"));

  if (!kmlEntry) return null;

  const { localHeaderOffset } = kmlEntry;

  if (
    localHeaderOffset + 30 > buffer.byteLength ||
    view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_HEADER_SIGNATURE
  ) {
    return null;
  }

  // The local header repeats name/extra lengths, which can differ from the
  // central directory's, so read them here to find where the data really starts.
  const localNameLength = view.getUint16(localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressed = bytes.subarray(dataStart, dataStart + kmlEntry.compressedSize);

  if (kmlEntry.method === 0) {
    // Stored (no compression).
    return decoder.decode(compressed);
  }

  if (kmlEntry.method === 8) {
    // Deflate.
    const inflated = await inflateRaw(compressed);
    return decoder.decode(inflated);
  }

  return null;
}

/**
 * Read any supported waypoint file — GPX, KML, or KMZ — straight from a `File`.
 * KMZ archives are unzipped in the browser first; GPX/KML are read as text. This
 * is the entry point the UI should call. Runs in the browser only.
 */
export async function parseWaypointFileFromFile(
  file: File,
): Promise<WaypointParseResult> {
  if (file.name.toLowerCase().endsWith(".kmz")) {
    try {
      const buffer = await file.arrayBuffer();
      const kml = await extractKmlFromKmz(buffer);

      if (kml === null) {
        return {
          fileName: file.name,
          format: "kmz",
          waypoints: [],
          error:
            "That KMZ file didn't contain a KML document. Nothing was imported.",
        };
      }

      // Parse the inner KML, but report the original KMZ name and format.
      const result = parseWaypointFile(
        file.name.replace(/\.kmz$/i, ".kml"),
        kml,
      );

      return { ...result, fileName: file.name, format: "kmz" };
    } catch {
      return {
        fileName: file.name,
        format: "kmz",
        waypoints: [],
        error:
          "That KMZ file couldn't be opened in this browser. Try exporting as KML or GPX instead.",
      };
    }
  }

  const text = await file.text();

  return parseWaypointFile(file.name, text);
}
