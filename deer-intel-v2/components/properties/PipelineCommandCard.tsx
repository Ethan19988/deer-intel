"use client";

import { useState, type CSSProperties } from "react";
import Card from "@/components/ui/Card";
import {
  buildPipelineInvocation,
  type Coord,
} from "@/lib/terrainPipeline";

type PipelineCommandCardProps = {
  propertyName: string;
  center: Coord | null;
  extraCoords?: Coord[];
};

// Hands the hunter the exact offline pipeline command for this property. The
// pipeline itself runs on a Linux box (GDAL + WhiteboxTools + 1 m LiDAR), so the
// app's job is to bridge to it: compute the bounding box from where the property
// sits and format the run.sh call to copy-paste. After it runs and the generated
// JSON is committed, the map upgrades this property from the live 10 m read to a
// sharp 1 m read automatically.
export default function PipelineCommandCard({
  propertyName,
  center,
  extraCoords = [],
}: PipelineCommandCardProps) {
  const invocation = buildPipelineInvocation(propertyName, center, extraCoords);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!invocation) return;
    try {
      await navigator.clipboard.writeText(invocation.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!invocation) {
    return (
      <Card as="div" variant="subtle" style={cardStyle}>
        <p style={mutedStyle}>
          Add a saved location, a map pin, or a camera to this property first —
          the terrain pipeline needs a spot to analyze.
        </p>
      </Card>
    );
  }

  return (
    <Card as="div" variant="subtle" style={cardStyle}>
      <p style={mutedStyle}>
        This property already shows a live <strong>10&nbsp;m</strong> terrain read
        on the map. For a sharp <strong>1&nbsp;m</strong> LiDAR read, run the
        pipeline on your Linux box (GDAL&nbsp;+&nbsp;WhiteboxTools), then commit
        the generated{" "}
        <code style={inlineCodeStyle}>
          terrain_movement.{invocation.slug}.json
        </code>{" "}
        — the map upgrades this property automatically.
      </p>

      <div style={commandRowStyle}>
        <code style={commandStyle}>{invocation.command}</code>
        <button type="button" style={copyButtonStyle} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p style={hintStyle}>
        Run it from <code style={inlineCodeStyle}>pipeline/terrain/</code> in the
        repo. Bounding box: {invocation.minLat}, {invocation.minLng} →{" "}
        {invocation.maxLat}, {invocation.maxLng}.
      </p>
    </Card>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const commandRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const commandStyle: CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
  padding: "0.7rem 0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-3)",
  color: "var(--text)",
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "0.86rem",
  overflowX: "auto",
  whiteSpace: "nowrap",
};

const copyButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  minHeight: "44px",
  padding: "0.5rem 1.1rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.82rem",
  lineHeight: 1.5,
};

const inlineCodeStyle: CSSProperties = {
  padding: "0.05rem 0.35rem",
  borderRadius: "5px",
  background: "var(--surface-3)",
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "0.85em",
};
