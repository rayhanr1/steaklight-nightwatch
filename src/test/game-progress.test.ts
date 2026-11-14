import { describe, expect, it } from "vitest";
import { simulationDelta, progressSchema } from "@/game/progress";

describe("pause and progress", () => {
  it("freezes simulation time until resumed", () => {
    expect(simulationDelta(true, 4)).toBe(0);
    expect(simulationDelta(false, 0.02)).toBe(0.02);
    expect(simulationDelta(false, 4)).toBe(0.05);
  });
  it("rejects incomplete or incompatible saved progress", () => {
    expect(progressSchema.safeParse({ version: 1, world: { level: 2 } }).success).toBe(false);
    expect(progressSchema.safeParse({ version: 99 }).success).toBe(false);
  });
});