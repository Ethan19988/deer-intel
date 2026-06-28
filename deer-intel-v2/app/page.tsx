export default function Home() {
  return (
    <main className="min-h-screen bg-[#10150f] text-white p-5">
      <section className="max-w-6xl mx-auto">
        <div className="rounded-3xl border border-green-900 bg-[#172016] p-6 shadow-xl">
          <p className="text-sm text-green-300">Hunt Smarter. Learn More.</p>
          <h1 className="text-4xl font-bold mt-2">🦌 Deer Intel</h1>
          <p className="mt-3 text-gray-300">
            Welcome back, Ethan. Your hunting intelligence dashboard is ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-5">
          <div className="rounded-2xl bg-[#1d2a1a] p-5 border border-green-900">
            <h2 className="text-xl font-semibold">🌲 My Properties</h2>
            <div className="mt-4 space-y-3">
              <button className="w-full text-left rounded-xl bg-[#263820] p-4">
                Finley Run
              </button>
              <button className="w-full text-left rounded-xl bg-[#263820] p-4">
                Moore Hill
              </button>
              <button className="w-full text-left rounded-xl bg-green-700 p-4">
                + Add Property
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#1d2a1a] p-5 border border-green-900">
            <h2 className="text-xl font-semibold">🤖 AI Scout</h2>
            <p className="mt-3 text-gray-300">
              Ask which stand to hunt based on wind, temperature, camera activity,
              scrapes, vegetation, and past hunt history.
            </p>
            <button className="mt-5 rounded-xl bg-green-700 px-4 py-3">
              Open AI Scout
            </button>
          </div>

          <div className="rounded-2xl bg-[#1d2a1a] p-5 border border-green-900">
            <h2 className="text-xl font-semibold">🗺️ Map Tools</h2>
            <p className="mt-3 text-gray-300">
              Real maps, GPS, property boundaries, stand pins, camera pins, scrapes,
              rubs, deer sightings, and vegetation layers.
            </p>
            <button className="mt-5 rounded-xl bg-green-700 px-4 py-3">
              Open Map
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mt-5">
          <div className="rounded-2xl bg-[#151d14] p-5 border border-green-950">
            📷 Cameras
          </div>
          <div className="rounded-2xl bg-[#151d14] p-5 border border-green-950">
            🪜 Stands
          </div>
          <div className="rounded-2xl bg-[#151d14] p-5 border border-green-950">
            🦌 Deer Activity
          </div>
          <div className="rounded-2xl bg-[#151d14] p-5 border border-green-950">
            📖 Hunt Log
          </div>
        </div>
      </section>
    </main>
  );
}
