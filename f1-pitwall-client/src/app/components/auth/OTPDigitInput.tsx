"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { F1 } from "../../lib/f1-theme";

interface OTPDigitInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OTPDigitInput({ value, onChange, onComplete, disabled, autoFocus }: OTPDigitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [completeFlash, setCompleteFlash] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const filledCount = digits.length;

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Flash animation per digit — intentional visual effect, not state sync
  useEffect(() => {
    if (filledCount > 0 && flashIndex === null) {
      const idx = filledCount - 1;
      setFlashIndex(idx);
      const t = setTimeout(() => setFlashIndex(null), 150);
      return () => clearTimeout(t);
    }
  }, [filledCount, flashIndex]);

  // Complete flash — intentional visual celebration, not state sync
  useEffect(() => {
    if (filledCount === 6 && onComplete && !completeFlash) {
      setCompleteFlash(true);
      const t = setTimeout(() => {
        onComplete(digits);
        setCompleteFlash(false);
      }, 400);
      return () => clearTimeout(t);
    }
    if (filledCount < 6) {
      setCompleteFlash(false);
    }
  }, [filledCount, digits, onComplete, completeFlash]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    onChange(raw);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits.length === 0) {
      onChange("");
    }
  }, [digits.length, onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) onChange(pasted);
  }, [onChange]);

  const focusInput = () => {
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="relative" onClick={focusInput}>
      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="text"
        value={digits}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-text"
        aria-label="Verification code"
      />

      {/* Visual digit boxes */}
      <div className="flex justify-center gap-2.5 select-none">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit = digits[i] || "";
          const isActive = i === filledCount;
          const isFilled = i < filledCount;
          const isFlashing = flashIndex === i;
          const isComplete = completeFlash && isFilled;

          return (
            <div
              key={i}
              className={`w-11 h-14 rounded-lg border flex items-center justify-center transition-all duration-200 ${isFlashing ? "digit-pop" : ""}`}
              style={{
                borderColor: isComplete
                  ? "rgba(0,230,118,0.6)"
                  : isActive
                    ? F1.red
                    : isFilled
                      ? "rgba(225,6,0,0.3)"
                      : F1.hairline,
                background: isComplete
                  ? "rgba(0,230,118,0.08)"
                  : isFlashing
                    ? "rgba(225,6,0,0.15)"
                    : "rgba(10,10,12,0.82)",
                boxShadow: isComplete
                  ? "0 0 14px rgba(0,230,118,0.25)"
                  : isActive
                    ? "0 0 14px rgba(225,6,0,0.25)"
                    : isFilled
                      ? "0 0 6px rgba(225,6,0,0.10)"
                      : "none",
              }}
            >
              <span
                className="f-mono text-2xl tabular-nums select-none"
                style={{ color: isFilled ? "#fff" : "transparent" }}
              >
                {digit || "0"}
              </span>

              {/* Blinking cursor on active empty box */}
              {isActive && !digit && (
                <span
                  className="absolute w-0.5 h-6 rounded-full cursor-blink"
                  style={{ background: F1.red }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
