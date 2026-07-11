import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import {
  formatWalkDistance,
  formatWalkDuration,
  walkTrackDistanceMeters,
} from "@/lib/walkTrack";
import type { WalkTrack } from "@/types/walkTrack";

type WalkTracksSectionProps = {
  tracks: WalkTrack[];
  onDelete: (trackId: string) => void;
};

// Saved walks for a property: the GPS trails recorded on the map, listed newest
// first with how far and how long each one ran. Recording lives on the map — this
// is the read-and-review home for the walks you've already logged.
export default function WalkTracksSection({
  tracks,
  onDelete,
}: WalkTracksSectionProps) {
  if (tracks.length === 0) {
    return (
      <EmptyState
        title="No walks recorded yet"
        description="Open the map and tap Start Tracking to record the path you walk — scouting a new area, an access route, or where the deer took you. Saved walks show up here."
      />
    );
  }

  const orderedTracks = [...tracks].sort(
    (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt),
  );
  const totalMeters = orderedTracks.reduce(
    (sum, track) => sum + walkTrackDistanceMeters(track.points),
    0,
  );

  return (
    <div style={listStyle}>
      <p style={summaryTextStyle}>
        {orderedTracks.length} walk{orderedTracks.length === 1 ? "" : "s"} ·{" "}
        {formatWalkDistance(totalMeters)} on foot
      </p>

      {orderedTracks.map((track) => (
        <Card key={track.id} style={rowStyle}>
          <div style={infoStyle}>
            <p style={nameStyle}>{track.name}</p>
            <div style={metaRowStyle}>
              <Badge>{formatWalkDistance(walkTrackDistanceMeters(track.points))}</Badge>
              <Badge>{formatWalkDuration(track.startedAt, track.endedAt)}</Badge>
              <span style={pointCountStyle}>
                {track.points.length} points
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => onDelete(track.id)}
            style={deleteButtonStyle}
          >
            Delete
          </Button>
        </Card>
      ))}
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const summaryTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontWeight: 700,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  background: "var(--surface)",
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontWeight: 800,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const pointCountStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 600,
};

const deleteButtonStyle: CSSProperties = {
  flexShrink: 0,
};
