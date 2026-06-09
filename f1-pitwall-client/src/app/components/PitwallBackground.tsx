"use client";

/**
 * PitwallBackground — the shared "Pit Wall OS" atmosphere.
 * Animated grid, carbon-weave scanlines, red radial glow, vignette, and
 * light-streak accents. Drop once per page as the first child of a relative
 * container (it is fixed + pointer-events-none, sits behind z-10 content).
 *
 * Usage:
 *   <div className="min-h-screen relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
 *     <PitwallBackground />
 *     <Navbar />
 *     <main className="relative z-10 ...">...</main>
 *   </div>
 */
export default function PitwallBackground({
  glow = "top-left",
  streaks = 4,
  intensity = 1,
}: {
  glow?: "top-left" | "top-right" | "top-center" | "none";
  streaks?: number;
  intensity?: number;
}) {
  const glowGradient = {
    "top-left": "radial-gradient(120% 80% at 15% -10%, rgba(225,6,0,.10), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(120,10,10,.10), transparent 50%)",
    "top-right": "radial-gradient(120% 80% at 85% -10%, rgba(225,6,0,.10), transparent 55%)",
    "top-center": "radial-gradient(120% 80% at 50% -10%, rgba(225,6,0,.10), transparent 55%)",
    "none": "none",
  }[glow];

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden style={{ opacity: intensity }}>
      {/* Red radial glow */}
      {glow !== "none" && <div className="absolute inset-0" style={{ background: glowGradient }} />}
      {/* Panning tech grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
          backgroundSize: "80px 80px",
          animation: "grid-pan 6s linear infinite",
          maskImage: "radial-gradient(circle at 50% 25%,black,transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 25%,black,transparent 80%)",
        }}
      />
      {/* Carbon-weave scanlines */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)",
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
      {/* Light streaks */}
      {Array.from({ length: streaks }).map((_, i) => (
        <div
          key={i}
          className="absolute h-px"
          style={{
            width: `${120 + i * 45}px`,
            top: `${14 + i * 18}%`,
            left: "-10%",
            background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)",
            animation: `streak ${5 + i * 1.4}s linear infinite`,
            animationDelay: `${i * 1.3}s`,
          }}
        />
      ))}
    </div>
  );
}
