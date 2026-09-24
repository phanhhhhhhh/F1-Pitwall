import { describe, expect, it } from "vitest";
import { avatarFileName } from "./avatar";

describe("avatarFileName", () => {
  it("maps allowed image types to a fixed extension", () => {
    expect(avatarFileName("image/png")).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(avatarFileName("image/jpeg")).toMatch(/\.jpg$/);
    expect(avatarFileName("image/webp")).toMatch(/\.webp$/);
    expect(avatarFileName("image/gif")).toMatch(/\.gif$/);
  });

  it("rejects everything else, including SVG (scriptable) and unknown types", () => {
    expect(avatarFileName("image/svg+xml")).toBeNull();
    expect(avatarFileName("text/html")).toBeNull();
    expect(avatarFileName("")).toBeNull();
  });

  it("never repeats, so one upload cannot overwrite another", () => {
    expect(avatarFileName("image/png")).not.toBe(avatarFileName("image/png"));
  });
});
