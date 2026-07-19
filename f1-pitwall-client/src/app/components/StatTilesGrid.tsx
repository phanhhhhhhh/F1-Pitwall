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
      className="grid grid-cols-2 gap-3 rise"
      style={{ animationDelay: "160ms" }}
    >
      {tiles.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="group relative overflow-hidden rounded-2xl border border-white/5 chamfer p-4 flex flex-col justify-between transition-all hover:border-[#E10600]/30"
          style={{ background: "rgba(18,18,21,.7)", minHeight: 130 }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background:
                "radial-gradient(circle at 50% 0%,rgba(225,6,0,.12),transparent 65%)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <span className="f-mono text-[10px] tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">
              {s.label}
            </span>
            <span className="text-base opacity-30 group-hover:opacity-70 transition-opacity">
              {s.icon}
            </span>
          </div>
          <div className="relative">
            <div className="f-cond font-black text-5xl leading-none tabular-nums text-white group-hover:text-[#E10600] transition-colors">
              {s.value}
            </div>
            <div className="f-mono text-[10px] text-zinc-600 mt-1">{s.sub}</div>
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E10600] scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
        </Link>
      ))}
    </section>
  );
}
