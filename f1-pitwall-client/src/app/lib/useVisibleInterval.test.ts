import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisibleInterval } from "./useVisibleInterval";

let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });

/** Simulates the user switching away from (or back to) the tab. */
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useVisibleInterval", () => {
  it("runs on mount and then on every interval while visible", () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("stops while hidden and runs at once when visible again", () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    expect(callback).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does not run in a tab that mounts hidden", () => {
    visibility = "hidden";
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not double the interval on repeated visible events", () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("always calls the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useVisibleInterval(cb, 1000), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops polling and listening after unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useVisibleInterval(callback, 1000));

    unmount();
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
