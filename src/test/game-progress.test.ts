import { describe, expect, it } from "vitest";
import { simulationDelta, progressSchema } from "@/game/progress";

describe("pause and progress", () => {
  it("preserves shield rebound time and loads older mobs with no rebound", () => {
    const schema = progressSchema.shape.world.shape.enemies.element;
    const mob = { x: 0, y: 0, w: 32, h: 40, vx: -180, vy: 0, bounces: 0, maxBounces: 2, entered: true, kind: "zombie", bob: 0, timer: 2, fuse: 0 };
    expect(schema.parse({ ...mob, repelTimer: 0.75 }).repelTimer).toBe(0.75);
    expect(schema.parse(mob).repelTimer).toBe(0);
  });
  it("restores older life totals above 16 at the current cap", () => {
    expect(progressSchema.shape.world.shape.hearts.parse(30)).toBe(16);
    expect(progressSchema.shape.world.shape.hearts.parse(15.5)).toBe(15.5);
  });
  it("normalizes older day settings to the 20 second cap", () => {
    expect(progressSchema.shape.settings.shape.dayDuration.parse(120)).toBe(20);
  });
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