"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { clearTokens } from "../lib/pitwall-auth";
import NotificationBell from "./NotificationBell";

const navGroups = [
  {
    label: "SEASON",
    items: [
      { href: "/", label: "Overview" },
      { href: "/standings", label: "Standings" },
      { href: "/races", label: "Race Calendar" },
      { href: "/circuits", label: "Circuits" },
    ],
  },
  {
    label: "GRID",
    items: [
      { href: "/drivers", label: "Drivers" },
      { href: "/teams", label: "Teams" },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/strategy", label: "Pit Strategy" },
      { href: "/telemetry", label: "Live Telemetry 🔴", live: true },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/admin", label: "Admin Panel" },
    ],
  },
];

function NavDropdown({ group, pathname }: { group: typeof navGroups[0]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = group.items.some(
    item => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (group.items.length === 1) {
    const item = group.items[0];
    return (
      <Link href={item.href}
        className={`px-4 py-4 text-xs font-bold tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${
          pathname === item.href || pathname.startsWith(item.href + "/")
            ? "border-red-500 text-white"
            : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
        }`}>
        {item.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        {item.label.toUpperCase()}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className={`px-4 py-4 text-xs font-bold tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${
          isActive ? "border-red-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
        }`}>
        {group.label}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden min-w-44">
          {group.items.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-colors border-l-2 ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "border-red-500 text-white bg-zinc-800"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600"
              }`}>
              {item.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const handleLogout = () => { clearTokens(); window.location.href = "/login"; };

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 px-6 py-0 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-3 py-4 mr-2 flex-shrink-0">
        <div className="w-2 h-6 bg-red-500" />
        <span className="text-white font-black tracking-widest text-lg">
          <span className="text-red-500">PIT</span>WALL
        </span>
        <span className="text-zinc-600 text-xs font-mono tracking-widest hidden lg:block">F1 · 2026</span>
      </Link>

      <div className="flex items-center flex-1">
        {navGroups.map(group => (
          <NavDropdown key={group.label} group={group} pathname={pathname} />
        ))}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-500 text-xs font-mono">LIVE</span>
        </div>
        <NotificationBell />
        <button onClick={handleLogout} className="text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono">LOGOUT</button>
      </div>
    </nav>
  );
}
