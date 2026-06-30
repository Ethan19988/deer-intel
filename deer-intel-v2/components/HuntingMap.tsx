"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
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
    <button
      onClick={locateUser}
      className="absolute top-4 right-4 z-[1000] rounded-xl bg-green-700 px-4 py-3 text-white shadow-lg"
    >
      Use My Location
    </button>
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
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#172016] border border-green-900 p-4 flex flex-wrap gap-3 items-center">
        <label className="text-sm text-green-300">
          Property
          <select
            className="ml-2 bg-[#263820] border border-green-800 rounded-xl p-2 text-white"
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

        <label className="text-sm text-green-300">
          Pin Type
          <select
            className="ml-2 bg-[#263820] border border-green-800 rounded-xl p-2 text-white"
            value={pinType}
            onChange={(event) => setPinType(event.target.value as PinType)}
          >
            {PIN_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <p className="text-sm text-gray-300">
          Tap the map to add a pin to {selectedProperty?.name ?? "a property"}.
        </p>
      </div>

      <div className="h-[600px] rounded-3xl overflow-hidden border border-green-900">
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

      <div className="rounded-2xl bg-[#172016] border border-green-900 p-4">
        <h2 className="text-xl font-semibold">Saved Pins</h2>
        <p className="text-gray-300 text-sm mt-1">
          Pins are saved in this browser for the selected property.
        </p>

        <div className="mt-3 space-y-2">
          {pins.length === 0 && (
            <p className="text-gray-400">No pins added yet.</p>
          )}

          {pins.map((pin) => (
            <div
              key={pin.id}
              className="rounded-xl bg-[#263820] p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <span>
                {pin.type} - {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
              <button
                onClick={() => deletePin(pin.id)}
                className="rounded-lg border border-red-900 bg-[#2b1515] px-3 py-2 text-sm text-red-100"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
