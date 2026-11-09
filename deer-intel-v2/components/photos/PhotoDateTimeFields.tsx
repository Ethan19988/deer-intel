"use client";

import type { CSSProperties } from "react";
import {
  formatClockTime,
  joinPhotoDate,
  splitPhotoDate,
} from "@/lib/photoDateTime";
import type { PhotoCaptureTimeSource } from "@/types/photo";

type PhotoDateTimeFieldsProps = {
  idPrefix: string;
  // Stored value: "YYYY-MM-DDTHH:mm", or a bare "YYYY-MM-DD" when no time.
  value: string;
  source?: PhotoCaptureTimeSource | "";
  // The file's modified clock time ("HH:mm"), offered as a one-tap fill when
  // the date came from the file. Never applied without a tap.
  fileTimeHint?: string;
  // Stamp and EXIF disagreed (or one had an impossible date).
  clockWarning?: boolean;
  // Any edit here is the hunter's own value, so the source becomes "manual".
  onChange: (value: string, source: PhotoCaptureTimeSource) => void;
};

const SOURCE_LABEL: Record<PhotoCaptureTimeSource, string> = {
  stamp: "From the photo's stamp",
  exif: "From the photo's EXIF",
  stampDate: "Date from the stamp",
  filename: "From the file name",
  file: "Date from the file",
  manual: "Set by you",
};

// Separate date and time inputs so a photo whose time wasn't read stays
// date-only — no made-up noon or file time — with a clear "set time" prompt.
export default function PhotoDateTimeFields({
  idPrefix,
  value,
  source = "",
  fileTimeHint = "",
  clockWarning = false,
  onChange,
}: PhotoDateTimeFieldsProps) {
  const { date, time } = splitPhotoDate(value);
  const missingTime = Boolean(date) && !time;

  return (
    <div style={wrapStyle}>
      <div style={rowStyle}>
        <label style={fieldStyle} htmlFor={`${idPrefix}-date`}>
          <span style={labelStyle}>Photo date</span>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={(event) =>
              onChange(joinPhotoDate(event.target.value, time), "manual")
            }
            style={{ ...inputStyle, ...(date ? null : needsValueStyle) }}
          />
        </label>
        <label style={fieldStyle} htmlFor={`${idPrefix}-time`}>
          <span style={labelStyle}>Time</span>
          <input
            id={`${idPrefix}-time`}
            type="time"
            value={time}
            disabled={!date}
            onChange={(event) =>
              onChange(joinPhotoDate(date, event.target.value), "manual")
            }
            style={{ ...inputStyle, ...(missingTime ? needsValueStyle : null) }}
          />
        </label>
      </div>

      {!date ? (
        <span style={warnStyle}>No date found — set the date the shot was taken.</span>
      ) : missingTime ? (
        <span style={warnStyle}>
          Time not read — set time
          {fileTimeHint ? (
            <button
              type="button"
              onClick={() => onChange(joinPhotoDate(date, fileTimeHint), "manual")}
              style={hintButtonStyle}
            >
              Use file time {formatClockTime(fileTimeHint)}
            </button>
          ) : null}
        </span>
      ) : source ? (
        <span style={sourceStyle}>{SOURCE_LABEL[source]}</span>
      ) : null}

      {clockWarning ? (
        <span style={warnStyle}>
          Camera clock may be wrong — the printed stamp and the photo&apos;s
          file data disagree or show an impossible date. Check the date and
          time.
        </span>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
  gap: "0.5rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};

const needsValueStyle: CSSProperties = {
  borderColor: "var(--warning-border)",
  boxShadow: "inset 3px 0 0 var(--warning-text)",
};

const warnStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
  color: "var(--warning-text)",
  fontSize: "0.82rem",
  fontWeight: 700,
  lineHeight: 1.35,
};

const sourceStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.8rem",
};

const hintButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.6rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
};
