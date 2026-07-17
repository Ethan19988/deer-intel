"use client";

import { Fragment } from "react";
import { CircleMarker, Polygon, Polyline, Popup } from "react-leaflet";
import {
  TERRAIN_STYLE,
  type TerrainMovementFeature,
  type TerrainMovementSet,
} from "@/lib/terrainMovement";
import { terrainPlaybook, type PlaybookTone } from "@/lib/terrainPlaybook";

// Verdict tone -> color on the light popup surface.
const TONE_COLOR: Record<PlaybookTone, string> = {
  prime: "#1c5b2e",
  confirm: "#8a6d1c",
  careful: "#9a3b2f",
};

type TerrainMovementLayerProps = {
  set: TerrainMovementSet;
};

// Terrain-derived movement prediction drawn on the map: bedding zones (filled
// polygons), travel corridors (dashed lines), crossing/pinch points (markers),
// and a security refuge (hatched-red polygon). Each feature is tappable and
// explains why it's there and how to play the wind. Colors are distinct from
// the purple asset-based corridors so the two systems read apart.
export default function TerrainMovementLayer({
  set,
}: TerrainMovementLayerProps) {
  return (
    <>
      {set.features.map((feature) => (
        <Fragment key={feature.id}>{renderFeature(feature, set.source)}</Fragment>
      ))}
    </>
  );
}

function renderFeature(feature: TerrainMovementFeature, source: string) {
  const { color } = TERRAIN_STYLE[feature.kind];
  const popup = <FeaturePopup feature={feature} source={source} />;

  if (feature.kind === "bedding") {
    return (
      <Polygon
        positions={feature.polygon}
        pathOptions={{
          color,
          weight: 1.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.28,
        }}
      >
        {popup}
      </Polygon>
    );
  }

  if (feature.kind === "refuge") {
    return (
      <Polygon
        positions={feature.polygon}
        pathOptions={{
          color,
          weight: 1.5,
          opacity: 0.9,
          dashArray: "5 5",
          fillColor: color,
          fillOpacity: 0.14,
        }}
      >
        {popup}
      </Polygon>
    );
  }

  if (feature.kind === "travel") {
    return (
      <Polyline
        positions={feature.line}
        pathOptions={{
          color,
          weight: 4,
          opacity: 0.9,
          dashArray: "1 8",
          lineCap: "round",
        }}
      >
        {popup}
      </Polyline>
    );
  }

  // pinch
  return (
    <CircleMarker
      center={feature.point}
      radius={9}
      pathOptions={{
        color: "#3f2d05",
        weight: 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.95,
      }}
    >
      {popup}
    </CircleMarker>
  );
}

function FeaturePopup({
  feature,
  source,
}: {
  feature: TerrainMovementFeature;
  source: string;
}) {
  const { color, label } = TERRAIN_STYLE[feature.kind];
  const play = terrainPlaybook(feature);

  return (
    <Popup>
      <div style={{ maxWidth: "245px" }}>
        <span
          style={{
            display: "inline-block",
            marginBottom: "0.35rem",
            padding: "0.1rem 0.45rem",
            borderRadius: "999px",
            background: color,
            color: "#fff",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {label}
        </span>
        <strong style={{ display: "block", fontSize: "0.95rem" }}>
          {feature.title}
        </strong>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", lineHeight: 1.4 }}>
          {feature.detail}
        </p>
        {feature.windNote ? (
          <p
            style={{
              margin: "0.4rem 0 0",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#1c5b2e",
            }}
          >
            🌬️ {feature.windNote}
          </p>
        ) : null}

        <div
          style={{
            marginTop: "0.5rem",
            paddingTop: "0.45rem",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "0.06rem 0.4rem",
              borderRadius: "999px",
              border: `1px solid ${TONE_COLOR[play.tone]}`,
              color: TONE_COLOR[play.tone],
              fontSize: "0.66rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {play.verdict}
          </span>
          {play.moves.map((move) => (
            <p
              key={move.label}
              style={{ margin: "0.32rem 0 0", fontSize: "0.78rem", lineHeight: 1.35 }}
            >
              <span aria-hidden="true">{move.icon}</span>{" "}
              <strong>{move.label}:</strong> {move.text}
            </p>
          ))}
          {play.access ? (
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.76rem", lineHeight: 1.3, color: "#4b5563" }}>
              📍 {play.access}
            </p>
          ) : null}
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.76rem", fontWeight: 700, color: "#4b5563" }}>
            🗓️ {play.window}
          </p>
        </div>

        <p
          style={{
            margin: "0.45rem 0 0",
            fontSize: "0.68rem",
            color: "#6b7280",
          }}
        >
          {source}
        </p>
      </div>
    </Popup>
  );
}
