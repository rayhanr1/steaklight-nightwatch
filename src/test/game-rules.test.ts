import { describe, expect, it } from "vitest";
import {
  applyContact,
  BLOCK_DURABILITY,
  hitBlock,
  mobKindsForLevel,
  resourceKindsForLevel,
  swordHits,
  DEFAULT_SETTINGS,
  levelConfig,
  stepMover,
  type Mover,
} from "@/game/rules";

const W = 800, H = 600;

describe("game rules", () => {
  it("defaults to a 5 second day and a 20 second night", () => {
    expect(DEFAULT_SETTINGS.dayDuration).toBe(5);
    expect(DEFAULT_SETTINGS.nightDuration).toBe(20);
  });

  it("each level makes the day one second longer", () => {
    expect(levelConfig(1, DEFAULT_SETTINGS).dayDuration).toBe(5);
    expect(levelConfig(2, DEFAULT_SETTINGS).dayDuration).toBe(6);
    expect(levelConfig(5, DEFAULT_SETTINGS).dayDuration).toBe(9);
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

  it("night length stays fixed across levels", () => {
    expect(levelConfig(1, DEFAULT_SETTINGS).nightDuration).toBe(20);
    expect(levelConfig(6, DEFAULT_SETTINGS).nightDuration).toBe(20);
  });

  it("wood breaks in 1 hit, stone in 2, iron in 3", () => {
    expect(BLOCK_DURABILITY).toEqual({ wood: 1, stone: 2, iron: 3 });
    expect(hitBlock(BLOCK_DURABILITY.wood)).toBe(0);
    expect(hitBlock(hitBlock(BLOCK_DURABILITY.stone))).toBe(0);
    expect(hitBlock(hitBlock(BLOCK_DURABILITY.iron))).toBe(1);
  });

  it("unlocks stone on level 2 and iron on level 3", () => {
    expect(resourceKindsForLevel(1)).toEqual(["wood"]);
    expect(resourceKindsForLevel(2)).toEqual(["wood", "stone"]);
    expect(resourceKindsForLevel(3)).toEqual(["wood", "stone", "iron"]);
  });

  it("zombies join on level 2 and spiders on level 3", () => {
    expect(mobKindsForLevel(1)).not.toContain("zombie");
    expect(mobKindsForLevel(2)).toContain("zombie");
    expect(mobKindsForLevel(2)).not.toContain("spider");
    expect(mobKindsForLevel(3)).toContain("spider");
  });

  it("the sword only hits mobs in front of Steve", () => {
    const steve = { x: 100, y: 100, w: 32, h: 64 };
    const right = { x: 150, y: 100, w: 32, h: 64 };
    expect(swordHits(steve, 1, right)).toBe(true);
    expect(swordHits(steve, -1, right)).toBe(false);
  });

  it("an arrow takes half a heart", () => {
    expect(applyContact(3, "arrow")).toBe(2.5);
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
