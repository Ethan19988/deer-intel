"use client";

import { useState, type CSSProperties } from "react";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyForm, {
  type PropertyFormValues,
} from "@/components/properties/PropertyForm";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import type { Property } from "@/types/property";

const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  name: "",
  county: "",
  acres: "",
  notes: "",
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

    const newProperty: Property = {
      id: createDeerIntelId("property"),
      name: trimmedName,
      county: newPropertyValues.county.trim() || "Unknown",
      acres: newPropertyValues.acres.trim() || "Unknown",
      notes: newPropertyValues.notes.trim() || "No notes yet.",
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

    saveProperties(
      properties.map((property) =>
        property.id === editingPropertyId
          ? {
              ...property,
              name: trimmedName,
              county: editValues.county.trim() || "Unknown",
              acres: editValues.acres.trim() || "Unknown",
              notes: editValues.notes.trim() || "No notes yet.",
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
        pins: currentState.pins.filter(
          (pin) => pin.propertyId !== propertyToDelete.id,
        ),
        hunts: currentState.hunts.filter(
          (hunt) => hunt.propertyId !== propertyToDelete.id,
        ),
      };
    });

    if (editingPropertyId === propertyToDelete.id) {
      cancelEditingProperty();
    }
  }

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <header style={pageHeaderStyle}>
          <p style={eyebrowStyle}>Property Management</p>
          <h1 style={pageTitleStyle}>Properties</h1>
          <p style={pageDescriptionStyle}>
            Keep each hunting property organized with region, acreage, and field
            notes that stay saved between browser sessions.
          </p>
        </header>

        <section style={sectionStyle} aria-labelledby="add-property-heading">
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>New Property</p>
              <h2 id="add-property-heading" style={sectionTitleStyle}>
                Add Property
              </h2>
            </div>
            <span style={countBadgeStyle}>
              {propertyCount} {propertyCount === 1 ? "property" : "properties"}
            </span>
          </div>

          <PropertyForm
            values={newPropertyValues}
            submitLabel="Add Property"
            onChange={setNewPropertyValues}
            onSubmit={addProperty}
          />
        </section>

        <section
          style={propertiesSectionStyle}
          aria-labelledby="your-properties-heading"
        >
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Saved Properties</p>
              <h2 id="your-properties-heading" style={sectionTitleStyle}>
                Your Properties
              </h2>
            </div>
          </div>

          {properties.length === 0 ? (
            <p style={emptyStateStyle}>
              No properties yet. Add your first hunting property above.
            </p>
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
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  background: "#050806",
  color: "white",
};

const contentStyle: CSSProperties = {
  width: "100%",
  maxWidth: "980px",
  margin: "0 auto",
};

const pageHeaderStyle: CSSProperties = {
  marginBottom: "1.5rem",
};

const pageTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "2.25rem",
  lineHeight: 1.1,
};

const pageDescriptionStyle: CSSProperties = {
  maxWidth: "640px",
  margin: "0.85rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.6,
};

const sectionStyle: CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
};

const propertiesSectionStyle: CSSProperties = {
  marginTop: "1.5rem",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.2,
};

const countBadgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "0.4rem 0.7rem",
  border: "1px solid #2d402d",
  borderRadius: "8px",
  background: "#101a10",
  color: "#c6d5c5",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const propertyListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const emptyStateStyle: CSSProperties = {
  margin: 0,
  padding: "1.25rem",
  border: "1px dashed #334533",
  borderRadius: "8px",
  background: "#0d120d",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
