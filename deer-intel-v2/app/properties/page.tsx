export default function PropertiesPage() {
  return (
    <main className="min-h-screen bg-[#10150f] text-white p-5">
      <section className="max-w-5xl mx-auto">
        <a
          href="/"
          className="inline-block mb-4 text-green-300 hover:text-green-200"
        >
          ← Back to Dashboard
        </a>

        <h1 className="text-4xl font-bold mb-6">🌲 My Properties</h1>

        <div className="grid gap-4">
          <div className="rounded-2xl bg-[#172016] border border-green-900 p-5">
            <h2 className="text-2xl font-semibold">Finley Run</h2>
            <p className="text-gray-300 mt-2">
              No boundary drawn yet.
            </p>
          </div>

          <div className="rounded-2xl bg-[#172016] border border-green-900 p-5">
            <h2 className="text-2xl font-semibold">Moore Hill</h2>
            <p className="text-gray-300 mt-2">
              No boundary drawn yet.
            </p>
          </div>

          <button className="rounded-2xl bg-green-700 p-5 text-xl font-semibold hover:bg-green-600">
            ➕ New Property
          </button>
        </div>
      </section>
    </main>
  );
}
