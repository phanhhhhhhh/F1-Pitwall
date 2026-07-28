"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { F1 } from "../../lib/f1-theme";

interface AuthInputProps {
  id: string;
  label: string;
  type: "text" | "email" | "password";
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoFocus?: boolean;
  terminal?: boolean;
  error?: string;
  extra?: ReactNode;
  focused: string | null;
  setFocused: (v: string | null) => void;
  rightElement?: ReactNode;
}

export function AuthInput({
  id, label, type, value, onChange, placeholder,
  autoComplete, required, inputMode, maxLength, autoFocus,
  terminal = false, error, extra, focused, setFocused, rightElement,
}: AuthInputProps) {
  const active = focused === id;
  const hasError = !!error;

  return (
    <div>
      <label htmlFor={id} className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">
        {label}
      </label>
      <div className="relative">
        {/* Terminal prompt ">" */}
        {terminal && (
          <span
            className={`absolute left-3 top-1/2 -translate-y-1/2 f-mono text-sm font-bold pointer-events-none select-none ${active ? "cursor-blink" : ""}`}
            style={{ color: active ? F1.red : "#52525b", transition: "color 300ms" }}
          >
            &gt;
          </span>
        )}

        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(id)}
          onBlur={() => setFocused(null)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className="w-full f-mono border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg py-3 text-sm"
          style={{
            borderColor: hasError ? "#ef4444" : active ? F1.red : F1.hairline,
            boxShadow: hasError
              ? "0 0 14px rgba(239,68,68,0.18)"
              : active
                ? `0 0 18px rgba(225,6,0,0.18)`
                : "none",
            background: "rgba(10,10,12,0.82)",
            paddingLeft: terminal ? "2rem" : "1rem",
            paddingRight: "1rem",
          }}
        />

        {/* Bottom accent scan-line on focus */}
        <AnimatePresence>
          {active && !hasError && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 h-px rounded-full"
              style={{ background: F1.red, transformOrigin: "left" }}
            />
          )}
        </AnimatePresence>

        {/* Right-side indicator */}
        {active && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: hasError ? "#ef4444" : F1.red }}
          />
        )}

        {/* Custom right element (e.g. show/hide password toggle) */}
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="f-mono text-[10px] text-red-400 mt-1">{error}</p>
      )}

      {/* Extra content (strength meter, match indicator, etc.) */}
      {extra}
    </div>
  );
}
