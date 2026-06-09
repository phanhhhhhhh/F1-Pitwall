"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

interface NavItem { href: string; label: string; live?: boolean; }

const navGroups: { label: string; items: NavItem[]; roles: string[] }[] = [
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
      { href: "/telemetry", label: "Live Telemetry", live: true },
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
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link href={item.href}
        className={`f-mono px-4 py-4 text-[11px] font-bold tracking-[0.15em] border-b-2 transition-all flex items-center gap-1.5 ${active
          ? "border-[#E10600] text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
          }`}>
        {item.live && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />}
        {item.label.toUpperCase()}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className={`f-mono px-4 py-4 text-[11px] font-bold tracking-[0.15em] border-b-2 transition-all flex items-center gap-1.5 ${isActive ? "border-[#E10600] text-white" : "border-transparent text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
          }`}>
        {group.label}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/70 rounded-xl shadow-2xl z-50 overflow-hidden min-w-48">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#E10600] to-transparent" />
          {group.items.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`f-cond flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-l-2 ${active
                  ? "border-[#E10600] text-white bg-white/[0.04]"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.03] hover:border-zinc-600"
                  }`}>
                {item.live && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />}
                {item.label}
              </Link>
            );
          })}
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const visibleGroups = navGroups.filter(group => !user || group.roles.includes(user.role));
  const roleColor = user?.role === "ADMIN" ? "#E10600" : user?.role === "ENGINEER" ? "#3b82f6" : "#52525b";
  const avatarUrl = user?.avatarUrl;
  const showAvatar = avatarUrl && !imgError;
  const displayName = user?.displayName || user?.username || "";

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-zinc-950/80 backdrop-blur-xl" ref={mobileRef}>
      {/* top hairline accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E10600]/40 to-transparent" />
      <div className="px-4 sm:px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-1.5 h-6 bg-[#E10600] rounded-full transition-all group-hover:h-7" style={{ boxShadow: "0 0 12px rgba(225,6,0,.6)" }} />
          <span className="f-cond text-white font-black tracking-widest text-base sm:text-lg">
            <span className="text-[#E10600]">PIT</span>WALL
          </span>
          <span className="f-mono text-zinc-600 text-[10px] tracking-widest hidden lg:block border border-white/10 rounded px-1.5 py-0.5">F1 · 2026</span>
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
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E676] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E676]" />
            </span>
            <span className="f-mono text-zinc-500 text-[10px] tracking-widest">LIVE</span>
          </div>

          {/* Profile avatar */}
          {user ? (
            <Link href="/profile"
              className="flex items-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 rounded-lg px-2 py-1.5 transition-all group">
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-black text-white f-cond"
                style={{ backgroundColor: showAvatar ? "transparent" : roleColor }}>
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="f-mono text-[11px] text-zinc-400 group-hover:text-white transition-colors hidden lg:block">
                {displayName}
              </span>
            </Link>
          ) : (
            <Link href="/login" className="f-mono text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors">
              LOGIN
            </Link>
          )}

          <NotificationBell />

          {/* Logout — desktop only */}
          <button onClick={handleLogout}
            className="f-mono hidden sm:block text-[11px] text-zinc-600 hover:text-[#E10600] transition-colors">
            LOGOUT
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
            aria-label="Menu">
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-zinc-400 transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-white/[0.06] px-4 py-4 space-y-1">
          {visibleGroups.map(group => (
            <div key={group.label} className="mb-3">
              <p className="f-mono text-zinc-600 text-[10px] tracking-widest mb-1.5 px-2">{group.label}</p>
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`f-cond flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${active
                      ? "bg-[#E10600]/10 text-[#ff6a52] border border-[#E10600]/20"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                      }`}>
                    {item.live && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse flex-shrink-0" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="h-px bg-white/[0.06] my-3" />

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
              <span className="f-mono text-zinc-500 text-[10px] tracking-widest">LIVE</span>
            </div>
            <button onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="f-mono text-[11px] text-[#E10600]/70 hover:text-[#E10600] transition-colors border border-[#E10600]/20 hover:border-[#E10600]/40 px-3 py-1.5 rounded-lg">
              LOGOUT
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
