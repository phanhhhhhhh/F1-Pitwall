"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  icon: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

const TYPE_ACCENT: Record<string, string> = {
  RACE_RESULT:   "#FFD200",
  DNF:           "#E10600",
  STATUS_CHANGE: "#3b82f6",
  SYSTEM:        "#71717a",
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [open,          setOpen]          = useState(false);
  const [loading,       setLoading]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── click-outside ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── poll unread count ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!getAccessToken()) return;
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── WebSocket live notifications ──────────────────────────────────────── */
  useEffect(() => {
    if (!getAccessToken()) return;

    const loadAndConnect = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== "undefined" && (window as any).Stomp) {
        connectWs();
        return;
      }

      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
      s.onerror = () => console.warn("[NotificationBell] Failed to load SockJS — WebSocket notifications unavailable");
      s.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@6/bundles/stomp.umd.min.js";
        s2.onerror = () => console.warn("[NotificationBell] Failed to load StompJS");
        s2.onload = () => setTimeout(connectWs, 200);
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    };

    const connectWs = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const factory = w.Stomp ?? w.StompJs?.Stomp;
      if (!factory) return;
      const wsUrl = API + "/ws";
      const client = factory.over(() => new w.SockJS(wsUrl));
      client.debug = () => { };
      client.connect({}, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.subscribe("/topic/notifications", (msg: any) => {
          const notif: Notification = JSON.parse(msg.body);
          setNotifications(prev => [notif, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
          if (Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.message, icon: "/favicon.ico" });
          }
        });
      }, () => {
        console.warn("[NotificationBell] WebSocket connection failed");
      });
    };

    loadAndConnect();
  }, []);

  /* ── data helpers ──────────────────────────────────────────────────────── */
  const fetchCount = async () => {
    try {
      const res = await authFetch(`${API}/api/notifications/count`);
      const data = await res.json();
      setUnreadCount(data.count);
    } catch (e) {
      console.warn("[NotificationBell] Failed to fetch count:", e);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/notifications`);
      const data = await res.json();
      setNotifications(data);
    } catch (e) {
      console.warn("[NotificationBell] Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open) fetchNotifications();
  };

  const markAllRead = async () => {
    await authFetch(`${API}/api/notifications/mark-all-read`, { method: "POST" });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: number) => {
    await authFetch(`${API}/api/notifications/${id}/read`, { method: "POST" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearRead = async () => {
    await authFetch(`${API}/api/notifications/read`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => !n.read));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Bell button ────────────────────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/60 border border-transparent hover:border-[rgba(255,255,255,0.06)]"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#E10600] text-white f-mono text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none"
            style={{ boxShadow: "0 0 8px rgba(225,6,0,0.6)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 overflow-hidden rounded-xl"
            style={{
              background: "rgba(14,14,16,0.96)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(225,6,0,0.08)",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <span className="f-cond text-sm font-black text-white tracking-wide">NOTIFICATIONS</span>
                {unreadCount > 0 && (
                  <span
                    className="f-mono text-[10px] font-black bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/30 px-1.5 py-0.5 rounded leading-none"
                  >
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div className="flex gap-2.5">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="f-mono text-[11px] text-zinc-500 hover:text-white transition-colors">
                    Mark all read
                  </button>
                )}
                {notifications.some(n => n.read) && (
                  <button onClick={clearRead} className="f-mono text-[11px] text-zinc-600 hover:text-[#E10600] transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-[#E10600] rounded-full animate-spin" />
                  <p className="f-mono text-zinc-600 text-xs">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="f-mono text-zinc-600 text-xs tracking-widest">NO NOTIFICATIONS</p>
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                >
                  {notifications.map(n => {
                    const accent = TYPE_ACCENT[n.type] || "#71717a";
                    return (
                      <motion.div
                        key={n.id}
                        variants={{
                          hidden:  { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        onClick={() => !n.read && markRead(n.id)}
                        className={`relative flex gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)] cursor-pointer transition-colors ${
                          n.read ? "opacity-45" : "hover:bg-zinc-800/40"
                        }`}
                        style={{ borderLeft: `3px solid ${accent}` }}
                      >
                        {/* Unread glow strip */}
                        {!n.read && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: `linear-gradient(90deg, ${accent}08, transparent 60%)` }}
                          />
                        )}

                        <span className="text-base flex-shrink-0 relative z-10">{n.icon}</span>
                        <div className="flex-1 min-w-0 relative z-10">
                          <p className="f-mono text-xs font-bold text-white leading-snug">{n.title}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="f-mono text-[10px] text-zinc-600 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 relative z-10"
                            style={{ backgroundColor: "#E10600", boxShadow: "0 0 5px rgba(225,6,0,0.7)" }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.05)] text-center">
                <p className="f-mono text-[10px] text-zinc-700 tracking-widest">{notifications.length} TOTAL</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
