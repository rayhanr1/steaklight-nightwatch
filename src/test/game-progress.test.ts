import { describe, expect, it } from "vitest";
import { simulationDelta, progressSchema } from "@/game/progress";

describe("pause and progress", () => {
  it("preserves shield rebound time and loads older mobs with no rebound", () => {
    const schema = progressSchema.shape.world.shape.enemies.element;
    const mob = { x: 0, y: 0, w: 32, h: 40, vx: -180, vy: 0, bounces: 0, maxBounces: 2, entered: true, kind: "zombie", bob: 0, timer: 2, fuse: 0 };
    expect(schema.parse({ ...mob, repelTimer: 0.75 }).repelTimer).toBe(0.75);
    expect(schema.parse(mob).repelTimer).toBe(0);
  });
  it("restores older life totals above 14 at the current cap", () => {
    expect(progressSchema.shape.world.shape.hearts.parse(30)).toBe(14);
    expect(progressSchema.shape.world.shape.hearts.parse(13.5)).toBe(13.5);
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
describe("saved Enderman state", () => {
  it("preserves level 22 exactly", () => {
    expect(progressSchema.shape.world.shape.level.parse(22)).toBe(22);
  });
  it("retains health, windup, sword identifier and spawn schedule", () => {
    const e = progressSchema.shape.world.shape.enemies.element.parse({ x: 10, y: 20, w: 40, h: 88, vx: 0, vy: 0, bounces: 0, maxBounces: 2, entered: true, kind: "enderman", bob: 0, timer: 0, fuse: 0, hp: 2, attackPhase: "windup", attackTimer: 0.7, lastSwordSwing: 4 });
    expect(e.hp).toBe(2);
    expect(e.attackTimer).toBe(0.7);
    expect(e.attackPhase).toBe("windup");
    expect(e.lastSwordSwing).toBe(4);
    expect(progressSchema.shape.world.shape.endermanTimer.parse(-1)).toBe(-1);
    expect(progressSchema.shape.world.shape.endermanTimer.parse(4)).toBe(4);
  });
});
