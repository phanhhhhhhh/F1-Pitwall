"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playRadioChirp } from "../lib/f1-sound";
import { getTeamColor } from "../lib/f1-theme";

export interface RadioTransmission {
  id: string;
  driverName: string;
  driverNumber: number;
  teamName: string;
  teamColor: string;
  engineerName: string;
  speaker: "DRIVER" | "ENGINEER";
  transcript: string;
  category: "BOX" | "STRATEGY" | "OVERTAKE" | "INCIDENT" | "RADIO_CHECK" | "COMPLAINT";
  lap: number;
  timestamp: string;
  urgency?: "HIGH" | "MEDIUM" | "NORMAL";
}

/**
 * No public API publishes team radio transcripts (OpenF1's team_radio endpoint is audio-only,
 * with no transcript). This feed is invented sample dialogue, not sourced from any race — the
 * "SIMULATED" badge below says so on its face.
 */
const SAMPLE_RADIO_FEED: RadioTransmission[] = [
  {
    id: "r-1",
    driverName: "Max Verstappen",
    driverNumber: 1,
    teamName: "Red Bull Racing",
    teamColor: "#3671C6",
    engineerName: "GP (Gianpiero)",
    speaker: "DRIVER",
    transcript: "Mate, my rear tyres are completely cooked! I have zero traction on exit.",
    category: "COMPLAINT",
    lap: 24,
    timestamp: "14:32:15",
    urgency: "HIGH",
  },
  {
    id: "r-2",
    driverName: "Max Verstappen",
    driverNumber: 1,
    teamName: "Red Bull Racing",
    teamColor: "#3671C6",
    engineerName: "GP (Gianpiero)",
    speaker: "ENGINEER",
    transcript: "Understood Max. Box, box! Box for Hards. Strat mode 4 on in-lap.",
    category: "BOX",
    lap: 24,
    timestamp: "14:32:28",
    urgency: "HIGH",
  },
  {
    id: "r-3",
    driverName: "Lando Norris",
    driverNumber: 4,
    teamName: "McLaren",
    teamColor: "#FF8000",
    engineerName: "Will Joseph",
    speaker: "ENGINEER",
    transcript: "Lando, Verstappen has boxed. We need clean laps now. Target lap time 1:18.2.",
    category: "STRATEGY",
    lap: 25,
    timestamp: "14:33:05",
    urgency: "MEDIUM",
  },
  {
    id: "r-4",
    driverName: "Charles Leclerc",
    driverNumber: 16,
    teamName: "Ferrari",
    teamColor: "#E8002D",
    engineerName: "Bryan Bozzi",
    speaker: "DRIVER",
    transcript: "We are fast on the straights. Tell me if we stick with Plan B or switch to Plan C?",
    category: "STRATEGY",
    lap: 27,
    timestamp: "14:35:42",
    urgency: "NORMAL",
  },
  {
    id: "r-5",
    driverName: "Lewis Hamilton",
    driverNumber: 44,
    teamName: "Ferrari",
    teamColor: "#E8002D",
    engineerName: "Riccardo Adami",
    speaker: "DRIVER",
    transcript: "Hammer time! Gap ahead is down to 0.8 seconds, I have DRS.",
    category: "OVERTAKE",
    lap: 30,
    timestamp: "14:39:10",
    urgency: "HIGH",
  },
  {
    id: "r-6",
    driverName: "Fernando Alonso",
    driverNumber: 14,
    teamName: "Aston Martin",
    teamColor: "#229971",
    engineerName: "Chris Cronin",
    speaker: "DRIVER",
    transcript: "Whatever you do, don't put me in traffic. The car feels amazing in clean air.",
    category: "STRATEGY",
    lap: 32,
    timestamp: "14:42:01",
    urgency: "MEDIUM",
  },
  {
    id: "r-7",
    driverName: "George Russell",
    driverNumber: 63,
    teamName: "Mercedes",
    teamColor: "#27F4D2",
    engineerName: "Marcus Dudley",
    speaker: "ENGINEER",
    transcript: "Yellow Flag Sector 2. Debris on Turn 4 exit. Watch your tyre delta.",
    category: "INCIDENT",
    lap: 35,
    timestamp: "14:46:18",
    urgency: "HIGH",
  },
];

