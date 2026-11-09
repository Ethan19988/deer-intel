"use client";

import { Fragment, useMemo, type CSSProperties } from "react";
import { CircleMarker, Marker, Polyline, Popup } from "react-leaflet";
import { divIcon, type DivIcon } from "leaflet";
import {
  corridorDirection,
  type CorridorEvidence,
  type CorridorLevel,
  type MovementCorridor,
  type MovementPeriod,
} from "@/lib/movementPrediction";
import type { DeerRoutePlan, LatLng, RouteFunnel } from "@/lib/movementGridTypes";
import {
  FUNNEL_COLOR,
  arrowMarks,
  funnelHeadline,
  funnelRadius,
  nearestStandLine,
  orientedPath,
  pathMidpoint,
  routeStyle,
  routeTravel,
  smoothPath,
  windLine,
} from "@/components/map/deerRoutesView";

type MovementLayerProps = {
  /** Terrain-aware routes; null while the grid loads or when it failed. */
  plan: DeerRoutePlan | null;
  period: MovementPeriod;
  /** Straight-line pin corridors, drawn only when there's no plan (grid error). */
  fallbackCorridors?: MovementCorridor[];
  /** Per-corridor camera evidence for the fallback, keyed by corridor id. */
  evidenceById?: Record<string, CorridorEvidence>;
  /** Off while another map mode owns taps, so a funnel tap never does two things. */
  interactive?: boolean;
  /** Starts the Stand pin placement flow at a funnel. */
  onDropStand?: (point: LatLng) => void;
};

// Predicted deer routes over the terrain (lib/deerRoutes): each route follows
// the cheapest walk from bed to food, drawn purple, heavier and brighter the
// more likely it is, dashed when it's a weak guess. Arrowheads show which way
// deer walk it right now (back to bed at dawn, out to food at dusk; none at
// midday/night). Camera-backed routes glow and carry a small camera tick.
// Funnels — where routes squeeze together — are orange rings sized by how many
// routes pass, and tap open a card with the next sit's wind and nearest stand.
export default function MovementLayer({
  plan,
  period,
  fallbackCorridors = [],
  evidenceById,
  interactive = true,
  onDropStand,
}: MovementLayerProps) {
  if (!plan) {
    return (
      <LegacyCorridors
        corridors={fallbackCorridors}
        period={period}
        evidenceById={evidenceById}
      />
    );
  }

  return (
    <>
      <RouteLines plan={plan} period={period} />
      {plan.funnels.map((funnel) => (
        <FunnelMarker
          key={funnel.id}
          funnel={funnel}
          interactive={interactive}
          onDropStand={onDropStand}
        />
      ))}
    </>
  );
}

