import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatPhotoDate, sortPhotoRecordsChronologically } from "@/lib/photos";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

type PhotoRecordListProps = {
  photoRecords: PhotoRecord[];
  deerProfiles?: DeerProfile[];
  emptyDescription?: string;
};

export default function PhotoRecordList({
  photoRecords,
  deerProfiles = [],
  emptyDescription = "No photo records yet.",
}: PhotoRecordListProps) {
  const chronologicalPhotos = sortPhotoRecordsChronologically(photoRecords);

  if (chronologicalPhotos.length === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return (
    <div style={listStyle}>
      {chronologicalPhotos.map((photo) => {
        const deerProfile = deerProfiles.find(
          (profile) => profile.id === photo.deerProfileId,
        );

        return (
          <article key={photo.id} style={photoCardStyle}>
            <div style={headerStyle}>
              <div>
                <p style={eyebrowStyle}>{formatPhotoDate(photo.photoDate)}</p>
                <h4 style={titleStyle}>{photo.fileName}</h4>
              </div>
              <Badge>{photo.species}</Badge>
            </div>

            {deerProfile || photo.buckName || photo.notes ? (
              <div style={detailsStyle}>
                {deerProfile ? (
                  <PhotoDetail
                    label="Deer Profile"
                    value={deerProfile.nickname}
                  />
                ) : null}
                {photo.buckName ? (
                  <PhotoDetail label="Buck Name" value={photo.buckName} />
                ) : null}
                {photo.notes ? (
                  <PhotoDetail label="Notes" value={photo.notes} />
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PhotoDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value}</p>
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const photoCardStyle: CSSProperties = {
  padding: "0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#f1f5ef",
  fontSize: "1rem",
  lineHeight: 1.25,
};

const detailsStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid #1e2a1e",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#c7d0c5",
  lineHeight: 1.5,
};
