"use client";

import type { CSSProperties } from "react";
import type { DeerRoutePlan, LatLng } from "@/lib/movementGridTypes";
import {
  funnelHeadline,
  rankedStandFits,
  standFitLine,
  topFunnels,
  windLine,
} from "@/components/map/deerRoutesView";

export type DeerRoutesStatus = "idle" | "loading" | "ready" | "error";

type DeerRoutesPanelProps = {
  status: DeerRoutesStatus;
  plan: DeerRoutePlan | null;
  /** Fly the map to a funnel. */
  onSelect: (point: LatLng) => void;
  /** Controlled by the map so a phone shows one bottom card at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// The read-out for the Movement layer's terrain routes: the top three funnels
// (tap to fly there), how each saved stand sits on the routes with the next
// sit's wind, and the planner's caveats. Lives in the map's corner stack with
// Scout Picks and the legend, dark and square like the other imagery cards,
// and folds to its header so it never buries the map on a phone.
export default function DeerRoutesPanel({
  status,
  plan,
  onSelect,
  open,
  onOpenChange,
}: DeerRoutesPanelProps) {
  const routeCount = plan?.routes.length ?? 0;
  const funnels = plan ? topFunnels(plan.funnels, 3) : [];
  const stands = plan ? rankedStandFits(plan.stands) : [];

  const summary =
    status === "loading"
      ? "…"
      : status === "error"
        ? "!"
        : `${routeCount}`;

  return (
    <div style={wrapStyle} onDoubleClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        style={headerStyle}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span style={titleStyle}>Deer routes</span>
        <span style={countStyle}>
          {open ? "▾" : `${summary} ${routeCount === 1 ? "route" : "routes"} ▸`}
        </span>
      </button>

      {open ? (
        <div style={bodyStyle}>
          {status === "loading" || status === "idle" ? (
            <p style={statusStyle}>Reading terrain and land cover…</p>
          ) : null}
          {status === "error" ? (
            <p style={statusStyle}>
              Couldn&apos;t read the terrain here. Showing straight-line routes
              from your pins instead.
            </p>
          ) : null}

          {status === "ready" && plan && routeCount === 0 ? (
            <p style={statusStyle}>
              No routes yet. Mark a Bedding or Food pin, or draw the hunt area.
            </p>
          ) : null}

          {funnels.length > 0 ? (
            <div style={groupStyle}>
              <p style={labelStyle}>Top funnels</p>
              {funnels.map((funnel, index) => {
                const wind = windLine(funnel.wind);
                return (
                  <button
                    key={funnel.id}
                    type="button"
                    style={rowStyle}
                    onClick={() => onSelect(funnel.point)}
                  >
                    <span style={rankStyle}>{index + 1}</span>
                    <span style={rowBodyStyle}>
                      <span style={rowTitleStyle}>{funnelHeadline(funnel)}</span>
                      {wind ? (
                        <span
                          style={{
                            ...rowMetaStyle,
                            color: funnel.wind?.ok ? GOOD : WARN,
                          }}
                        >
                          {wind}
                        </span>
                      ) : null}
                      {funnel.nearestStand ? (
                        <span style={rowMetaStyle}>
                          {funnel.nearestStand.name} ·{" "}
                          {Math.round(funnel.nearestStand.yards)} yd
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {stands.length > 0 ? (
            <div style={groupStyle}>
              <p style={labelStyle}>Your stands</p>
              {stands.map((fit) => (
                <p
                  key={fit.standId}
                  style={{
                    ...standLineStyle,
                    color: fit.wind && !fit.wind.ok ? WARN : "#dbe6d7",
                  }}
                  title={fit.wind?.note}
                >
                  {standFitLine(fit)}
                </p>
              ))}
            </div>
          ) : null}

          {plan && plan.notes.length > 0 ? (
            <div style={notesStyle}>
              {plan.notes.map((note) => (
                <p key={note} style={noteStyle}>
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// On-imagery palette, matching Scout Picks and the legend.
const GOOD = "#9fd59b";
const WARN = "#f0a07a";

const wrapStyle: CSSProperties = {
  position: "absolute",
  bottom: "1.4rem",
  right: "1rem",
  zIndex: 1050,
  pointerEvents: "auto",
  width: "min(280px, calc(100% - 2rem))",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(17, 23, 17, 0.82)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  width: "100%",
  minHeight: 44,
  padding: "0 0.75rem",
  border: "none",
  background: "transparent",
  color: "#f1f5ef",
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const countStyle: CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.72rem",
  color: "#c6d5c5",
  textTransform: "uppercase",
};

const bodyStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  maxHeight: "min(42vh, 320px)",
  overflowY: "auto",
  padding: "0 0.5rem 0.55rem",
};

const statusStyle: CSSProperties = {
  margin: 0,
  padding: "0 0.25rem",
  color: "#cdd8c9",
  fontSize: "0.76rem",
  lineHeight: 1.35,
};

const groupStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
};

const labelStyle: CSSProperties = {
  margin: 0,
  padding: "0 0.25rem",
  color: "#a9bda6",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.64rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  width: "100%",
  minHeight: 44,
  padding: "0.45rem 0.5rem",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#eaf0e6",
  cursor: "pointer",
  textAlign: "left",
};

const rankStyle: CSSProperties = {
  flex: "0 0 auto",
  minWidth: "1.1rem",
  color: "#ff9a5c",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.82rem",
};

const rowBodyStyle: CSSProperties = {
  display: "grid",
  gap: "0.12rem",
  minWidth: 0,
};

const rowTitleStyle: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 700,
  lineHeight: 1.25,
};

const rowMetaStyle: CSSProperties = {
  color: "#c9d6c6",
  fontSize: "0.72rem",
  lineHeight: 1.3,
};

const standLineStyle: CSSProperties = {
  margin: 0,
  padding: "0 0.25rem",
  fontSize: "0.74rem",
  lineHeight: 1.35,
};

const notesStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  paddingTop: "0.35rem",
  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
};

const noteStyle: CSSProperties = {
  margin: 0,
  padding: "0 0.25rem",
  color: "#a9bda6",
  fontSize: "0.7rem",
  lineHeight: 1.3,
};
