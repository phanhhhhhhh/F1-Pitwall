"use client";

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ["w-8", "w-32", "w-24", "w-16", "w-20", "w-12"];
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={`h-4 rounded animate-pulse bg-zinc-800 ${widths[i % widths.length]} flex-shrink-0`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden animate-pulse" style={{ background: "rgba(18,18,21,.78)" }}>
      <div className="h-[3px] w-full bg-zinc-800" />
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 bg-zinc-800 rounded" />
          <div className="h-4 w-10 bg-zinc-800 rounded" />
        </div>
        <div className="h-7 w-3/4 bg-zinc-800 rounded" />
        <div className="h-3 w-1/2 bg-zinc-800 rounded" />
        <div className="h-px w-full bg-zinc-800 rounded mt-2" />
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-1.5 text-center">
              <div className="h-6 w-10 mx-auto bg-zinc-800 rounded" />
              <div className="h-2 w-8 mx-auto bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "rgba(18,18,21,.7)" }}>
      {/* Header row */}
      <div className="flex gap-4 px-5 py-3 border-b border-white/5">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 w-14 bg-zinc-800/70 rounded animate-pulse" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}
