"use client";

// Phase-1 manual trigger for the auto-1m terrain backend. Drop it into the
// property page's "High-Res Terrain (LiDAR)" card:
//
//   <GenerateHighResButton
//     property={{ id: p.id, name: p.name, huntArea: p.huntArea }}
//   />
//
// It renders nothing unless cloud sync is configured AND the user is signed in
// (state "off"), so local-only deployments never see it — same inertness as the
// rest of the cloud layer.

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { HuntAreaPoint } from "@/types/property";
import {
  getHighResStatus,
  requestHighResRead,
  type TerrainJobState,
} from "@/lib/terrainJobs";
import { clearTerrainSetCache } from "@/lib/useTerrainSet";

type Props = {
  property: { id: string; name?: string; huntArea?: HuntAreaPoint[]; food?: HuntAreaPoint[] };
};

const POLL_MS = 15_000;

const LABEL: Record<TerrainJobState, string> = {
  off: "",
  none: "Not generated yet",
  queued: "Queued…",
  running: "Reading LiDAR…",
  error: "Failed — try again",
  ready: "High-res ready",
};

const BADGE: Partial<Record<TerrainJobState, "default" | "success" | "warning" | "danger">> = {
  none: "default",
  queued: "warning",
  running: "warning",
  error: "danger",
  ready: "success",
};

export default function GenerateHighResButton({ property }: Props) {
  const [state, setState] = useState<TerrainJobState>("off");
  const [stage, setStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { state: next, stage: s } = await getHighResStatus(property.id);
    setState(next);
    setStage(s ?? null);
    if (next === "ready") {
      clearTerrainSetCache(); // so the map swaps 10 m → 1 m
      stopPolling();
    }
    if (next !== "queued" && next !== "running") stopPolling();
    return next;
  }, [property.id, stopPolling]);

  // Initial state + poll while a job is in flight.
  useEffect(() => {
    let active = true;
    (async () => {
      const { state: next, stage: s } = await getHighResStatus(property.id);
      if (!active) return;
      setState(next);
      setStage(s ?? null);
      if (next === "queued" || next === "running") {
        timer.current = setInterval(refresh, POLL_MS);
      }
    })();
    return () => {
      active = false;
      stopPolling();
    };
  }, [property.id, refresh, stopPolling]);

  const onClick = useCallback(async () => {
    setBusy(true);
    setNote(null);
    const result = await requestHighResRead({
      id: property.id,
      name: property.name,
      huntArea: property.huntArea ?? [],
      food: property.food,
    });
    setBusy(false);
    if (result.message) setNote(result.message);
    if (result.state === "queued" || result.state === "running" || result.state === "ready") {
      setState(result.state);
      if (result.state !== "ready" && !timer.current) {
        timer.current = setInterval(refresh, POLL_MS);
      }
      if (result.state === "ready") clearTerrainSetCache();
    } else if (result.state === "error") {
      setState("error");
    }
  }, [property.id, property.name, property.huntArea, property.food, refresh]);

  // Inert unless cloud sync is on and the user is signed in.
  if (state === "off") return null;

  const inFlight = state === "queued" || state === "running";
  const canDraw = (property.huntArea?.length ?? 0) >= 3;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Button
        variant="secondary"
        onClick={onClick}
        disabled={busy || inFlight || !canDraw}
      >
        {inFlight ? "Generating…" : state === "ready" ? "Regenerate 1 m read" : "Generate high-res read"}
      </Button>
      {BADGE[state] ? (
        <Badge variant={BADGE[state]}>
          {state === "running" && stage ? stage : LABEL[state]}
        </Badge>
      ) : null}
      {!canDraw ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Draw a hunt area first.</span>
      ) : null}
      {note ? <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{note}</span> : null}
    </div>
  );
}
