"use client";

import Link from "next/link";

interface StatTile {
  label: string;
  value: number;
  sub: string;
  href: string;
  icon: string;
}

interface StatTilesGridProps {
  tiles: StatTile[];
}

export default function StatTilesGrid({ tiles }: StatTilesGridProps) {
  return (
    <section
      className="grid grid-cols-2 gap-3.5 rise"
      style={{ animationDelay: "160ms" }}
    >
      {tiles.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="group relative overflow-hidden rounded-3xl border border-white/10 p-5 flex flex-col justify-between transition-all duration-300 hover:border-[#E10600]/40 hover:shadow-[0_8px_30px_rgba(225,6,0,0.15)] shadow-xl"
          style={{ background: "linear-gradient(145deg, rgba(20,21,26,0.85) 0%, rgba(10,11,14,0.95) 100%)", minHeight: 145 }}
        >
          {/* Radial glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(225,6,0,0.18), transparent 70%)",
            }}
          />

          <div className="relative flex items-center justify-between">
            <span className="f-mono text-[10px] font-bold tracking-[0.25em] text-zinc-400 group-hover:text-white transition-colors uppercase">
              {s.label}
            </span>
            <span className="text-xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
              {s.icon}
            </span>
          </div>

          <div className="relative my-auto">
            <div className="f-orbitron font-black text-4xl sm:text-5xl leading-none tabular-nums text-white group-hover:text-[#E10600] group-hover:drop-shadow-[0_0_12px_rgba(225,6,0,0.5)] transition-all">
              {s.value}
            </div>
            <div className="f-mono text-[10px] font-bold text-zinc-500 mt-2 uppercase tracking-wider">
              {s.sub}
            </div>
          </div>

          {/* Animated red laser underline */}
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 shadow-[0_0_8px_#E10600]" />
        </Link>
      ))}
    </section>
  );
}
