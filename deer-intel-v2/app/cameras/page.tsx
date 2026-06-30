import Link from "next/link";

export default function CamerasPage() {
  return (
    <main className="min-h-screen bg-[#10150f] text-white p-5">
      <section className="max-w-5xl mx-auto">
        <Link href="/" className="text-green-300">
          Back to Dashboard
        </Link>

        <div className="mt-4 rounded-3xl border border-green-900 bg-[#172016] p-6">
          <h1 className="text-4xl font-bold">Cameras</h1>
          <p className="mt-3 text-gray-300">
            Coming soon: trail camera locations, photo logs, batteries, SD
            cards, and buck history.
          </p>
        </div>
      </section>
    </main>
  );
}
