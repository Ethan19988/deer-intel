"use client";

import "leaflet/dist/leaflet.css";
import { useState, type CSSProperties } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  createDeerIntelId,
  PIN_TYPES,
  type PinType,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

type ClickToAddPinProps = {
  pinType: PinType;
  propertyId: string;
  onAddPin: (pinType: PinType, lat: number, lng: number) => void;
};

type MapClickEvent = {
  latlng: {
    lat: number;
    lng: number;
  };
};

function ClickToAddPin({
  pinType,
  propertyId,
  onAddPin,
}: ClickToAddPinProps) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!propertyId) return;

      onAddPin(pinType, event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function LocateButton() {
  const map = useMap();

  function locateUser() {
    if (!navigator.geolocation) {
      alert("GPS is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], 16);
      },
      () => {
        alert(
          "Could not get your location. Make sure location permission is allowed.",
        );
      },
    );
  }

  return (
    <Button
      type="button"
      onClick={locateUser}
      style={locateButtonStyle}
    >
      Use My Location
    </Button>
  );
}

export default function HuntingMap() {
  const state = useDeerIntelStore();
  const [pinType, setPinType] = useState<PinType>(PIN_TYPES[0]);

  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const pins = state.pins.filter(
    (pin) => pin.propertyId === selectedPropertyId,
  );

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  function addPin(type: PinType, lat: number, lng: number) {
    if (!selectedPropertyId) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: [
        ...currentState.pins,
        {
          id: createDeerIntelId("pin"),
          propertyId: selectedPropertyId,
          type,
          lat,
          lng,
          createdAt: new Date().toISOString(),
          notes: "",
        },
      ],
    }));
  }

  function deletePin(pinId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: currentState.pins.filter((pin) => pin.id !== pinId),
    }));
  }

  return (
    <div style={mapLayoutStyle}>
      <Card as="div" style={toolbarStyle}>
        <label style={fieldStyle}>
          <span style={labelTextStyle}>Property</span>
          <select
            style={selectStyle}
            value={selectedPropertyId}
            onChange={(event) => selectProperty(event.target.value)}
          >
            {state.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelTextStyle}>Pin</span>
          <select
            style={selectStyle}
            value={pinType}
            onChange={(event) => setPinType(event.target.value as PinType)}
          >
            {PIN_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <p style={helpTextStyle}>
          Tap the map to add a pin to {selectedProperty?.name ?? "a property"}.
        </p>
      </Card>

      <div style={mapFrameStyle}>
        <MapContainer
          center={[40.9, -77.8]}
          zoom={8}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <LocateButton />

          <ClickToAddPin
            pinType={pinType}
            propertyId={selectedPropertyId}
            onAddPin={addPin}
          />

          {pins.map((pin) => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]}>
              <Popup>
                <strong>{pin.type}</strong>
                <br />
                {selectedProperty?.name}
                <br />
                Lat: {pin.lat.toFixed(5)}
                <br />
                Lng: {pin.lng.toFixed(5)}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <Card as="section">
        <h2 style={sectionTitleStyle}>Saved Pins</h2>
        <p style={helpTextStyle}>
          Pins are saved in this browser for the selected property.
        </p>

        <div style={pinListStyle}>
          {pins.length === 0 && (
            <EmptyState description="No pins added yet. Tap the map to save the first one." />
          )}

          {pins.map((pin) => (
            <div key={pin.id} style={pinRowStyle}>
              <span>
                {pin.type} - {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={() => deletePin(pin.id)}
                style={deleteButtonStyle}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const mapLayoutStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "1rem",
  alignItems: "flex-end",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const labelTextStyle: CSSProperties = {
  color: "#85a984",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  minHeight: "46px",
  minWidth: "190px",
  padding: "0.7rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#070a07",
  color: "white",
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  fontSize: "1rem",
  lineHeight: 1.5,
};

const mapFrameStyle: CSSProperties = {
  height: "600px",
  overflow: "hidden",
  border: "1px solid #243224",
  borderRadius: "8px",
};

const locateButtonStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  right: "1rem",
  zIndex: 1000,
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.3)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.45rem",
  lineHeight: 1.2,
};

const pinListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
};

const pinRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  padding: "0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "#f1f5ef",
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.55rem 0.75rem",
  fontSize: "0.9rem",
};
