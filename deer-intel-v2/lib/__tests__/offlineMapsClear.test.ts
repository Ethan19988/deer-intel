import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// clearAllOfflineTiles vs a running download, and the memoized tile-cache
// handle after a clear — with an in-memory Cache Storage and a fetch the test
// releases by hand.

class FakeCache {
  entries = new Map<string, Response>();
  async match(key: string | Request) {
    const hit = this.entries.get(typeof key === "string" ? new URL(key).href : key.url);
    return hit ? hit.clone() : undefined;
  }
  async put(key: string | Request, response: Response) {
    this.entries.set(typeof key === "string" ? new URL(key).href : key.url, response);
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async delete(key: string | Request) {
    return this.entries.delete(typeof key === "string" ? new URL(key).href : key.url);
  }
}

const cacheStore = new Map<string, FakeCache>();
const fakeCaches = {
  async open(name: string) {
    let cache = cacheStore.get(name);
    if (!cache) {
      cache = new FakeCache();
      cacheStore.set(name, cache);
    }
    return cache;
  },
  async delete(name: string) {
    const cache = cacheStore.get(name);
    // A deleted cache's handle reads nothing afterwards.
    cache?.entries.clear();
    return cacheStore.delete(name);
  },
};

const storage = new Map<string, string>();
let holdFetches = false;
const heldFetches: Array<() => void> = [];

function tileResponse() {
  return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
}

let offline: typeof import("@/lib/offlineMaps");

beforeAll(async () => {
  const win = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
    caches: fakeCaches,
    crypto: globalThis.crypto,
  });
  (globalThis as Record<string, unknown>).window = win;
  (globalThis as Record<string, unknown>).caches = fakeCaches;
  (globalThis as Record<string, unknown>).fetch = (_url: string, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      if (!holdFetches) return resolve(tileResponse());
      heldFetches.push(() => resolve(tileResponse()));
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  offline = await import("@/lib/offlineMaps");
});

beforeEach(() => {
  holdFetches = false;
  heldFetches.length = 0;
});

const source = { url: "https://tiles.example.com/{z}/{x}/{y}.png", maxNativeZoom: 17 };
const bounds = { south: 41.4, west: -77.2, north: 41.414, east: -77.182 };
const tileUrl = "https://tiles.example.com/14/4678/6117.png";

function download() {
  return offline.downloadOfflinePack({
    propertyId: "p1",
    propertyName: "Ridge",
    layerId: "satellite",
    layerLabel: "Current",
    targetLabel: "hunt area",
    bounds,
    sources: [source],
    minZoom: 14,
    maxZoom: 14,
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("clearAllOfflineTiles", () => {
  it("stops a running download, which then records no pack", async () => {
    holdFetches = true;
    const running = download();
    const outcome = running.then(
      () => "saved",
      (error: unknown) => (error instanceof DOMException ? error.name : "error"),
    );
    await tick();
    expect(offline.isOfflineDownloadRunning()).toBe(true);

    await offline.clearAllOfflineTiles();

    expect(await outcome).toBe("AbortError");
    expect(offline.listOfflinePacks()).toEqual([]);
    expect(offline.isOfflineDownloadRunning()).toBe(false);
    expect(offline.offlineTilesAvailable()).toBe(false);
  });

  it("serves tiles from a download made after a clear (no stale cache handle)", async () => {
    const first = await download();
    expect(first.tileCount).toBeGreaterThan(0);
    // Memoizes the tile-cache handle.
    expect(await offline.matchOfflineTile(tileUrl)).not.toBeNull();

    await offline.clearAllOfflineTiles();
    expect(await offline.matchOfflineTile(tileUrl)).toBeNull();

    await download();
    expect(offline.listOfflinePacks()).toHaveLength(1);
    expect(await offline.matchOfflineTile(tileUrl)).not.toBeNull();
  });
});
