import { describe, expect, it } from "vitest";
import { flagForCountry, flagForNationality, getTeamColor, tyre } from "./f1-theme";

describe("getTeamColor", () => {
  it("prefers a valid backend colorHex over the canonical map", () => {
    expect(getTeamColor("McLaren", "#123456")).toBe("#123456");
  });

  it("adds a leading # to a bare hex value", () => {
    expect(getTeamColor("McLaren", "123456")).toBe("#123456");
  });

  it("falls back to the canonical team map when colorHex is absent", () => {
    expect(getTeamColor("McLaren", null)).toBe("#FF8000");
  });

  it("falls back to the canonical map when colorHex is malformed", () => {
    expect(getTeamColor("Ferrari", "not-a-hex")).toBe("#E8002D");
  });

  it("resolves team name aliases to the same color", () => {
    expect(getTeamColor("Ferrari")).toBe(getTeamColor("Scuderia Ferrari"));
    expect(getTeamColor("Red Bull")).toBe(getTeamColor("Red Bull Racing"));
  });

  it("returns the neutral grey for an unknown team with no colorHex", () => {
    expect(getTeamColor("Some New Team")).toBe("#9ca3af");
  });
});

describe("tyre", () => {
  it("is case-insensitive on the compound name", () => {
    expect(tyre("soft")).toEqual(tyre("SOFT"));
  });

  it("falls back to UNKNOWN for an unrecognised or missing compound", () => {
    expect(tyre("banana").letter).toBe("?");
    expect(tyre(undefined).letter).toBe("?");
    expect(tyre(null).letter).toBe("?");
  });

  it("carries the expected max stint length for each compound", () => {
    expect(tyre("SOFT").maxLaps).toBe(20);
    expect(tyre("HARD").maxLaps).toBe(40);
  });
});

describe("flagForNationality / flagForCountry", () => {
  it("returns the matching flag for a known value", () => {
    expect(flagForNationality("Dutch")).toBe("🇳🇱");
    expect(flagForCountry("Japan")).toBe("🇯🇵");
  });

  it("falls back to the checkered flag for unknown or missing values", () => {
    expect(flagForNationality("Atlantean")).toBe("🏁");
    expect(flagForCountry(undefined)).toBe("🏁");
  });
});
