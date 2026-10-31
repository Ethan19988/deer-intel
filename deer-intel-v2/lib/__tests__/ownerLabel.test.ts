import { describe, expect, it } from "vitest";
import {
  isPublicOwnerName,
  ownerAcresText,
  ownerDisplayName,
  ownersMatch,
} from "@/lib/ownerLabel";

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

describe("isPublicOwnerName", () => {
  it("recognizes state and public owners", () => {
    expect(isPublicOwnerName("COMMONWEALTH OF PA STATE GAME LANDS")).toBe(true);
    expect(isPublicOwnerName("PA DCNR BUREAU OF FORESTRY")).toBe(true);
    expect(isPublicOwnerName("TOWNSHIP OF POTTER")).toBe(true);
  });
  it("leaves private owners alone", () => {
    expect(isPublicOwnerName("SMITH JOHN R & MARY L")).toBe(false);
    expect(isPublicOwnerName("KESSLER FARMS LLC")).toBe(false);
  });
});

describe("ownersMatch", () => {
  it("ignores spacing, punctuation and legal suffixes", () => {
    expect(ownersMatch("SMITH, JOHN R.", "smith john r")).toBe(true);
    expect(ownersMatch("SMITH JOHN R ETAL", "SMITH JOHN R")).toBe(true);
    expect(ownersMatch("MC DONALD JAMES", "MCDONALD JAMES")).toBe(true);
  });
  it("matches a co-owned record against a shorter form", () => {
    // Tile joins OWNER1 + OWNER2; an older card read OWNER1 only.
    expect(ownersMatch("SMITH JOHN R", "SMITH JOHN R & MARY L")).toBe(true);
    expect(ownersMatch("SMITH MARY L", "SMITH JOHN R & MARY L")).toBe(true);
    // A fixed-width field cut mid-word.
    expect(ownersMatch("SMITH JOHN R & MA", "SMITH JOHN R & MARY L")).toBe(true);
  });
  it("still flags a real change of owner", () => {
    expect(ownersMatch("SMITH JOHN R", "KESSLER FARMS LLC")).toBe(false);
    expect(ownersMatch("SMITH JOHN", "SMITH ROBERT")).toBe(false);
    expect(ownersMatch("SMITH", "SMITHERS FARM")).toBe(false);
  });
});
