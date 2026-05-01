"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "../lib/pitwall-auth";
import NotificationBell from "./NotificationBell";

const navItems = [
  { href: "/", label: "OVERVIEW" },
  { href: "/drivers", label: "DRIVERS" },
  { href: "/teams", label: "TEAMS" },
  { href: "/races", label: "RACES" },
  { href: "/standings", label: "STANDINGS" },
  { href: "/strategy", label: "STRATEGY" },
  { href: "/circuits", label: "CIRCUITS" },
  { href: "/telemetry", label: "TELEMETRY", live: true },
  { href: "/admin", label: "ADMIN" },
];

export default function Navbar() {
  const pathname = usePathname();

  const handleLogout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 px-8 py-0 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-3 py-4">
        <div className="w-2 h-6 bg-red-500" />
        <span className="text-white font-black tracking-widest text-lg">
          <span className="text-red-500">PIT</span>WALL
        </span>
        <span className="text-zinc-600 text-xs font-mono tracking-widest hidden sm:block">F1 · 2026</span>
      </Link>

      <div className="flex items-center">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className={`px-4 py-4 text-xs font-bold tracking-widest border-b-2 transition-all duration-200 flex items-center gap-1.5 ${pathname === item.href || pathname.startsWith(item.href + "/")
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
              }`}>
            {item.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-500 text-xs font-mono">LIVE</span>
        </div>
        <NotificationBell />
        <button onClick={handleLogout}
          className="text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono tracking-wider">
          LOGOUT
        </button>
      </div>
    </nav>
  );
}
