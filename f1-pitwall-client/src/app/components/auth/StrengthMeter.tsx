"use client";

interface StrengthMeterProps {
  password: string;
}

const LEVELS = [
  { color: "rgba(63,63,70,0.5)", label: "" },
  { color: "#ef4444", label: "WEAK" },
  { color: "#eab308", label: "FAIR" },
  { color: "#22c55e", label: "GOOD" },
  { color: "#a855f7", label: "ELITE" },
] as const;

function score(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export function StrengthMeter({ password }: StrengthMeterProps) {
  const s = score(password);
  if (!password) return null;

  const active = LEVELS[s];

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-0.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= s ? active.color : "rgba(63,63,70,0.5)",
              transitionDelay: `${(i - 1) * 100}ms`,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="f-mono text-[10px] font-bold" style={{ color: active.color }}>
          {active.label}
        </p>
        {s === 4 && (
          <span className="f-mono text-[10px] text-purple-400/60">
            ◆ SECTOR PURPLE
          </span>
        )}
      </div>
    </div>
  );
}
