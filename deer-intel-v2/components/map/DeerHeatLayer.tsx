"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ImageOverlay, Popup, useMapEvents } from "react-leaflet";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { aggregateCameraActivity } from "@/lib/terrainLearning";
import {
  buildDeerHeatSources,
  explainDeerHeatAt,
  outlookIntensity,
  PERIOD_HEAT_LINE,
  type CameraHeatSpot,
  type HeatExplanation,
  type HeatSource,
  type HeatSourceKind,
} from "@/lib/deerHeat";
import type {
  MovementCorridor,
  MovementPeriod,
} from "@/lib/movementPrediction";
import { TERRAIN_STYLE, type TerrainMovementSet } from "@/lib/terrainMovement";

type DeerHeatLayerProps = {
  set: TerrainMovementSet | null;
  corridors: MovementCorridor[];
  period: MovementPeriod;
  /** Today's movement-outlook score; scales the whole surface's brightness. */
  outlookScore: number | null;
  /** Off while placing pins / drawing, so a tap never does two things. */
  tapEnabled?: boolean;
};

// The predictive heat surface: every explainable prediction the app already
// makes (terrain read, pin corridors, camera history), weighted for the current
// movement period by lib/deerHeat and rendered as one soft raster. Drawing
// happens on an offscreen canvas that ships as a single geo-anchored
// ImageOverlay — no per-frame work, and it re-renders only when the inputs
// (period, pins, terrain, cameras) actually change.
export default function DeerHeatLayer({
  set,
  corridors,
  period,
  outlookScore,
  tapEnabled = true,
}: DeerHeatLayerProps) {
  const state = useDeerIntelStore();

  // Same activity read as CameraHeatLayer (bucks weighted double), normalized
  // against the busiest camera so weights land on 0-1.
  const cameraSpots = useMemo<CameraHeatSpot[]>(() => {
    const cams = aggregateCameraActivity(state.cameras, state.cameraChecks)
      .map((c) => ({
        lat: c.lat,
        lng: c.lng,
        name: c.name,
        activity: c.bucks * 2 + c.does + c.fawns,
      }))
      .filter((c) => c.activity > 0);
    const max = Math.max(0, ...cams.map((c) => c.activity));
    if (max === 0) return [];
    return cams.map((c) => ({ ...c, activity: c.activity / max }));
  }, [state.cameras, state.cameraChecks]);

  const sources = useMemo(
    () =>
      buildDeerHeatSources({
        terrain: set,
        corridors,
        cameras: cameraSpots,
        period,
      }),
    [set, corridors, cameraSpots, period],
  );

  const overlay = useMemo(
    () => renderHeatOverlay(sources, outlookIntensity(outlookScore)),
    [sources, outlookScore],
  );

  // Tap a warm spot -> "why it's hot here". Cold ground closes the card, so
  // the map's other tap behaviors (parcels, pins) keep the quiet ground.
  const [explain, setExplain] = useState<{
    position: [number, number];
    explanation: HeatExplanation;
  } | null>(null);

  useMapEvents({
    click: (event) => {
      if (!tapEnabled) return;
      const { lat, lng } = event.latlng;
      const explanation = explainDeerHeatAt(lat, lng, sources);
      setExplain(explanation ? { position: [lat, lng], explanation } : null);
    },
  });

  // The card explains "right now", so only a period flip truly invalidates it.
  // Deliberately NOT keyed on the sources array: its identity can churn with
  // unrelated map re-renders, which would close the card the moment it opens.
  useEffect(() => {
    setExplain(null);
  }, [period]);

  if (!overlay) return null;

  return (
    <>
      <ImageOverlay
        url={overlay.url}
        bounds={overlay.bounds}
        opacity={1}
        className="di-deer-heat"
      />
      {explain ? (
        <Popup position={explain.position} closeButton>
          <HeatExplainCard explanation={explain.explanation} period={period} />
        </Popup>
      ) : null}
    </>
  );
}

const MAX_LISTED_CONTRIBUTORS = 4;

