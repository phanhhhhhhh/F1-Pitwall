"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Driver {
  id?: number;
  name: string;
  team: string;
  carNumber: number;
}

export default function Home() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newNumber, setNewNumber] = useState("");

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/drivers`);
      if (!res.ok) throw new Error("Không thể kết nối tới server");
      const data = await res.json();
      setDrivers(data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const newDriver = {
      name: newName,
      team: newTeam,
      carNumber: Number(newNumber),
    };

    try {
      const response = await fetch(`${API_URL}/api/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Thêm tay đua thất bại");
      }

      setNewName("");
      setNewTeam("");
      setNewNumber("");
      fetchDrivers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;

    try {
      const response = await fetch(`${API_URL}/api/drivers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Xóa thất bại");
      }

      fetchDrivers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-10 text-white font-sans selection:bg-red-500/30">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">

        <div className="lg:col-span-1">
          <div className="sticky top-10 bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl backdrop-blur-md">
            <h2 className="text-2xl font-bold mb-6 text-red-500 border-b border-zinc-800 pb-4">
              [ ADD DRIVER ]
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">DRIVER NAME</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="e.g. Max Verstappen"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">TEAM</label>
                <input
                  type="text"
                  required
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="e.g. Red Bull Racing"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">CAR NUMBER</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={99}
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="e.g. 1"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-6 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center space-x-2"
              >
                <span>{submitting ? "⏳ ĐANG GỬI..." : "🚀 PUSH TO DATABASE"}</span>
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-10 border-b border-zinc-800 pb-6">
            <h1 className="text-5xl font-black tracking-tighter mb-2 text-transparent bg-clip-text bg-linear-to-r from-red-600 to-orange-500">
              F1 PITWALL SAAS
            </h1>
            <p className="text-zinc-400 font-mono text-sm tracking-widest uppercase">
              Live Roster Telemetry / Active Drivers
            </p>
          </div>

          {loading ? (
            <div className="flex items-center space-x-3 text-red-500 animate-pulse font-mono">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>CONNECTING TO THE CENTRAL SERVER...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="group relative bg-zinc-900 border border-zinc-800 p-6 rounded-2xl overflow-hidden hover:border-red-500/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.2)] hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-linear-to-bl from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <button
                    onClick={() => handleDelete(driver.id)}
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-full text-zinc-500 hover:text-red-500 hover:border-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete this driver"
                    aria-label="Delete this driver"
                    type="button"
                  >
                    ×
                  </button>
                  <div className="absolute -bottom-4 -right-2 text-8xl font-black text-zinc-800/50 group-hover:text-red-500/10 transition-colors pointer-events-none">
                    {driver.carNumber}
                  </div>
                  <div className="relative z-10">
                    <div className="text-4xl font-black text-zinc-100 mb-4">{driver.carNumber}</div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">{driver.name}</h2>
                    <p className="text-xs font-bold mt-2 text-red-400 uppercase tracking-widest">{driver.team}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
