"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";

function ClickToAddPin({ pinType, pins, setPins }) {
  useMapEvents({
    click(e) {
      const newPin = {
        id: Date.now(),
        type: pinType,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };

      setPins([...pins, newPin]);
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
        alert("Could not get your location. Make sure location permission is allowed.");
      }
    );
  }

  return (
    <button
      onClick={locateUser}
      className="absolute top-4 right-4 z-[1000] rounded-xl bg-green-700 px-4 py-3 text-white shadow-lg"
    >
      📍 Use My Location
    </button>
  );
}
export default function HuntingMap() {
  const [pinType, setPinType] = useState("Trail Camera");
  const [pins, setPins] = useState([]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#172016] border border-green-900 p-4 flex flex-wrap gap-3 items-center">
        <label className="text-sm text-green-300">Pin Type</label>

        <select
          className="bg-[#263820] border border-green-800 rounded-xl p-2"
          value={pinType}
          onChange={(e) => setPinType(e.target.value)}
        >
          <option>Trail Camera</option>
          <option>Treestand</option>
          <option>Scrape</option>
          <option>Rub</option>
          <option>Buck Sighting</option>
          <option>Doe Sighting</option>
          <option>Vegetation</option>
          <option>Bedding Area</option>
          <option>Food Source</option>
          <option>Water Source</option>
          <option>Parking</option>
          <option>Access Route</option>
        </select>

        <p className="text-sm text-gray-300">
          Tap the map to add a pin.
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

  <ClickToAddPin pinType={pinType} pins={pins} setPins={setPins} />

  {pins.map((pin) => (
    <Marker key={pin.id} position={[pin.lat, pin.lng]}>
      <Popup>
        <strong>{pin.type}</strong>
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
          Pins are temporary for now. Next we’ll save them to your account.
        </p>

        <div className="mt-3 space-y-2">
          {pins.length === 0 && (
            <p className="text-gray-400">No pins added yet.</p>
          )}

          {pins.map((pin) => (
            <div key={pin.id} className="rounded-xl bg-[#263820] p-3">
              {pin.type} — {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}