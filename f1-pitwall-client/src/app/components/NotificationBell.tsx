"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch initial count
  useEffect(() => {
    if (!getAccessToken()) return;
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for real-time notifications
  useEffect(() => {
    if (!getAccessToken()) return;

    const loadAndConnect = () => {
      // Reuse existing SockJS/Stomp if already loaded
      if (typeof window !== "undefined" && (window as any).Stomp) {
        connectWs();
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
      s.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@6/bundles/stomp.umd.min.js";
        s2.onload = () => setTimeout(connectWs, 200);
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    };

    const connectWs = () => {
      const w = window as any;
      const factory = w.Stomp ?? w.StompJs?.Stomp;
      if (!factory) return;
      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/ws";
      const client = factory.over(() => new w.SockJS(wsUrl));
      client.debug = () => {};
      client.connect({}, () => {
        client.subscribe("/topic/notifications", (msg: any) => {
          const notif: Notification = JSON.parse(msg.body);
          setNotifications(prev => [notif, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
          // Browser notification if supported
          if (Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.message, icon: "/favicon.ico" });
          }
        });
      });
    };

    loadAndConnect();
  }, []);

  const fetchCount = async () => {
    try {
      const res = await authFetch(`${API}/api/notifications/count`);
      const data = await res.json();
      setUnreadCount(data.count);
    } catch (e) {}
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/notifications`);
      const data = await res.json();
      setNotifications(data);
    } catch (e) {} finally {
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

  const typeColor: Record<string, string> = {
    RACE_RESULT: "border-l-yellow-500",
    DNF: "border-l-red-500",
    STATUS_CHANGE: "border-l-blue-500",
    SYSTEM: "border-l-zinc-500",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button onClick={handleOpen}
        className="relative p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-zinc-500 hover:text-white transition-colors font-mono">
                  Mark all read
                </button>
              )}
              {notifications.some(n => n.read) && (
                <button onClick={clearRead}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-zinc-600 text-sm font-mono">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-600 text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 border-b border-zinc-800/50 border-l-2 cursor-pointer transition-colors
                    ${n.read ? "opacity-50" : "hover:bg-zinc-800/50"}
                    ${typeColor[n.type] || "border-l-zinc-700"}`}>
                  <span className="text-lg flex-shrink-0">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{n.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-zinc-600 mt-1 font-mono">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-zinc-800 text-center">
              <p className="text-xs text-zinc-600 font-mono">{notifications.length} total notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