function AudioWaveform({ isPlaying, color }: { isPlaying: boolean; color: string }) {
  const bars = [14, 28, 42, 22, 38, 50, 32, 18, 45, 26, 36, 16];

  return (
    <div className="flex items-center gap-1 h-8 px-2">
      {bars.map((baseHeight, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            isPlaying
              ? {
                  height: [8, baseHeight, 10, baseHeight * 0.7, 8],
                }
              : { height: 6 }
          }
          transition={{
            duration: 0.8,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.06,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function TeamRadioFeed({ className = "" }: { className?: string }) {
  const transmissions = SAMPLE_RADIO_FEED;
  const [activeTransmission, setActiveTransmission] = useState<RadioTransmission | null>(
    SAMPLE_RADIO_FEED[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const playRadio = (item: RadioTransmission) => {
    setActiveTransmission(item);
    setIsPlaying(true);
    playRadioChirp();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsPlaying(false);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const categories = ["ALL", "BOX", "STRATEGY", "OVERTAKE", "INCIDENT", "COMPLAINT"];

  const filtered = transmissions.filter(
    (t) => selectedFilter === "ALL" || t.category === selectedFilter
  );

  return (
    <div
      className={`relative rounded-3xl bg-black/60 border border-zinc-800 backdrop-blur-xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Top Banner with Active Radio Wave */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="w-3 h-3 rounded-full bg-emerald-500 block animate-ping absolute inset-0" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 block relative" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="f-cond font-black text-sm uppercase tracking-wider text-white">
                TEAM RADIO COMM FREQUENCY
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-[10px] f-mono font-bold text-amber-400">
                SIMULATED
              </span>
            </div>
            <p className="f-mono text-[10px] text-zinc-400">
              Sample dialogue — no public feed publishes real radio transcripts
            </p>
          </div>
        </div>

        {/* Active Audio Waveform & Speaker */}
        {activeTransmission && (
          <div className="flex items-center gap-3 bg-black/60 px-3 py-1.5 rounded-2xl border border-zinc-800">
            <AudioWaveform
              isPlaying={isPlaying}
              color={activeTransmission.teamColor || "#E10600"}
            />
            <button
              onClick={() => playRadio(activeTransmission)}
              className="px-3 py-1 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 hover:text-white text-xs f-mono font-bold transition-all flex items-center gap-1.5"
            >
              <span>{isPlaying ? "🔊 PLAYING" : "▶ REPLAY"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="px-4 py-2.5 border-b border-zinc-800/50 bg-black/30 flex items-center gap-1.5 overflow-x-auto">
        <span className="f-mono text-[10px] text-zinc-500 font-bold uppercase mr-1">FILTER:</span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedFilter(cat)}
            className={`px-2.5 py-1 rounded-lg text-[10px] f-mono font-bold uppercase transition-all whitespace-nowrap ${
              selectedFilter === cat
                ? "bg-red-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Radio Messages Feed List */}
      <div className="divide-y divide-zinc-800/60 max-h-[360px] overflow-y-auto p-2">
        <AnimatePresence>
          {filtered.map((msg) => {
            const isSelected = activeTransmission?.id === msg.id;
            const tColor = msg.teamColor || getTeamColor(msg.teamName);

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => playRadio(msg)}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? "bg-zinc-900/90 border border-zinc-700/80 shadow-lg"
                    : "hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tColor, boxShadow: `0 0 8px ${tColor}` }}
                    />
                    <span className="f-cond font-bold text-xs uppercase text-white">
                      #{msg.driverNumber} {msg.driverName}
                    </span>
                    <span className="text-[10px] f-mono text-zinc-500">· {msg.teamName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] f-mono font-black uppercase bg-zinc-800 text-zinc-300">
                      LAP {msg.lap}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] f-mono font-black uppercase border ${
                        msg.category === "BOX"
                          ? "bg-red-950 text-red-400 border-red-800"
                          : msg.category === "STRATEGY"
                          ? "bg-blue-950 text-blue-400 border-blue-800"
                          : msg.category === "OVERTAKE"
                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {msg.category}
                    </span>
                  </div>
                </div>

                {/* Speaker indicator & Transcript */}
                <div className="flex items-start gap-2.5 mt-2 pl-4 border-l-2" style={{ borderColor: tColor }}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] f-mono font-bold text-zinc-400">
                        {msg.speaker === "DRIVER" ? "🏎️ DRIVER" : `🎧 RACE ENGINEER (${msg.engineerName})`}
                      </span>
                      <span className="text-[9px] f-mono text-zinc-600">{msg.timestamp}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-zinc-100 italic leading-relaxed">
                      &ldquo;{msg.transcript}&rdquo;
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
