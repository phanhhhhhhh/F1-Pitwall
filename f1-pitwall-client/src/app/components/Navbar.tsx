"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
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
    roles: ["ADMIN", "ENGINEER", "VIEWER"],
  },
  {
    label: "GRID",
    items: [
      { href: "/drivers", label: "Drivers" },
      { href: "/teams", label: "Teams" },
    ],
    roles: ["ADMIN", "ENGINEER", "VIEWER"],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/strategy", label: "Pit Strategy" },
      { href: "/telemetry", label: "Live Telemetry 🔴", live: true },
    ],
    roles: ["ADMIN", "ENGINEER", "VIEWER"],
  },
  {
    label: "ADMIN",
    items: [{ href: "/admin", label: "Admin Panel" }],
    roles: ["ADMIN"],
  },
];

function NavDropdown({ group, pathname }: { group: typeof navGroups[0]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"));

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
        className={`px-4 py-4 text-xs font-bold tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${pathname === item.href || pathname.startsWith(item.href + "/")
          ? "border-red-500 text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
          }`}>
        {(item as any).live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        {item.label.toUpperCase()}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className={`px-4 py-4 text-xs font-bold tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${isActive ? "border-red-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
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
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-colors border-l-2 ${pathname === item.href || pathname.startsWith(item.href + "/")
                ? "border-red-500 text-white bg-zinc-800"
                : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600"
                }`}>
              {(item as any).live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
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
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { clearTokens(); window.location.href = "/login"; };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const visibleGroups = navGroups.filter(group => !user || group.roles.includes(user.role));
  const roleColor = user?.role === "ADMIN" ? "#ef4444" : user?.role === "ENGINEER" ? "#3b82f6" : "#52525b";
  const avatarUrl = (user as any)?.avatarUrl;
  const showAvatar = avatarUrl && !imgError;
  const displayName = (user as any)?.displayName || user?.username || "";

  const allItems = visibleGroups.flatMap(g => g.items.map(item => ({ ...item, group: g.label })));

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-50" ref={mobileRef}>
      <div className="px-4 sm:px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-1.5 h-6 bg-red-500 rounded-full" />
          <span className="text-white font-black tracking-widest text-base sm:text-lg">
            <span className="text-red-500">PIT</span>WALL
          </span>
          <span className="text-zinc-600 text-xs font-mono tracking-widest hidden lg:block">F1 · 2026</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center flex-1 ml-2">
          {visibleGroups.map(group => (
            <NavDropdown key={group.label} group={group} pathname={pathname} />
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Live indicator — desktop only */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-500 text-xs font-mono">LIVE</span>
          </div>

          {/* Profile avatar */}
          {user ? (
            <Link href="/profile"
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-lg px-2 py-1.5 transition-all group">
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-black text-white"
                style={{ backgroundColor: showAvatar ? "transparent" : roleColor }}>
                {showAvatar ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs font-mono text-zinc-400 group-hover:text-white transition-colors hidden lg:block">
                {displayName}
              </span>
            </Link>
          ) : (
            <Link href="/login" className="text-xs text-zinc-600 hover:text-zinc-300 font-mono transition-colors">
              LOGIN
            </Link>
          )}

          <NotificationBell />

          {/* Logout — desktop only */}
          <button onClick={handleLogout}
            className="hidden sm:block text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono">
            LOGOUT
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Menu">
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-zinc-950 border-t border-zinc-800/50 px-4 py-4 space-y-1">
          {/* Nav items grouped */}
          {visibleGroups.map(group => (
            <div key={group.label} className="mb-3">
              <p className="text-zinc-600 text-xs font-mono tracking-widest mb-1.5 px-2">{group.label}</p>
              {group.items.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}>
                  {(item as any).live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Divider */}
          <div className="h-px bg-zinc-800/50 my-3" />

          {/* Bottom actions */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-zinc-500 text-xs font-mono">LIVE</span>
            </div>
            <button onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="text-xs text-red-500/70 hover:text-red-400 font-mono transition-colors border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg">
              LOGOUT
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}