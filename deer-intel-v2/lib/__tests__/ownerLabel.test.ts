import { describe, expect, it } from "vitest";
import { ownerAcresText, ownerDisplayName } from "@/lib/ownerLabel";

describe("ownerDisplayName", () => {
  it("drops legal suffixes", () => {
    expect(ownerDisplayName("SMITH JOHN R & MARY L ETAL")).toBe("SMITH JOHN R & MARY L");
    expect(ownerDisplayName("Brennan Ronald J ET UX")).toBe("BRENNAN RONALD J");
  });
  it("shortens state game lands", () => {
    expect(ownerDisplayName("COMMONWEALTH OF PA STATE GAME LANDS")).toBe("STATE GAME LANDS");
    expect(ownerDisplayName("COMMONWEALTH OF PA STATE GAME LANDS NO 211")).toBe("STATE GAME LANDS NO 211");
  });
  it("leaves ordinary names alone", () => {
    expect(ownerDisplayName("KESSLER FARMS LLC")).toBe("KESSLER FARMS LLC");
  });
});

describe("ownerAcresText", () => {
  it("formats acreage", () => {
    expect(ownerAcresText(84.2)).toBe("84.2 acres");
    expect(ownerAcresText(0)).toBe("");
  });
});
