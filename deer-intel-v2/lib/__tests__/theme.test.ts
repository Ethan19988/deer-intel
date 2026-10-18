import { describe, expect, it } from "vitest";
import { resolveDaylightTheme } from "@/lib/theme";

const sun = { sunriseMin: 7 * 60 + 28, sunsetMin: 18 * 60 + 27 };

describe("resolveDaylightTheme", () => {
  it("is dark before and just after sunrise", () => {
    expect(resolveDaylightTheme(6 * 60, sun)).toBe("dark");
    expect(resolveDaylightTheme(8 * 60, sun)).toBe("dark");
  });

  it("is light through the middle of the day", () => {
    expect(resolveDaylightTheme(8 * 60 + 28, sun)).toBe("light");
    expect(resolveDaylightTheme(13 * 60, sun)).toBe("light");
  });

  it("goes dark 2.5 hours before sunset for the evening sit", () => {
    expect(resolveDaylightTheme(15 * 60 + 56, sun)).toBe("light");
    expect(resolveDaylightTheme(15 * 60 + 57, sun)).toBe("dark");
    expect(resolveDaylightTheme(22 * 60, sun)).toBe("dark");
  });
});