// Chip color per source kind: terrain kinds reuse TERRAIN_STYLE so the card
// matches the Terrain layer's key; pins take the Movement purple; cameras the
// Camera Heat orange.
function contributorColor(kind: HeatSourceKind): string {
  if (kind === "bedding" || kind === "travel" || kind === "pinch" || kind === "refuge") {
    return TERRAIN_STYLE[kind].color;
  }
  if (kind === "route") return TERRAIN_STYLE.travel.color;
  if (kind === "camera") return "#ef7a24";
  return "#6d28d9";
}

const KIND_LABEL: Record<HeatSourceKind, string> = {
  bedding: "Likely bedding",
  travel: "Travel corridor",
  route: "Bed-to-feed route",
  pinch: "Crossing / pinch",
  refuge: "Security refuge",
  corridor: "Pin corridor",
  "bed-pin": "Bedding pin",
  food: "Food pin",
  water: "Water pin",
  camera: "Camera evidence",
};

function heatLabel(total: number): string {
  if (total >= 0.75) return "Red-hot — predictions stack here";
  if (total >= 0.45) return "Hot ground";
  return "Warm ground";
}

function HeatExplainCard({
  explanation,
  period,
}: {
  explanation: HeatExplanation;
  period: MovementPeriod;
}) {
  const listed = explanation.contributors.slice(0, MAX_LISTED_CONTRIBUTORS);
  const extra = explanation.contributors.length - listed.length;

  return (
    <div style={cardStyle}>
      <p style={headStyle}>{heatLabel(explanation.total)}</p>
      <p style={periodStyle}>{PERIOD_HEAT_LINE[period]}</p>
      <div style={listStyle}>
        {listed.map((contributor, index) => (
          <div key={`${contributor.kind}-${index}`} style={rowStyle}>
            <span
              style={{
                ...dotStyle,
                background: contributorColor(contributor.kind),
              }}
              aria-hidden="true"
            />
            <span>
              <strong>{KIND_LABEL[contributor.kind]}</strong>
              {contributor.title ? ` · ${contributor.title}` : ""}
            </span>
          </div>
        ))}
      </div>
      {extra > 0 ? (
        <p style={moreStyle}>
          +{extra} more prediction{extra === 1 ? "" : "s"} overlapping here
        </p>
      ) : null}
    </div>
  );
}

const cardStyle: CSSProperties = {
  maxWidth: 240,
  fontSize: 13,
  lineHeight: 1.4,
};

const headStyle: CSSProperties = {
  margin: 0,
  fontWeight: 800,
};

const periodStyle: CSSProperties = {
  margin: "0.15rem 0 0.4rem",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 600,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.4rem",
};

const dotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  flex: "0 0 auto",
  transform: "translateY(1px)",
};

const moreStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  color: "#6b7280",
  fontSize: 12,
};

// Moderate resolution on purpose: the browser's bilinear upscale of the
// stretched ImageOverlay is what melts the shapes into a soft heat surface.
const CANVAS_WIDTH = 480;
// Below ~3% intensity the ramp is invisible anyway; clipping it keeps faint
// spill from tinting half the property.
const MIN_VISIBLE = 0.03;

type HeatOverlay = {
  url: string;
  bounds: [[number, number], [number, number]];
};

/**
 * Rasterize the weighted sources into a colored PNG data URL plus the
 * geographic bounds it stretches over. Grayscale intensity is accumulated
 * additively (overlapping predictions reinforce), softened with multi-pass
 * draws instead of ctx.filter blur (which older Safari lacks), then mapped
 * through the same amber→orange→red ramp Camera Heat uses.
 */
