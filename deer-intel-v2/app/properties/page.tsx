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
import type { Property } from "@/types/property";

const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  name: "",
  county: "",
  acres: "",
  notes: "",
  coordinate: "",
};

export default function PropertiesPage() {
  const { properties } = useDeerIntelStore();

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
        <p style={eyebrowStyle}>Properties</p>
        <h1 style={titleStyle}>Properties</h1>
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
  gap: "0.35rem",
  marginBottom: "1.5rem",
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
