"use client";

import { useState, type CSSProperties } from "react";
import PipelineCommandCard from "@/components/properties/PipelineCommandCard";
import GenerateHighResButton from "@/components/terrain/GenerateHighResButton";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { PIN_LAYER_LOOKUP } from "@/lib/propertyMap";
import { buildPipelineManifest, type Coord } from "@/lib/terrainPipeline";
import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";

// Settings → Advanced. The LiDAR terrain tools used to sit on the property
// Overview and the Properties list; they're developer-facing, so they live here
// now and the hunting screens stay about hunting.
export default function TerrainToolsManager() {
  const state = useDeerIntelStore();
  const [exportMessage, setExportMessage] = useState("");
  const property =
    state.properties.find((item) => item.id === state.selectedPropertyId) ??
    state.properties[0];

  function locate(propertyId: string) {
    const pins = state.pins.filter((pin) => pin.propertyId === propertyId);
    const cameras = state.cameras.filter((camera) => camera.propertyId === propertyId);
    return { pins, cameras, extraCoords: extraCoordsFor(pins, cameras) };
  }

  function exportPipelineManifest() {
    const manifest = buildPipelineManifest(
      state.properties.map((item) => {
        const { pins, cameras, extraCoords } = locate(item.id);
        return {
          name: item.name,
          center: resolvePropertyWeatherPoint(item, cameras, pins),
          extraCoords,
        };
      }),
    );

    if (manifest.length === 0) {
      setExportMessage(
        "No property has a location yet — add a coordinate or a map pin first.",
      );
      return;
    }

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "properties.json";
    link.click();
    URL.revokeObjectURL(url);
    setExportMessage(
      `Exported ${manifest.length} propert${
        manifest.length === 1 ? "y" : "ies"
      }. Run ./run_all.sh properties.json in pipeline/terrain/.`,
    );
  }

  if (!property) {
    return (
      <Section eyebrow="Advanced" title="High-Res Terrain (LiDAR)">
        <Card as="div" variant="subtle">
          <p style={mutedStyle}>Add a property to use the terrain tools.</p>
        </Card>
      </Section>
    );
  }

  const { pins, cameras, extraCoords } = locate(property.id);
  const food = pins
    .filter((pin) => PIN_LAYER_LOOKUP[pin.type] === "food")
    .map((pin) => ({ lat: pin.lat, lng: pin.lng }));

  return (
    <>
      <Section
        eyebrow="Advanced"
        title={`High-Res Terrain (LiDAR) — ${property.name}`}
      >
        <Card as="div" variant="subtle" style={stackStyle}>
          <p style={mutedStyle}>
            Generate detailed 1 m terrain for the property selected in the
            header. Switch properties up top to work on a different one.
          </p>
          <PipelineCommandCard
            propertyName={property.name}
            center={resolvePropertyWeatherPoint(property, cameras, pins)}
            extraCoords={extraCoords}
          />
          <GenerateHighResButton
            property={{
              id: property.id,
              name: property.name,
              huntArea: property.huntArea,
              food,
            }}
          />
        </Card>
      </Section>

      <Section eyebrow="Advanced" title="Terrain pipeline manifest">
        <Card as="div" variant="subtle" style={stackStyle}>
          <p style={mutedStyle}>
            Download one manifest covering every property with a location, then
            run the offline LiDAR pipeline over all of them at once.
          </p>
          <div>
            <Button type="button" variant="secondary" onClick={exportPipelineManifest}>
              Export for terrain pipeline
            </Button>
          </div>
          {exportMessage ? <p style={mutedStyle}>{exportMessage}</p> : null}
        </Card>
      </Section>
    </>
  );
}

function extraCoordsFor(pins: MapPin[], cameras: Camera[]): Coord[] {
  return [
    ...pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
    ...cameras
      .filter(
        (camera) =>
          typeof camera.latitude === "number" &&
          typeof camera.longitude === "number",
      )
      .map((camera) => ({
        lat: camera.latitude as number,
        lng: camera.longitude as number,
      })),
  ];
}

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
