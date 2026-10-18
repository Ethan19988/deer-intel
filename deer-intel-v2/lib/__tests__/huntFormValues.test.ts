import { describe, expect, it } from "vitest";
import { newHuntFormValues } from "@/lib/huntFormValues";

describe("newHuntFormValues", () => {
  it("defaults to today and the current local time", () => {
    const values = newHuntFormValues(new Date(2026, 10, 7, 15, 4));

    expect(values.date).toBe("2026-11-07");
    expect(values.startTime).toBe("15:04");
    expect(values.bucks).toBe("");
    expect(values.harvest).toBe("No");
  });

  it("keeps the property and stand you were just on", () => {
    const values = newHuntFormValues(new Date(2026, 0, 2, 6, 30), {
      propertyId: "p1",
      standId: "s1",
    });

    expect(values.propertyId).toBe("p1");
    expect(values.standId).toBe("s1");
    expect(values.date).toBe("2026-01-02");
  });
});
