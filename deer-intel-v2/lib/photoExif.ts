"use client";

// Trail cameras stamp the capture date/time onto every photo and also write it
// into the file's EXIF metadata (DateTimeOriginal). We read that tag directly so
// an imported photo carries its real capture time instead of a filename guess or
// the file's last-modified date. This is a deliberately small JPEG/EXIF reader —
// enough to pull one ASCII date field — so we avoid adding an EXIF dependency.
//
// Note: our image-resize step (lib/imageProcessing) re-encodes through a canvas
// and strips EXIF, so this must run against the ORIGINAL File before processing.

const JPEG_SOI = 0xffd8;
const MARKER_APP1 = 0xffe1;
const MARKER_SOS = 0xffda;
const TAG_DATETIME = 0x0132; // DateTime (IFD0)
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003; // when the shutter fired
const TAG_DATETIME_DIGITIZED = 0x9004;

// EXIF metadata sits at the very front of the file; 256 KB is far more than any
// camera's APP1 segment (metadata + thumbnail) so slicing keeps this cheap.
const EXIF_SCAN_BYTES = 256 * 1024;

/**
 * Read the capture time a trail camera recorded and return it as a value the
 * datetime-local inputs use ("YYYY-MM-DDTHH:mm"). Returns "" when the file has
 * no usable EXIF date, letting callers fall back to the filename / file date.
 */
export async function readPhotoDateTimeInput(file: File): Promise<string> {
  try {
    const buffer = await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer();
    const raw = readExifDateTime(new DataView(buffer));

    return raw ? exifDateToInputValue(raw) : "";
  } catch {
    return "";
  }
}

function readExifDateTime(view: DataView): string | null {
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) return null;

  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;

    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === MARKER_SOS) break; // image data starts; no more metadata

    const segmentLength = view.getUint16(offset);

    if (segmentLength < 2) break;

    if (marker === MARKER_APP1 && isExifHeader(view, offset + 2)) {
      // TIFF block starts after the 6-byte "Exif\0\0" header.
      return readTiffDateTime(view, offset + 8);
    }

    offset += segmentLength;
  }

  return null;
}

function isExifHeader(view: DataView, at: number): boolean {
  // "Exif\0\0"
  return (
    at + 6 <= view.byteLength &&
    view.getUint8(at) === 0x45 &&
    view.getUint8(at + 1) === 0x78 &&
    view.getUint8(at + 2) === 0x69 &&
    view.getUint8(at + 3) === 0x66 &&
    view.getUint8(at + 4) === 0x00 &&
    view.getUint8(at + 5) === 0x00
  );
}

function readTiffDateTime(view: DataView, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // "II"; "MM" (0x4d4d) is big-endian

  if (!littleEndian && byteOrder !== 0x4d4d) return null;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null; // TIFF magic 42

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = tiffStart + ifd0Offset;

  // Prefer the Exif sub-IFD's DateTimeOriginal (shutter time); fall back to the
  // digitized time, then IFD0's DateTime.
  const exifIfdPointer = readIfdTagValue(
    view,
    ifd0,
    TAG_EXIF_IFD_POINTER,
    littleEndian,
  );

  if (typeof exifIfdPointer === "number") {
    const exifIfd = tiffStart + exifIfdPointer;
    const original = readIfdAscii(
      view,
      exifIfd,
      tiffStart,
      TAG_DATETIME_ORIGINAL,
      littleEndian,
    );

    if (original) return original;

    const digitized = readIfdAscii(
      view,
      exifIfd,
      tiffStart,
      TAG_DATETIME_DIGITIZED,
      littleEndian,
    );

    if (digitized) return digitized;
  }

  return readIfdAscii(view, ifd0, tiffStart, TAG_DATETIME, littleEndian);
}

/** Locate an IFD entry by tag; returns its numeric value (for pointers). */
function readIfdTagValue(
  view: DataView,
  ifdStart: number,
  tag: number,
  littleEndian: boolean,
): number | null {
  const entry = findIfdEntry(view, ifdStart, tag, littleEndian);

  if (!entry) return null;

  return view.getUint32(entry + 8, littleEndian);
}

/** Read an IFD entry's ASCII value (used for the date fields). */
function readIfdAscii(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  tag: number,
  littleEndian: boolean,
): string | null {
  const entry = findIfdEntry(view, ifdStart, tag, littleEndian);

  if (!entry) return null;

  const count = view.getUint32(entry + 4, littleEndian);

  if (count < 2 || count > 64) return null;

  // ASCII values longer than 4 bytes live at an offset from the TIFF start.
  const valueOffset =
    count <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, littleEndian);

  if (valueOffset + count > view.byteLength) return null;

  let text = "";

  for (let index = 0; index < count; index += 1) {
    const code = view.getUint8(valueOffset + index);

    if (code === 0) break;

    text += String.fromCharCode(code);
  }

  return text.trim() || null;
}

function findIfdEntry(
  view: DataView,
  ifdStart: number,
  tag: number,
  littleEndian: boolean,
): number | null {
  if (ifdStart + 2 > view.byteLength) return null;

  const entryCount = view.getUint16(ifdStart, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;

    if (entry + 12 > view.byteLength) return null;

    if (view.getUint16(entry, littleEndian) === tag) return entry;
  }

  return null;
}

/** Convert EXIF "YYYY:MM:DD HH:MM:SS" to a datetime-local "YYYY-MM-DDTHH:mm". */
function exifDateToInputValue(raw: string): string {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(raw);

  if (!match) return "";

  const [, year, month, day, hour, minute] = match;

  // Cameras with a dead clock write all-zero dates — treat those as missing.
  if (year === "0000" || month === "00" || day === "00") return "";

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
