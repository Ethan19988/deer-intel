import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";
import type { WeatherCoordinate } from "@/types/weather";

// Properties have no coordinate of their own yet, so we resolve one from the
// assets the hunter has already placed. Map pins are preferred (they mark real
// field locations); cameras are the fallback. The averaged point is a good
// "center of activity" for a property-level weather lookup.

type ResolvePropertyCoordinateInput = {
  pins: MapPin[];
  cameras: Camera[];
};

export function resolvePropertyCoordinate({
  pins,
  cameras,
}: ResolvePropertyCoordinateInput): WeatherCoordinate | null {
  const pinPoints = pins
    .filter((pin) => isFiniteCoordinate(pin.lat, pin.lng))
    .map((pin) => ({ lat: pin.lat, lng: pin.lng }));

  if (pinPoints.length > 0) {
    return { ...averagePoint(pinPoints), origin: "pins" };
  }

  const cameraPoints = cameras
    .filter((camera) => isFiniteCoordinate(camera.latitude, camera.longitude))
    .map((camera) => ({
      lat: camera.latitude as number,
      lng: camera.longitude as number,
    }));

  if (cameraPoints.length > 0) {
    return { ...averagePoint(cameraPoints), origin: "cameras" };
  }

  return null;
}

export function coordinateOriginLabel(coordinate: WeatherCoordinate): string {
  switch (coordinate.origin) {
    case "pins":
      return "map pins";
    case "cameras":
      return "camera locations";
    case "gps":
      return "current GPS location";
    case "manual":
      return "saved location";
  }
}

type Point = { lat: number; lng: number };

function averagePoint(points: Point[]): Point {
  const total = points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function isFiniteCoordinate(
  lat: number | undefined,
  lng: number | undefined,
): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}