function RouteLines({ plan, period }: { plan: DeerRoutePlan; period: MovementPeriod }) {
  const travel = routeTravel(period);
  // Smoothing + arrow placement only rerun when the routes or the period change.
  const drawn = useMemo(
    () =>
      // Weak routes first so strong ones paint on top.
      [...plan.routes]
        .sort((a, b) => a.strength - b.strength)
        .map((route) => {
          const smooth = smoothPath(route.path);
          const cameraBacked = Boolean(route.camera && route.camera.visits > 0);
          return {
            route,
            positions: smooth.map((p) => [p.lat, p.lng] as [number, number]),
            style: routeStyle(route.strength, cameraBacked),
            cameraBacked,
            arrows: travel ? arrowMarks(orientedPath(smooth, travel)) : [],
            tick: cameraBacked ? pathMidpoint(smooth) : null,
          };
        }),
    [plan.routes, travel],
  );

  return (
    <>
      {drawn.map(({ route, positions, style, cameraBacked, arrows, tick }) => (
        <Fragment key={route.id}>
          {cameraBacked ? (
            <Polyline
              positions={positions}
              pathOptions={{
                color: style.color,
                weight: style.weight + 6,
                opacity: 0.2,
                lineCap: "round",
                lineJoin: "round",
              }}
              interactive={false}
            />
          ) : null}
          <Polyline
            positions={positions}
            pathOptions={{
              color: style.color,
              weight: style.weight,
              opacity: style.opacity,
              dashArray: style.dashArray,
              lineCap: "round",
              lineJoin: "round",
            }}
            interactive={false}
          />
          {arrows.map((mark, index) => (
            <Marker
              key={`${route.id}-arrow-${index}`}
              position={[mark.point.lat, mark.point.lng]}
              icon={arrowIcon(mark.bearing, style.color, style.opacity)}
              interactive={false}
              keyboard={false}
            />
          ))}
          {tick ? (
            <Marker
              position={[tick.lat, tick.lng]}
              icon={cameraTickIcon()}
              interactive={false}
              keyboard={false}
              title={
                route.camera
                  ? `${route.camera.name} · ${route.camera.visits} deer visits`
                  : undefined
              }
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

function FunnelMarker({
  funnel,
  interactive,
  onDropStand,
}: {
  funnel: RouteFunnel;
  interactive: boolean;
  onDropStand?: (point: LatLng) => void;
}) {
  const radius = funnelRadius(funnel.routeCount);
  const wind = windLine(funnel.wind);

  return (
    <>
      {/* A wide, nearly invisible hit ring so the funnel is a ≥44px target. */}
      {interactive ? (
        <CircleMarker
          center={[funnel.point.lat, funnel.point.lng]}
          radius={Math.max(22, radius + 6)}
          pathOptions={{ stroke: false, fillOpacity: 0.001, bubblingMouseEvents: false }}
        >
          <Popup closeButton>
            <div style={cardStyle}>
              <p style={headStyle}>{funnelHeadline(funnel)}</p>
              {wind ? (
                <p style={{ ...lineStyle, color: funnel.wind?.ok ? "#2f7a3a" : "#b4361f" }}>
                  {wind}
                </p>
              ) : (
                <p style={mutedStyle}>Next sit&apos;s wind not in yet</p>
              )}
              <p style={lineStyle}>{nearestStandLine(funnel)}</p>
              {onDropStand ? (
                <button
                  type="button"
                  style={dropButtonStyle}
                  // The pending pin turns `interactive` off, which unmounts this
                  // hit ring and closes its popup along with it.
                  onClick={() => onDropStand(funnel.point)}
                >
                  Drop stand pin here
                </button>
              ) : null}
            </div>
          </Popup>
        </CircleMarker>
      ) : null}
      <CircleMarker
        center={[funnel.point.lat, funnel.point.lng]}
        radius={radius}
        pathOptions={{
          color: FUNNEL_COLOR,
          weight: 3,
          opacity: 0.95,
          fillColor: "#1a120c",
          fillOpacity: 0.35,
        }}
        interactive={false}
      />
      <CircleMarker
        center={[funnel.point.lat, funnel.point.lng]}
        radius={3}
        pathOptions={{
          stroke: false,
          fillColor: FUNNEL_COLOR,
          fillOpacity: 1,
        }}
        interactive={false}
      />
    </>
  );
}

// Divicons are cached per 5° bearing bin + color so a re-render reuses them.
const arrowIconCache = new Map<string, DivIcon>();

function arrowIcon(bearing: number, color: string, opacity: number): DivIcon {
  const bin = Math.round(bearing / 5) * 5;
  const key = `${bin}|${color}|${opacity}`;
  const cached = arrowIconCache.get(key);
  if (cached) return cached;
  const icon = divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<svg width="16" height="16" viewBox="0 0 16 16" style="transform:rotate(${bin}deg);opacity:${Math.max(0.7, opacity)};display:block" aria-hidden="true"><path d="M3 12 L8 3 L13 12 L8 9.5 Z" fill="${color}" stroke="#120b1a" stroke-width="1" stroke-linejoin="round"/></svg>`,
  });
  arrowIconCache.set(key, icon);
  return icon;
}

let cameraTick: DivIcon | null = null;

function cameraTickIcon(): DivIcon {
  if (!cameraTick) {
    cameraTick = divIcon({
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: `<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid #d8b4fe;border-radius:3px;background:rgba(17,12,24,0.9);font-size:10px;line-height:1" aria-hidden="true">📷</span>`,
    });
  }
  return cameraTick;
}

// --- Fallback: straight-line pin corridors -----------------------------------
// Drawn only when the terrain grid can't be read. The line traces the link; a
// filled dot marks the end deer are heading toward this time of day. Corridors
// backed by nearby camera hits at this period glow brighter (hot); quiet-camera
// corridors fade back (cold).

const CORRIDOR_COLOR = "#a855f7";
const CORRIDOR_HOT_COLOR = "#c084fc";

function LegacyCorridors({
  corridors,
  period,
  evidenceById,
}: {
  corridors: MovementCorridor[];
  period: MovementPeriod;
  evidenceById?: Record<string, CorridorEvidence>;
}) {
  if (corridors.length === 0) return null;

  const direction = corridorDirection(period);

  return (
    <>
      {corridors.map((corridor) => {
        const positions: Array<[number, number]> = [
          [corridor.bedding.lat, corridor.bedding.lng],
          [corridor.resource.lat, corridor.resource.lng],
        ];
        const destination =
          direction === "to-bedding"
            ? corridor.bedding
            : direction === "to-resource"
              ? corridor.resource
              : null;

        const level = evidenceById?.[corridor.id]?.level ?? "none";
        const style = corridorStyle(level, corridor.strength, direction);

        return (
          <Fragment key={corridor.id}>
            {level === "hot" ? (
              <Polyline
                positions={positions}
                pathOptions={{
                  color: CORRIDOR_HOT_COLOR,
                  weight: style.weight + 6,
                  opacity: 0.18,
                }}
                interactive={false}
              />
            ) : null}
            <Polyline
              positions={positions}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                opacity: style.opacity,
                dashArray: style.dashArray,
              }}
              interactive={false}
            />
            {destination ? (
              <CircleMarker
                center={[destination.lat, destination.lng]}
                radius={style.dotRadius}
                pathOptions={{
                  color: style.color,
                  weight: 1.5,
                  opacity: level === "cold" ? 0.5 : 0.9,
                  fillColor: style.color,
                  fillOpacity: level === "cold" ? 0.4 : 0.85,
                }}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function corridorStyle(
  level: CorridorLevel,
  strength: number,
  direction: "to-resource" | "to-bedding" | "two-way",
) {
  const baseWeight = 2 + strength * 3;
  const baseOpacity = 0.5 + strength * 0.35;
  const twoWayDash = direction === "two-way" ? "6 7" : undefined;

  if (level === "hot") {
    return {
      color: CORRIDOR_HOT_COLOR,
      weight: baseWeight + 2.5,
      opacity: 0.95,
      dashArray: twoWayDash,
      dotRadius: 6 + strength * 4,
    };
  }
  if (level === "warm") {
    return {
      color: CORRIDOR_COLOR,
      weight: baseWeight + 1,
      opacity: Math.max(baseOpacity, 0.78),
      dashArray: twoWayDash,
      dotRadius: 5 + strength * 3,
    };
  }
  if (level === "cold") {
    return {
      color: CORRIDOR_COLOR,
      weight: baseWeight,
      opacity: 0.3,
      dashArray: "3 7",
      dotRadius: 4 + strength * 2,
    };
  }
  return {
    color: CORRIDOR_COLOR,
    weight: baseWeight,
    opacity: baseOpacity,
    dashArray: twoWayDash,
    dotRadius: 5 + strength * 3,
  };
}

// Funnel popup: same light Leaflet popup as the Deer Heat explain card.
const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  maxWidth: 240,
  fontSize: 13,
  lineHeight: 1.4,
};

const headStyle: CSSProperties = {
  margin: 0,
  fontWeight: 800,
};

const lineStyle: CSSProperties = {
  margin: 0,
  fontWeight: 600,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 12,
};

const dropButtonStyle: CSSProperties = {
  minHeight: 44,
  marginTop: "0.25rem",
  padding: "0 0.75rem",
  border: "1px solid #111711",
  borderRadius: "var(--radius-sm)",
  background: "#111711",
  color: "#f1f5ef",
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  letterSpacing: "0.04em",
  cursor: "pointer",
};
