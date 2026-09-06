"use client";

import Link from "next/link";
import { useSeason } from "../context/SeasonContext";

export default function PitwallFooter() {
  const { season } = useSeason();

  return (
    <footer className="relative z-20 border-t border-white/[0.08] bg-black/90 backdrop-blur-2xl text-zinc-400 mt-20">
      {/* Top red laser line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent shadow-[0_0_10px_#E10600]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand & Telemetry Status */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-1.5 h-6 bg-[#E10600] rounded-full shadow-[0_0_10px_#E10600]" />
              <span className="f-cond text-white font-black tracking-widest text-xl">
                <span className="text-[#E10600]">PIT</span>WALL <span className="text-zinc-600 text-sm font-bold">OS 2.0</span>
              </span>
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              Formula 1 race engineering console and live telemetry operations hub.
              Engineered for aerodynamic analysis, strategy simulation, and real-time Grand Prix timing.
            </p>

            {/* Live Operational Status Box */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 max-w-sm space-y-2">
              <div className="flex items-center justify-between text-[11px] f-mono">
                <span className="flex items-center gap-2 text-zinc-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#00E676] live-pulse" />
                  TELEMETRY ENGINE
                </span>
                <span className="text-emerald-400 font-bold">50 Hz STOMP</span>
              </div>
              <div className="flex items-center justify-between text-[10px] f-mono text-zinc-500">
                <span>LATENCY: <strong className="text-zinc-300">~18ms</strong></span>
                <span>SEASON: <strong className="text-white font-black">{season}</strong></span>
                <span className="text-[#00E676] font-bold">ONLINE</span>
              </div>
            </div>
          </div>

          {/* Quick Links Column 1: Championship */}
          <div>
            <h4 className="f-mono text-[10px] font-black tracking-[0.25em] text-white uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-0.5 bg-[#E10600]" />
              CHAMPIONSHIP
            </h4>
            <ul className="space-y-2.5 text-xs f-cond font-bold uppercase tracking-wider">
              <li>
                <Link href="/" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Season Overview
                </Link>
              </li>
              <li>
                <Link href="/standings" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  WDC & WCC Standings
                </Link>
              </li>
              <li>
                <Link href="/races" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Race Calendar
                </Link>
              </li>
              <li>
                <Link href="/circuits" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Circuit Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links Column 2: Grid */}
          <div>
            <h4 className="f-mono text-[10px] font-black tracking-[0.25em] text-white uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-0.5 bg-[#FF8000]" />
              GRID & DRIVERS
            </h4>
            <ul className="space-y-2.5 text-xs f-cond font-bold uppercase tracking-wider">
              <li>
                <Link href="/drivers" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Driver Profiles
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Constructors & Specs
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Engineer Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links Column 3: Race Engineering */}
          <div>
            <h4 className="f-mono text-[10px] font-black tracking-[0.25em] text-white uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-0.5 bg-[#00E5FF]" />
              PITWALL TOOLS
            </h4>
            <ul className="space-y-2.5 text-xs f-cond font-bold uppercase tracking-wider">
              <li>
                <Link href="/telemetry" className="hover:text-[#00E5FF] flex items-center gap-1.5 hover:translate-x-1 transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
                  Telemetry & Timing
                </Link>
              </li>
              <li>
                <Link href="/strategy" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Pit Strategy Calculator
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white hover:translate-x-1 inline-block transition-all">
                  Telemetry Admin
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] f-mono text-zinc-500">
          <div className="flex items-center gap-4 flex-wrap">
            <span>© {season} F1 PITWALL OS</span>
            <span>·</span>
            <span>DATA BY OPENF1 & FIA PUBLIC FEEDS</span>
            <span>·</span>
            <span className="text-zinc-600">NON-COMMERCIAL MOTORSPORT ANALYTICS</span>
          </div>

          {/* Key shortcut helper */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">QUICK SEARCH:</span>
            <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300">Ctrl + K</kbd>
          </div>
        </div>
      </div>
    </footer>
  );
}
