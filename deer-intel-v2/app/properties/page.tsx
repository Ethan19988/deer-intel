"use client";

import { useState, type CSSProperties } from "react";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyForm, {
  type PropertyFormValues,
} from "@/components/properties/PropertyForm";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
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
  const propertyCount = properties.length;

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

  return (
    <PageShell maxWidth="980px">
      <PageHeader
        eyebrow="Property Management"
        title="Properties"
        description="Keep each hunting property organized with county, acres, and field notes that stay saved in this browser."
      />

      <Card
        as="section"
        variant="elevated"
        style={addPropertyCardStyle}
      >
        <Section
          eyebrow="New Property"
          title="Add Property"
          action={
            <Badge>
              {propertyCount} {propertyCount === 1 ? "property" : "properties"}
            </Badge>
          }
          style={nestedSectionStyle}
        >
          <PropertyForm
            values={newPropertyValues}
            submitLabel="Add Property"
            onChange={setNewPropertyValues}
            onSubmit={addProperty}
          />
        </Section>
      </Card>

      <Section
        id="your-properties-heading"
        eyebrow="Saved Properties"
        title="Your Properties"
      >
        {properties.length === 0 ? (
          <EmptyState description="No properties yet. Add your first hunting property above." />
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
        )}
      </Section>
    </PageShell>
  );
}

const addPropertyCardStyle: CSSProperties = {
  marginTop: "1.5rem",
};

const nestedSectionStyle: CSSProperties = {
  marginTop: 0,
};

const propertyListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};
