import { describe, expect, it } from "vitest";
import {
  applyContact,
  DEFAULT_SETTINGS,
  levelConfig,
  stepMover,
  type Mover,
} from "@/game/rules";

const W = 800, H = 600;

describe("game rules", () => {
  it("defaults to a 30 second day and a 60 second night", () => {
    expect(DEFAULT_SETTINGS.dayDuration).toBe(30);
    expect(DEFAULT_SETTINGS.nightDuration).toBe(60);
  });

  it("a steak adds half a heart", () => {
    expect(applyContact(3, "steak")).toBe(3.5);
  });

  it("a skeleton takes half a heart", () => {
    expect(applyContact(3, "skeleton")).toBe(2.5);
  });

  it("a creeper takes one heart", () => {
    expect(applyContact(3, "creeper")).toBe(2);
  });

  it("hearts never go below zero", () => {
    expect(applyContact(0.5, "creeper")).toBe(0);
  });

  it("each level makes the night longer", () => {
    const l1 = levelConfig(1, DEFAULT_SETTINGS);
    const l2 = levelConfig(2, DEFAULT_SETTINGS);
    expect(l1.nightDuration).toBe(60);
    expect(l2.nightDuration).toBeGreaterThan(l1.nightDuration);
  });

  it("each level spawns enemies more often", () => {
    const l1 = levelConfig(1, DEFAULT_SETTINGS);
    const l2 = levelConfig(2, DEFAULT_SETTINGS);
    expect(l2.enemySpawnInterval).toBeLessThan(l1.enemySpawnInterval);
  });

  it("a faster enemy speed setting moves enemies faster", () => {
    expect(levelConfig(1, { ...DEFAULT_SETTINGS, enemySpeed: 8 }).enemySpeed).toBeGreaterThan(
      levelConfig(1, { ...DEFAULT_SETTINGS, enemySpeed: 2 }).enemySpeed,
    );
  });

  it("an enemy bounces off two edges and leaves on the third", () => {
    // Moving right: bounces off the right edge, then the left edge, then leaves through the right edge.
    const m: Mover = { x: 400, y: 300, w: 10, h: 10, vx: 1000, vy: 0, bounces: 0, maxBounces: 2, entered: true };
    let alive = true;
    let steps = 0;
    while (alive && steps < 10000) {
      alive = stepMover(m, 0.01, W, H);
      steps++;
    }
    expect(m.bounces).toBe(2);
    expect(alive).toBe(false);
    expect(m.x).toBeGreaterThan(W); // left through the right edge after bouncing right, then left
  });
});
