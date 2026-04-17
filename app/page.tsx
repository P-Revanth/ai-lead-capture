export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-6 py-12 sm:px-10">
      <div className="max-w-2xl space-y-5">
        <p className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-zinc-600">
          Lead AI Widget
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Embed-ready chat widget for real estate lead capture
        </h1>
        <p className="text-base leading-7 text-zinc-600 sm:text-lg">
          Use the floating launcher in the bottom-right corner to open Sarah, collect user preferences,
          and qualify leads through a guided conversation.
        </p>
      </div>
    </main>
  )
}