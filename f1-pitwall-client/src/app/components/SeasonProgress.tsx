"use client";

interface SeasonProgressProps {
  gpDone: number;
  totalGP: number;
  sprintDone: number;
  sprintCount: number;
  gpCancel: number;
  pct: number;
}

export default function SeasonProgress({
  gpDone,
  totalGP,
  sprintDone,
  sprintCount,
  gpCancel,
  pct,
}: SeasonProgressProps) {
  return (
    <section
      className="lg:col-span-2 rise relative overflow-hidden rounded-2xl border border-white/5 p-5"
      style={{ background: "rgba(18,18,21,.7)", animationDelay: "200ms" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 bg-[#E10600] rounded-full" />
          <h3 className="f-cond font-bold text-lg tracking-wide">
            SEASON PROGRESS
          </h3>
        </div>
        <div className="flex items-center gap-3 f-mono text-[11px]">
          <span className="text-zinc-500">
            <span className="text-white font-bold text-sm">{gpDone}</span>/
            {totalGP} GP
          </span>
          {sprintDone > 0 && (
            <span className="text-[#FFD200]">
              ⚡{sprintDone}/{sprintCount}
            </span>
          )}
        </div>
      </div>
      {/* Track */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5 f-mono text-[9px] text-zinc-700 tracking-widest">
          <span>LIGHTS OUT</span>
          <span>CHEQUERED FLAG</span>
        </div>
        <div
          className="relative h-4 rounded-full overflow-hidden"
          style={{
            background: "rgba(0,0,0,.4)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg,#E10600,#ff5a3c)",
              boxShadow: "0 0 16px rgba(225,6,0,.5)",
            }}
          />
          <div
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${pct}%` }}
          >
            <div
              className="absolute inset-0 shimmer"
              style={{
                background:
                  "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",
              }}
            />
          </div>
          <div
            className="absolute right-0 inset-y-0 w-4"
            style={{
              backgroundImage:
                "repeating-conic-gradient(#fff 0% 25%,#000 0% 50%)",
              backgroundSize: "4px 4px",
              opacity: 0.25,
            }}
          />
        </div>
        {/* round ticks */}
        <div className="relative h-3 mt-1">
          {Array.from({ length: totalGP }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 w-px h-2 rounded-full"
              style={{
                left: `${(i / (totalGP - 1)) * 100}%`,
                background: i < gpDone ? "#E10600" : "#2a2a2e",
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 f-mono text-[11px]">
        <span className="flex items-center gap-1.5 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {gpDone} completed
        </span>
        <span className="flex items-center gap-1.5 text-[#FFD200]">
          <span className="w-2 h-2 rounded-full bg-[#FFD200]" />
          ⚡ {sprintDone} sprints
        </span>
        <span className="flex items-center gap-1.5 text-red-400">
          <span className="w-2 h-2 rounded-full bg-[#E10600]" />
          {gpCancel} cancelled
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-zinc-600" />
          {totalGP - gpDone - gpCancel} scheduled
        </span>
      </div>
    </section>
  );
}
