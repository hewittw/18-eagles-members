// What a page shows for the instant before the golfer's journal has loaded: the page's frame, quietly, with no
// flash of the first-visit screen for a golfer who has been here before. A screen tall, so the footer below never
// jumps when the page fills in (no layout shift).
export function Placeholder({ label = "Opening your locker" }: { label?: string }) {
  return (
    <div className="mx-auto min-h-dvh max-w-ledger px-4 py-16 sm:px-6 lg:px-8" aria-busy="true">
      <p className="caps text-label text-ink-2">{label}…</p>
      <div className="mt-6 h-24 max-w-xl animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" />
    </div>
  );
}

/** The standard page container. */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-ledger grid-cols-[minmax(0,1fr)] px-4 pb-20 pt-8 sm:px-6 md:pt-12 lg:px-8 ${className}`}>{children}</div>;
}
