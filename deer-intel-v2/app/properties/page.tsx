"use client";

import { useEffect, useState, type CSSProperties } from "react";
import PropertyCard, {
  type PropertyCardStats,
} from "@/components/properties/PropertyCard";
import { formatHuntDate } from "@/lib/hunts";
import { getPhotoBuckNames } from "@/lib/photos";
import PropertyForm, {
  type PropertyFormValues,
} from "@/components/properties/PropertyForm";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { MapPinIcon } from "@/components/ui/FieldIcons";
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
import type { Property } from "@/types/property";

const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  name: "",
  county: "",
  acres: "",
  notes: "",
  coordinate: "",
};

export default function PropertiesPage() {
  const { properties, cameras, stands, hunts, photoRecords } =
    useDeerIntelStore();

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

  // /properties?edit=<id> opens that property's edit form — the Today setup
  // checklist links here to add a missing center point. Read from
  // window.location after mount so the page needs no Suspense boundary.
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setPendingEditId(id);
  }, []);
  useEffect(() => {
    if (!pendingEditId) return;
    const target = properties.find((property) => property.id === pendingEditId);
    if (!target) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingEditId(null);
    startEditingProperty(target);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`property-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    // startEditingProperty only sets state; re-running on its identity isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditId, properties]);

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

  const propertiesTab =
    properties.length === 0 ? (
      <EmptyState
        illustration={<MapPinIcon size={30} />}
        title="No properties yet"
        description="Add your first hunting property from the Add property tab to unlock the map, stands, cameras, and hunt log."
      />
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
            stats={propertyStats(property.id)}
          />
        ))}
      </div>
    );

  function propertyStats(propertyId: string): PropertyCardStats {
    const propertyHunts = hunts.filter((hunt) => hunt.propertyId === propertyId);
    const sitDates = propertyHunts.map((hunt) => hunt.date).sort();
    const lastSit = sitDates[sitDates.length - 1];

    return {
      cameras: cameras.filter((camera) => camera.propertyId === propertyId).length,
      stands: stands.filter((stand) => stand.propertyId === propertyId).length,
      sits: propertyHunts.length,
      buckPhotos: photoRecords.filter(
        (photo) =>
          photo.propertyId === propertyId &&
          (getPhotoBuckNames(photo).length > 0 || /buck|antler/i.test(photo.species)),
      ).length,
      lastSitLabel: lastSit ? formatHuntDate(lastSit) : null,
    };
  }

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
      <header className="di-section-hero" style={headerStyle}>
        <div style={headerRowStyle}>
          <div style={headerLeadStyle}>
            <span style={headerIconStyle} aria-hidden="true">
              <MapPinIcon size={24} />
            </span>
            <div style={headerTitleWrapStyle}>
              <p style={eyebrowStyle}>Properties</p>
              <h1 style={titleStyle}>Properties</h1>
            </div>
          </div>
        </div>
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
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const headerLeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  minWidth: 0,
};

const headerIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  flex: "none",
  borderRadius: "14px",
  background: "rgba(243, 237, 217, 0.15)",
  border: "1px solid rgba(243, 237, 217, 0.35)",
  color: "#f6efd6",
};

const headerTitleWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  minWidth: 0,
};



const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "rgba(243, 237, 217, 0.82)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f6f0dc",
  fontSize: "2rem",
  lineHeight: 1.1,
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.5)",
};

const addCardStyle: CSSProperties = {
  padding: "1.25rem",
};

const propertyListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};
