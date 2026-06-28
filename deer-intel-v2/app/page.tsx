export default function Home() {
  return (
    <main className="min-h-screen bg-[#10150f] text-white p-5">
      <section className="max-w-6xl mx-auto">
        <div className="rounded-3xl border border-green-900 bg-[#172016] p-6">
          <p className="text-green-300">Hunt Smarter. Learn More.</p>
          <h1 className="text-4xl font-bold mt-2">🦌 Deer Intel</h1>
          <p className="mt-3 text-gray-300">Welcome back, Ethan.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-5">
          <a href="/map" className="rounded-2xl bg-green-700 p-5 block">
            <h2 className="text-xl font-semibold">🗺️ Open Map</h2>
            <p className="mt-2">GPS, pins, cameras, stands, scrapes, and vegetation.</p>
          </a>

          <a href="/properties" className="rounded-2xl bg-[#1d2a1a] p-5 border border-green-900 block">
            <h2 className="text-xl font-semibold">🌲 Properties</h2>
            <p className="mt-2 text-gray-300">Create Finley Run, Moore Hill, and more.</p>
          </a>

          <a href="/ai" className="rounded-2xl bg-[#1d2a1a] p-5 border border-green-900 block">
            <h2 className="text-xl font-semibold">🤖 AI Scout</h2>
            <p className="mt-2 text-gray-300">Coming soon: stand recommendations.</p>
          </a>

          <a href="/cameras" className="rounded-2xl bg-[#151d14] p-5 border border-green-950 block">
            📷 Cameras
          </a>

          <a href="/stands" className="rounded-2xl bg-[#151d14] p-5 border border-green-950 block">
            🪜 Stands
          </a>

          <a href="/hunt-log" className="rounded-2xl bg-[#151d14] p-5 border border-green-950 block">
            📖 Hunt Log
          </a>
        </div>
      </section>
    </main>
  );
}
