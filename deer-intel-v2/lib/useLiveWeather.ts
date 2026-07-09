"use client";

import { useEffect, useState } from "react";
import { fetchLiveWeather, WeatherFetchError } from "@/lib/openMeteo";
import type { LiveWeather, WeatherCoordinate } from "@/types/weather";

export type LiveWeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; weather: LiveWeather }
  | { status: "error"; message: string };

type ResolvedResult =
  | { key: string; status: "ready"; weather: LiveWeather }
  | { key: string; status: "error"; message: string };

// Fetches live weather for a coordinate and re-fetches when it changes.
// Returns "idle" when there is no coordinate to look up yet, and "loading"
// until the fetch for the current coordinate resolves.
export function useLiveWeather(
  coordinate: WeatherCoordinate | null,
): LiveWeatherState {
  const [result, setResult] = useState<ResolvedResult | null>(null);

  // Round the coordinate so tiny averaging changes don't trigger refetches.
  const key = coordinate
    ? `${coordinate.lat.toFixed(3)},${coordinate.lng.toFixed(3)}`
    : "";

  useEffect(() => {
    if (!coordinate) return;

    const controller = new AbortController();

    fetchLiveWeather({ coordinate, signal: controller.signal })
      .then((weather) => {
        if (!controller.signal.aborted) {
          setResult({ key, status: "ready", weather });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        const message =
          error instanceof WeatherFetchError
            ? error.message
            : "Could not load live weather right now.";

        setResult({ key, status: "error", message });
      });

    return () => controller.abort();
    // key stands in for the coordinate's meaningful value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!coordinate) return { status: "idle" };

  // Ignore any result left over from a previous coordinate while the new
  // fetch is in flight.
  if (result?.key !== key) return { status: "loading" };

  return result.status === "ready"
    ? { status: "ready", weather: result.weather }
    : { status: "error", message: result.message };
}
