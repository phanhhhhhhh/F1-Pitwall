"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import { useSeason } from "../context/SeasonContext";
import NotificationBell from "./NotificationBell";
import SeasonSelector from "./SeasonSelector";
import CommandPalette from "./CommandPalette";
import { isSoundEnabled, setSoundEnabled, playUiClick } from "../lib/f1-sound";

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
      { href: "/drivers/compare", label: "Driver 1v1 Battle" },
      { href: "/teams", label: "Teams" },
    ],
    roles: ["ADMIN", "ENGINEER", "VIEWER"],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/live", label: "Live Timing", live: true },
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
        className={`f-mono px-3.5 py-4 text-[11px] font-bold tracking-[0.15em] border-b-2 transition-all flex items-center gap-1.5 ${active
          ? "border-[#E10600] text-white shadow-[0_2px_10px_rgba(225,6,0,0.4)]"
          : "border-transparent text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
          }`}>
        {item.live && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />}
        {item.label.toUpperCase()}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className={`f-mono px-3.5 py-4 text-[11px] font-bold tracking-[0.15em] border-b-2 transition-all flex items-center gap-1.5 ${isActive ? "border-[#E10600] text-white shadow-[0_2px_10px_rgba(225,6,0,0.3)]" : "border-transparent text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
          }`}>
        {group.label}
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180 text-[#E10600]" : "text-zinc-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800 hover:border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-52 p-1.5 dropdown-in">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#E10600] to-transparent shadow-[0_0_8px_#E10600] mb-1" />
          {group.items.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`f-cond flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${active
                  ? "border border-[#E10600]/40 text-white bg-[#E10600]/10 shadow-[inset_0_0_12px_rgba(225,6,0,0.15)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  }`}>
                {item.live && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] live-pulse flex-shrink-0" />}
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
  const { season } = useSeason();
  const [imgError, setImgError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [utcTime, setUtcTime] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    const tickClock = () => {
      const now = new Date();
      setUtcTime(
        now.toTimeString().split(" ")[0] + " UTC"
      );
    };
    tickClock();
    const interval = setInterval(tickClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playUiClick();
  };

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
    <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-zinc-950/85 backdrop-blur-2xl" ref={mobileRef}>
      {/* top hairline red laser accent */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent shadow-[0_0_8px_#E10600]" />
      <div className="px-4 sm:px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-1.5 h-6 bg-[#E10600] rounded-full transition-all group-hover:h-7" style={{ boxShadow: "0 0 12px rgba(225,6,0,.6)" }} />
          <span className="f-cond text-white font-black tracking-widest text-base sm:text-lg">
            <span className="text-[#E10600]">PIT</span>WALL
          </span>
          <span className="f-mono text-zinc-500 text-[10px] tracking-widest hidden lg:block border border-white/10 rounded px-1.5 py-0.5 bg-black/40">F1 · {season}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center flex-1 ml-4">
          {visibleGroups.map(group => (
            <NavDropdown key={group.label} group={group} pathname={pathname} />
          ))}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* UTC Track Clock */}
          {utcTime && (
            <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 f-mono bg-black/40 px-2 py-1 rounded-lg border border-zinc-800">
              <span className="text-zinc-600">🕒</span>
              <span>{utcTime}</span>
            </div>
          )}

          {/* Quick Command Palette Search Button */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 bg-black/60 hover:bg-zinc-900 border border-zinc-800 hover:border-[#E10600]/40 rounded-xl px-2.5 py-1.5 transition-all text-zinc-400 hover:text-white group shadow-sm hover:shadow-[0_0_12px_rgba(225,6,0,0.2)]"
            title="Open Command Palette (Ctrl+K)"
          >
            <span className="text-xs">🔍</span>
            <span className="f-mono text-[10px] hidden sm:block font-bold tracking-wider">SEARCH</span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] f-mono text-zinc-400 group-hover:text-zinc-200">
              Ctrl+K
            </kbd>
          </button>

          {/* Sound FX Toggle Button */}
          <button
            onClick={toggleSound}
            title={soundOn ? "Mute F1 Audio FX" : "Unmute F1 Audio FX"}
            className={`p-1.5 rounded-xl border transition-all flex items-center justify-center ${
              soundOn
                ? "bg-zinc-900/90 text-emerald-400 border-emerald-500/40 hover:bg-zinc-800 shadow-[0_0_10px_rgba(0,230,118,0.2)]"
                : "bg-zinc-950 text-zinc-600 border-zinc-800 hover:text-zinc-400"
            }`}
          >
            {soundOn ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          {/* Season selector */}
          <SeasonSelector />

          {/* Live STOMP Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/30 shadow-[0_0_12px_rgba(0,230,118,0.15)]">
            <span className="w-2 h-2 rounded-full bg-[#00E676] live-pulse" />
            <span className="f-mono text-emerald-400 font-bold text-[10px] tracking-widest">LIVE</span>
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
            <Link href="/login" className="f-mono text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors font-bold px-2 py-1 rounded bg-white/[0.04]">
              LOGIN
            </Link>
          )}

          <NotificationBell />

          {/* Logout — desktop only */}
          {user && (
            <button onClick={handleLogout}
              className="f-mono hidden sm:block text-[11px] text-zinc-500 hover:text-[#E10600] transition-colors">
              LOGOUT
            </button>
          )}

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
              <p className="f-mono text-zinc-500 text-[10px] tracking-widest mb-1.5 px-2">{group.label}</p>
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
              <span className="f-mono text-zinc-400 text-[10px] tracking-widest font-bold">LIVE STOMP</span>
            </div>
            {user && (
              <button onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="f-mono text-[11px] text-[#E10600]/80 hover:text-[#E10600] transition-colors border border-[#E10600]/20 hover:border-[#E10600]/40 px-3 py-1.5 rounded-lg">
                LOGOUT
              </button>
            )}
          </div>
        </div>
      )}
      {/* Global Command Palette Modal */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </nav>
  );
}
