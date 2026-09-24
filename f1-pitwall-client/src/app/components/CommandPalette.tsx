"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  title: string;
  category: "PAGES" | "DRIVERS" | "TEAMS" | "CIRCUITS" | "ACTIONS";
  subtitle?: string;
  href?: string;
  action?: () => void;
  badge?: string;
}

const COMMANDS: CommandItem[] = [
  // Pages
  { id: "p-home", title: "Season Overview", category: "PAGES", href: "/", subtitle: "Main dashboard, standings, calendar" },
  { id: "p-standings", title: "Championship Standings", category: "PAGES", href: "/standings", subtitle: "WDC / WCC standings, bump chart, title simulator" },
  { id: "p-drivers", title: "Drivers Lineup", category: "PAGES", href: "/drivers", subtitle: "All drivers, career records" },
  { id: "p-teams", title: "Constructors & Liveries", category: "PAGES", href: "/teams", subtitle: "Team profiles, car specs, budgets" },
  { id: "p-telemetry", title: "Live Telemetry & Timing", category: "PAGES", href: "/telemetry", subtitle: "Timing tower, speed trace, tyre data", badge: "LIVE" },
  { id: "p-strategy", title: "Pit Strategy & Undercut Tool", category: "PAGES", href: "/strategy", subtitle: "Degradation simulator, stint optimizer, undercut matrix" },
  { id: "p-races", title: "Race Calendar & Grand Prix Weekends", category: "PAGES", href: "/races", subtitle: "FP1, FP2, FP3, Qualifying, Sprint, Race results" },
  { id: "p-circuits", title: "Circuits & 3D Track Elevation", category: "PAGES", href: "/circuits", subtitle: "3D racing lines, DRS zones, lap records" },

  // Drivers
  { id: "d-ver", title: "Max Verstappen #1", category: "DRIVERS", href: "/drivers", subtitle: "Red Bull Racing · 4x World Champion" },
  { id: "d-nor", title: "Lando Norris #4", category: "DRIVERS", href: "/drivers", subtitle: "McLaren Formula 1 Team" },
  { id: "d-lec", title: "Charles Leclerc #16", category: "DRIVERS", href: "/drivers", subtitle: "Scuderia Ferrari" },
  { id: "d-ham", title: "Lewis Hamilton #44", category: "DRIVERS", href: "/drivers", subtitle: "Scuderia Ferrari · 7x World Champion" },
  { id: "d-pia", title: "Oscar Piastri #81", category: "DRIVERS", href: "/drivers", subtitle: "McLaren Formula 1 Team" },
  { id: "d-rus", title: "George Russell #63", category: "DRIVERS", href: "/drivers", subtitle: "Mercedes-AMG Petronas" },
  { id: "d-alo", title: "Fernando Alonso #14", category: "DRIVERS", href: "/drivers", subtitle: "Aston Martin Aramco · 2x World Champion" },

  // Circuits
  { id: "c-monaco", title: "Circuit de Monaco (Monte Carlo)", category: "CIRCUITS", href: "/circuits", subtitle: "3.337 km Street Circuit · 19 Turns" },
  { id: "c-silverstone", title: "Silverstone Circuit (Great Britain)", category: "CIRCUITS", href: "/circuits", subtitle: "5.891 km Permanent Track · Maggotts & Becketts" },
  { id: "c-spa", title: "Circuit de Spa-Francorchamps (Belgium)", category: "CIRCUITS", href: "/circuits", subtitle: "7.004 km · Eau Rouge & Raidillon" },
  { id: "c-monza", title: "Autodromo Nazionale Monza (Italy)", category: "CIRCUITS", href: "/circuits", subtitle: "5.793 km Temple of Speed · 11 Turns" },
  { id: "c-suzuka", title: "Suzuka International Racing Course (Japan)", category: "CIRCUITS", href: "/circuits", subtitle: "5.807 km Figure-8 Track · Degner & 130R" },
];

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Reset on open; the palette stays mounted while closed, so this can't be a remount.
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery("");
      setSelectedIndex(0);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // Filter commands
  const filtered = query.trim() === ""
    ? COMMANDS
    : COMMANDS.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      );

  // Declared before the key handler that calls it, so the listener is rebound to the current
  // version whenever it changes rather than holding on to the one from its first render.
  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      onClose();
      if (cmd.href) {
        router.push(cmd.href);
      } else if (cmd.action) {
        cmd.action();
      }
    },
    [onClose, router]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeCommand(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, executeCommand, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-2xl bg-zinc-950/95 border border-zinc-700/80 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden z-10"
          >
            {/* Top Accent Line */}
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 shadow-[0_0_12px_#E10600]" />

            {/* Input Search Box */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
              <span className="text-zinc-400 text-lg">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command, driver, circuit, telemetry tool..."
                className="w-full bg-transparent text-white font-mono text-sm placeholder-zinc-500 outline-none"
              />
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] f-mono text-zinc-400">
                ESC
              </span>
            </div>

            {/* Commands List */}
            <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-zinc-900">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 f-mono text-xs">
                  No matching pitwall telemetry or telemetry page found.
                </div>
              ) : (
                filtered.map((cmd, idx) => {
                  const isSelected = selectedIndex === idx;

                  return (
                    <div
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-red-600/15 border border-red-600/40 text-white shadow-md"
                          : "hover:bg-zinc-900/60 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] f-mono font-black uppercase ${
                            cmd.category === "PAGES"
                              ? "bg-zinc-800 text-zinc-400"
                              : cmd.category === "DRIVERS"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : cmd.category === "CIRCUITS"
                              ? "bg-blue-950 text-blue-400 border border-blue-800"
                              : "bg-emerald-950 text-emerald-400"
                          }`}
                        >
                          {cmd.category}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-cond font-bold text-sm tracking-wide text-white truncate">
                              {cmd.title}
                            </span>
                            {cmd.badge && (
                              <span className="px-1.5 py-0.5 rounded bg-red-600 text-[8px] f-mono font-black text-white">
                                {cmd.badge}
                              </span>
                            )}
                          </div>
                          {cmd.subtitle && (
                            <p className="text-[11px] f-mono text-zinc-500 truncate mt-0.5">
                              {cmd.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="f-mono text-[10px] text-zinc-500">
                        {isSelected ? "↵ SELECT" : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 bg-black/60 border-t border-zinc-800/80 flex items-center justify-between text-[10px] f-mono text-zinc-500">
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Enter to select</span>
                <span>ESC to close</span>
              </div>
              <span className="text-zinc-600">F1-PITWALL QUICK PALETTE</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
