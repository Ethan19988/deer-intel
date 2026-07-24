import type { CSSProperties } from "react";
import PhotoRecordList from "@/components/photos/PhotoRecordList";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import {
  formatCameraCheckDate,
  sortCameraChecksChronologically,
} from "@/lib/cameraChecks";
import {
  formatWeatherTemperature,
  formatWeatherWind,
} from "@/lib/weather";
import { getPhotoRecordsForCheck } from "@/lib/photos";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

type CameraCheckListProps = {
  checks: CameraCheck[];
  photoRecords?: PhotoRecord[];
  deerProfiles?: DeerProfile[];
};

export default function CameraCheckList({
  checks,
  photoRecords = [],
  deerProfiles = [],
}: CameraCheckListProps) {
  const chronologicalChecks = sortCameraChecksChronologically(checks);

  if (chronologicalChecks.length === 0) {
    return (
      <EmptyState description="No camera checks yet. Save the first check above." />
    );
  }

  return (
    <div style={listStyle}>
      {chronologicalChecks.map((check) => {
        const checkPhotoRecords = getPhotoRecordsForCheck(
          photoRecords,
          check.id,
        );

        return (
          <Card key={check.id} as="article" variant="subtle">
            <div style={headerStyle}>
              <div>
                <p style={eyebrowStyle}>Camera Check</p>
                <h3 style={titleStyle}>{formatCameraCheckDate(check.date)}</h3>
              </div>
              <Badge>{wildlifeTotal(check)} sightings</Badge>
            </div>

            <div style={detailsGridStyle}>
              <CheckDetail
                label="Battery"
                value={formatPercent(check.batteryPercent)}
              />
              <CheckDetail
                label="SD Card"
                value={formatPercent(check.sdCardPercent)}
              />
              <CheckDetail
                label="Signal"
                value={formatPercent(check.signalStrength)}
              />
              <CheckDetail
                label="Temperature"
                value={formatWeatherTemperature(
                  check.weatherSnapshot.temperature,
                )}
              />
              <CheckDetail
                label="Wind"
                value={formatWeatherWind(check.weatherSnapshot)}
              />
              <CheckDetail
                label="Weather"
                value={check.weatherSnapshot.conditions}
              />
              <CheckDetail label="Moon" value={check.weatherSnapshot.moonPhase} />
              <CheckDetail label="Bucks" value={String(check.bucks)} />
              <CheckDetail label="Does" value={String(check.does)} />
              <CheckDetail label="Fawns" value={String(check.fawns)} />
              <CheckDetail label="Turkeys" value={String(check.turkeys)} />
              <CheckDetail label="Bears" value={String(check.bears)} />
              <CheckDetail label="Coyotes" value={String(check.coyotes)} />
            </div>

            {check.otherWildlife || check.notes ? (
              <div style={notesStyle}>
                {check.otherWildlife ? (
                  <>
                    <p style={detailLabelStyle}>Other Wildlife</p>
                    <p style={detailValueStyle}>{check.otherWildlife}</p>
                  </>
                ) : null}
                {check.notes ? (
                  <>
                    <p style={detailLabelStyle}>Notes</p>
                    <p style={detailValueStyle}>{check.notes}</p>
                  </>
                ) : null}
              </div>
            ) : null}

            {checkPhotoRecords.length > 0 ? (
              <div style={photoRecordsStyle}>
                <p style={detailLabelStyle}>Photo Records</p>
                <PhotoRecordList
                  photoRecords={checkPhotoRecords}
                  deerProfiles={deerProfiles}
                />
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function CheckDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

function wildlifeTotal(check: CameraCheck) {
  return (
    check.bucks +
    check.does +
    check.fawns +
    check.turkeys +
    check.bears +
    check.coyotes
  );
}

function formatPercent(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return "";
  if (trimmedValue.endsWith("%")) return trimmedValue;
  if (!Number.isNaN(Number(trimmedValue))) return `${trimmedValue}%`;

  return trimmedValue;
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.2rem",
  lineHeight: 1.25,
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const photoRecordsStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
