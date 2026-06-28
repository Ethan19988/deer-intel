import MapClient from "../../components/MapClient.jsx";
export default function MapPage() {
  return (
    <main className="min-h-screen bg-[#10150f] text-white p-5">
      <section className="max-w-6xl mx-auto">
        <a href="/" className="text-green-300">← Back to Dashboard</a>

        <div className="mt-4 rounded-3xl border border-green-900 bg-[#172016] p-6">
          <h1 className="text-3xl font-bold">🗺️ Deer Intel Map</h1>
          <p className="mt-2 text-gray-300">
            Tap the map to add cameras, treestands, scrapes, rubs, sightings, and vegetation.
          </p>
        </div>

        <div className="mt-5">
          <MapClient />
        </div>
      </section>
    </main>
  );
}