function renderHeatOverlay(
  sources: HeatSource[],
  intensity: number,
): HeatOverlay | null {
  if (typeof document === "undefined" || sources.length === 0) return null;

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const source of sources) {
    const points =
      source.shape === "polygon"
        ? source.ring
        : source.shape === "line"
          ? source.line
          : [source.point];
    for (const [lat, lng] of points) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
    }
  }
  if (!Number.isFinite(south) || !Number.isFinite(west)) return null;

  // Pad so blobs on the edge fade out inside the image instead of clipping.
  const midLat = (south + north) / 2;
  const mPerDegLat = 110_540;
  const mPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);
  const spanXm = Math.max(1, (east - west) * mPerDegLng);
  const spanYm = Math.max(1, (north - south) * mPerDegLat);
  const padM = Math.max(180, Math.max(spanXm, spanYm) * 0.12);
  south -= padM / mPerDegLat;
  north += padM / mPerDegLat;
  west -= padM / mPerDegLng;
  east += padM / mPerDegLng;

  const widthM = (east - west) * mPerDegLng;
  const heightM = (north - south) * mPerDegLat;
  const width = CANVAS_WIDTH;
  const height = Math.min(
    1600,
    Math.max(80, Math.round(width * (heightM / widthM))),
  );
  const pxPerM = width / widthM;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const toX = (lng: number) => ((lng - west) / (east - west)) * width;
  const toY = (lat: number) => ((north - lat) / (north - south)) * height;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const source of sources) {
    if (source.shape === "spot") {
      const r = Math.max(4, source.radiusM * 1.6 * pxPerM);
      const cx = toX(source.point[1]);
      const cy = toY(source.point[0]);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, `rgba(255,255,255,${source.weight * 0.8})`);
      gradient.addColorStop(0.5, `rgba(255,255,255,${source.weight * 0.35})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (source.shape === "line") {
      const path = new Path2D();
      source.line.forEach(([lat, lng], index) => {
        if (index === 0) path.moveTo(toX(lng), toY(lat));
        else path.lineTo(toX(lng), toY(lat));
      });
      // Widening, fading strokes approximate a gaussian falloff; the wide
      // passes are what let parallel travel lines merge into one warm zone.
      const passes: Array<[number, number]> = [
        [1.2, 0.5],
        [2.6, 0.26],
        [4.5, 0.13],
      ];
      for (const [scale, alpha] of passes) {
        ctx.strokeStyle = `rgba(255,255,255,${source.weight * alpha})`;
        ctx.lineWidth = Math.max(2, source.widthM * scale * pxPerM);
        ctx.stroke(path);
      }
      continue;
    }

    const path = new Path2D();
    source.ring.forEach(([lat, lng], index) => {
      if (index === 0) path.moveTo(toX(lng), toY(lat));
      else path.lineTo(toX(lng), toY(lat));
    });
    path.closePath();
    ctx.fillStyle = `rgba(255,255,255,${source.weight * 0.5})`;
    ctx.fill(path);
    // Feather the hard polygon edge with two soft outline strokes.
    const feather: Array<[number, number]> = [
      [45, 0.26],
      [100, 0.13],
    ];
    for (const [featherM, alpha] of feather) {
      ctx.strokeStyle = `rgba(255,255,255,${source.weight * alpha})`;
      ctx.lineWidth = Math.max(2, featherM * pxPerM);
      ctx.stroke(path);
    }
  }

  // Colorize: intensity (red channel — additive white, so R=G=B) through the
  // ramp; alpha rises with heat but caps low enough to read the imagery under it.
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] / 255;
    if (value < MIN_VISIBLE) {
      data[i + 3] = 0;
      continue;
    }
    const t = Math.pow(Math.min(1, value), 0.7);
    const [r, g, b] = rampColor(t);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.round(255 * Math.min(0.68, t * 0.85) * intensity);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.putImageData(image, 0, 0);

  return {
    url: canvas.toDataURL("image/png"),
    bounds: [
      [south, west],
      [north, east],
    ],
  };
}

// Same cold-to-hot ramp as Camera Heat, so "red means deer" stays one idea
// across the app: amber → orange → red.
const RAMP_STOPS = [
  [242, 193, 78], // #f2c14e
  [239, 122, 36], // #ef7a24
  [209, 53, 43], // #d1352b
];

function rampColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (RAMP_STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = RAMP_STOPS[i];
  const b = RAMP_STOPS[Math.min(i + 1, RAMP_STOPS.length - 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}
