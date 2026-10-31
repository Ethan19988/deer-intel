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
import PageHeader from "@/components/ui/PageHeader";
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
import { deleteFile } from "@/lib/fileStore";
import { deletePhotoImage } from "@/lib/imageStore";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { Property } from "@/types/property";
import {
  cascadeSummary,
  describePropertyCascade,
  removePropertyFromState,
  type PropertyCascade,
} from "./propertyCascade";

const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  name: "",
  county: "",
  acres: "",
  notes: "",
  coordinate: "",
};

export default function PropertiesPage() {
  const state = useDeerIntelStore();
  const { properties, cameras, stands, hunts, photoRecords } = state;

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

  // Delete asks first (with counts of what goes with it), then removes the
  // property, everything filed under it, and the stored photo and document
  // files so they don't linger in device storage.
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(
    null,
  );
  const deletingProperty = deletingPropertyId
    ? properties.find((property) => property.id === deletingPropertyId)
    : undefined;
  const deletingSummary = deletingProperty
    ? cascadeSummary(describePropertyCascade(state, deletingProperty.id).counts)
    : "";

  function deleteProperty(propertyId: string) {
    setDeletingPropertyId(propertyId);
  }

  function confirmDeleteProperty() {
    const propertyId = deletingPropertyId;
    setDeletingPropertyId(null);

    if (!propertyId) return;

    // Filled in by the updater (it runs synchronously) from the latest state.
    const result: {
      cascade: PropertyCascade | null;
      remaining: DeerIntelState | null;
    } = { cascade: null, remaining: null };

    updateDeerIntelStore((currentState) => {
      const nextState = removePropertyFromState(currentState, propertyId);
      result.cascade = describePropertyCascade(currentState, propertyId);
      result.remaining = nextState;
      return nextState;
    });

    const { cascade, remaining } = result;

    if (cascade && remaining) {
      // Another record could share a blob id (e.g. a restored backup); only
      // delete files nothing left in the store still points at.
      const stillUsedImages = new Set(
        remaining.photoRecords.map((photo) => photo.imageId ?? ""),
      );
      const stillUsedFiles = new Set(
        remaining.documents.map((document) => document.fileId),
      );

      for (const imageId of cascade.imageIds) {
        if (!stillUsedImages.has(imageId)) void deletePhotoImage(imageId);
      }
      for (const fileId of cascade.fileIds) {
        if (!stillUsedFiles.has(fileId)) {
          void deleteFile(fileId).catch(() => undefined);
        }
      }
    }

    if (editingPropertyId === propertyId) {
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
      <PageHeader
        eyebrow="Your ground"
        title="Properties"
        meta={
          properties.length > 0
            ? `${properties.length} ${properties.length === 1 ? "property" : "properties"} · ${stands.length} stands · ${cameras.length} cameras`
            : undefined
        }
      />

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

      <ConfirmDialog
        open={Boolean(deletingProperty)}
        title={`Delete ${deletingProperty?.name ?? "this property"}?`}
        description={
          deletingSummary
            ? `This also deletes its ${deletingSummary}, including stored photo and document files. It can't be undone.`
            : "Nothing else is filed under this property. It can't be undone."
        }
        confirmLabel="Delete property"
        confirmVariant="danger"
        onCancel={() => setDeletingPropertyId(null)}
        onConfirm={confirmDeleteProperty}
      />
    </PageShell>
  );
}

const addCardStyle: CSSProperties = {
  padding: "1.25rem",
};

const propertyListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};
