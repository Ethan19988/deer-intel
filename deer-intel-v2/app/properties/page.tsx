"use client";

import { useState, type CSSProperties } from "react";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyForm, {
  type PropertyFormValues,
} from "@/components/properties/PropertyForm";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageShell from "@/components/ui/PageShell";
import Tabs from "@/components/ui/Tabs";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  formatPropertyCoordinate,
  parsePropertyCoordinate,
} from "@/lib/propertyLocation";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { buildPipelineManifest } from "@/lib/terrainPipeline";
import type { Property } from "@/types/property";

const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  name: "",
  county: "",
  acres: "",
  notes: "",
  coordinate: "",
};

export default function PropertiesPage() {
  const { properties, cameras, pins } = useDeerIntelStore();

  const [exportMessage, setExportMessage] = useState("");

  const [newPropertyValues, setNewPropertyValues] =
    useState<PropertyFormValues>(EMPTY_PROPERTY_FORM_VALUES);

  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null,
  );
  const [editValues, setEditValues] = useState<PropertyFormValues>(
    EMPTY_PROPERTY_FORM_VALUES,
  );

  function saveProperties(nextProperties: Property[]) {
    updateDeerIntelStore((currentState) => {
      const selectedPropertyExists = nextProperties.some(
        (property) => property.id === currentState.selectedPropertyId,
      );

      return {
        ...currentState,
        properties: nextProperties,
        selectedPropertyId: selectedPropertyExists
          ? currentState.selectedPropertyId
          : nextProperties[0]?.id ?? "",
      };
    });
  }

  function addProperty() {
    const trimmedName = newPropertyValues.name.trim();

    if (!trimmedName) return;

    const coordinate = parsePropertyCoordinate(newPropertyValues.coordinate);
    const newProperty: Property = {
      id: createDeerIntelId("property"),
      name: trimmedName,
      county: newPropertyValues.county.trim() || "Unknown",
      acres: newPropertyValues.acres.trim() || "Unknown",
      notes: newPropertyValues.notes.trim() || "No notes yet.",
      ...(coordinate
        ? { latitude: coordinate.latitude, longitude: coordinate.longitude }
        : {}),
    };

    saveProperties([...properties, newProperty]);
    setNewPropertyValues(EMPTY_PROPERTY_FORM_VALUES);
  }

  function startEditingProperty(property: Property) {
    setEditingPropertyId(property.id);
    setEditValues({
      name: property.name,
      county: property.county,
      acres: property.acres,
      notes: property.notes,
      coordinate: formatPropertyCoordinate(property),
    });
  }

  function cancelEditingProperty() {
    setEditingPropertyId(null);
    setEditValues(EMPTY_PROPERTY_FORM_VALUES);
  }

  function saveEditedProperty() {
    if (editingPropertyId === null) return;

    const trimmedName = editValues.name.trim();

    if (!trimmedName) return;

    const coordinate = parsePropertyCoordinate(editValues.coordinate);

    saveProperties(
      properties.map((property) =>
        property.id === editingPropertyId
          ? {
              ...property,
              name: trimmedName,
              county: editValues.county.trim() || "Unknown",
              acres: editValues.acres.trim() || "Unknown",
              notes: editValues.notes.trim() || "No notes yet.",
              latitude: coordinate?.latitude,
              longitude: coordinate?.longitude,
            }
          : property,
      ),
    );

    cancelEditingProperty();
  }

  function deleteProperty(propertyId: string) {
    const propertyToDelete = properties.find(
      (property) => property.id === propertyId,
    );

    if (!propertyToDelete) return;
    if (!window.confirm(`Delete ${propertyToDelete.name}?`)) return;

    updateDeerIntelStore((currentState) => {
      const nextProperties = currentState.properties.filter(
        (property) => property.id !== propertyToDelete.id,
      );
      const selectedPropertyExists = nextProperties.some(
        (property) => property.id === currentState.selectedPropertyId,
      );

      return {
        ...currentState,
        properties: nextProperties,
        selectedPropertyId: selectedPropertyExists
          ? currentState.selectedPropertyId
          : nextProperties[0]?.id ?? "",
        cameras: currentState.cameras.filter(
          (camera) => camera.propertyId !== propertyToDelete.id,
        ),
        cameraChecks: currentState.cameraChecks.filter(
          (check) => check.propertyId !== propertyToDelete.id,
        ),
        stands: currentState.stands.filter(
          (stand) => stand.propertyId !== propertyToDelete.id,
        ),
        pins: currentState.pins.filter(
          (pin) => pin.propertyId !== propertyToDelete.id,
        ),
        hunts: currentState.hunts.filter(
          (hunt) => hunt.propertyId !== propertyToDelete.id,
        ),
        photoRecords: currentState.photoRecords.filter(
          (photo) => photo.propertyId !== propertyToDelete.id,
        ),
        deerProfiles: currentState.deerProfiles.filter(
          (profile) => profile.propertyId !== propertyToDelete.id,
        ),
      };
    });

    if (editingPropertyId === propertyToDelete.id) {
      cancelEditingProperty();
    }
  }

  function exportPipelineManifest() {
    const manifest = buildPipelineManifest(
      properties.map((property) => {
        const propertyPins = pins.filter(
          (pin) => pin.propertyId === property.id,
        );
        const propertyCameras = cameras.filter(
          (camera) => camera.propertyId === property.id,
        );
        return {
          name: property.name,
          center: resolvePropertyWeatherPoint(
            property,
            propertyCameras,
            propertyPins,
          ),
          extraCoords: [
            ...propertyPins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
            ...propertyCameras
              .filter(
                (camera) =>
                  typeof camera.latitude === "number" &&
                  typeof camera.longitude === "number",
              )
              .map((camera) => ({
                lat: camera.latitude as number,
                lng: camera.longitude as number,
              })),
          ],
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

  const propertiesTab =
    properties.length === 0 ? (
      <EmptyState description="No properties yet. Add your first hunting property from the Add property tab." />
    ) : (
      <div style={propertyListStyle}>
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            isEditing={editingPropertyId === property.id}
            editValues={editValues}
            onEditValuesChange={setEditValues}
            onStartEditing={startEditingProperty}
            onSave={saveEditedProperty}
            onCancel={cancelEditingProperty}
            onDelete={deleteProperty}
          />
        ))}
      </div>
    );

  const addTab = (
    <Card as="section" variant="elevated" style={addCardStyle}>
      <PropertyForm
        values={newPropertyValues}
        submitLabel="Add Property"
        onChange={setNewPropertyValues}
        onSubmit={addProperty}
      />
    </Card>
  );

  return (
    <PageShell maxWidth="980px">
      <header style={headerStyle}>
        <div style={headerRowStyle}>
          <div>
            <p style={eyebrowStyle}>Properties</p>
            <h1 style={titleStyle}>Properties</h1>
          </div>
          {properties.length > 0 ? (
            <button
              type="button"
              style={exportButtonStyle}
              onClick={exportPipelineManifest}
              title="Download a manifest to run the terrain LiDAR pipeline for every located property"
            >
              Export for terrain pipeline
            </button>
          ) : null}
        </div>
        {exportMessage ? <p style={exportMessageStyle}>{exportMessage}</p> : null}
      </header>

      <Tabs
        items={[
          {
            id: "properties",
            label: "Your properties",
            badge: properties.length,
            content: propertiesTab,
          },
          { id: "add", label: "Add property", content: addTab },
        ]}
      />
    </PageShell>
  );
}

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  marginBottom: "1.5rem",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const exportButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.6rem 0.95rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontWeight: 800,
  cursor: "pointer",
};

const exportMessageStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  lineHeight: 1.1,
};

const addCardStyle: CSSProperties = {
  padding: "1.25rem",
};

const propertyListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};
