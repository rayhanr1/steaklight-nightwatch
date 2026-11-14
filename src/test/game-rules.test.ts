import { describe, expect, it } from "vitest";
import {
  applyContact,
  clampHearts,
  MAX_HEARTS,
  HEARTS_PER_ROW,
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
    expect(DEFAULT_SETTINGS.enemySpeed).toBe(5);
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

  it("caps life at 18 hearts including healing at the limit", () => {
    expect(MAX_HEARTS).toBe(18);
    expect(clampHearts(30)).toBe(18);
    expect(applyContact(17.5, "steak")).toBe(18);
    expect(applyContact(18, "steak")).toBe(18);
    expect(applyContact(18, "skeleton")).toBe(17.5);
  });

  it("allocates nine hearts per row for two rows at maximum life", () => {
    expect(HEARTS_PER_ROW).toBe(9);
    expect(MAX_HEARTS / HEARTS_PER_ROW).toBe(2);
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
    expect(BLOCK_DURABILITY).toMatchObject({ wood: 1, stone: 2, iron: 3 });
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

  it("eases wave frequency at level 10 and limits later wave growth", () => {
    const level10 = levelConfig(10, DEFAULT_SETTINGS);
    expect(level10.enemySpawnInterval).toBeCloseTo(2.2 * 0.93 ** 9);
    expect(level10.enemiesPerWave).toBe(4);
    expect(levelConfig(30, DEFAULT_SETTINGS).enemySpawnInterval).toBe(1);
    expect(levelConfig(30, DEFAULT_SETTINGS).enemiesPerWave).toBe(4);
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

import { mergeHighScore, runScore } from "@/game/rules";
describe("high score", () => {
  it("scores 100 per level cleared, 10 per mob, 5 per steak", () => {
    expect(runScore(2, 3, 4)).toBe(250);
  });
  it("only replaces the high score when beaten", () => {
    expect(mergeHighScore({ score: 300, level: 3 }, { score: 120, level: 2 })).toEqual({ score: 300, level: 3 });
    expect(mergeHighScore({ score: 300, level: 3 }, { score: 450, level: 4 })).toEqual({ score: 450, level: 4 });
  });
});

import { RESOURCE_MAX_ON_SCREEN, STEAK_MAX_ON_SCREEN, TNT_FUSE_SECONDS, steakConfig } from "@/game/rules";
describe("steak supply", () => {
  it("reduces steak counts and slows spawning while preserving level growth", () => {
    expect(steakConfig(1)).toEqual({ maxOnScreen: 6, spawnMin: 0.9, spawnMax: 1.8 });
    expect(steakConfig(5).maxOnScreen).toBe(8);
    expect(steakConfig(10).maxOnScreen).toBe(18);
    expect(steakConfig(10).spawnMin).toBeCloseTo(0.9 * 0.85 ** 6);
    expect(steakConfig(10).spawnMax).toBeCloseTo(1.8 * 0.85 ** 6);
    expect(steakConfig(50).spawnMin).toBe(0.3);
    expect(steakConfig(50).spawnMax).toBe(0.6);
  });
  it("stays at the base rate through level 4", () => {
    for (const level of [1, 2, 3, 4]) {
      expect(steakConfig(level).maxOnScreen).toBe(STEAK_MAX_ON_SCREEN);
    }
  });
  it("more steaks float by from level 5, and more each level after", () => {
    expect(steakConfig(5).maxOnScreen).toBeGreaterThan(STEAK_MAX_ON_SCREEN);
    expect(steakConfig(6).maxOnScreen).toBeGreaterThan(steakConfig(5).maxOnScreen);
  });
  it("steaks spawn faster from level 5", () => {
    expect(steakConfig(5).spawnMax).toBeLessThan(steakConfig(4).spawnMax);
  });
  it("steak supply keeps growing beyond level 10 without a level cap", () => {
    expect(steakConfig(11).maxOnScreen).toBe(20);
    expect(steakConfig(12).maxOnScreen).toBe(22);
    expect(steakConfig(50).maxOnScreen).toBe(98);
  });
});

import { STEVE_SPEED_BASE, steveSpeed } from "@/game/rules";
describe("steve speed", () => {
  it("stays at base speed through level 9", () => {
    for (const level of [1, 5, 9]) {
      expect(steveSpeed(level)).toBe(STEVE_SPEED_BASE);
    }
  });
  it("steve gets faster from level 10, and faster each level after", () => {
    expect(steveSpeed(10)).toBeGreaterThan(STEVE_SPEED_BASE);
    expect(steveSpeed(11)).toBeGreaterThan(steveSpeed(10));
  });
});
describe("tnt and block supply", () => {
  it("tnt only appears from level 5", () => {
    expect(resourceKindsForLevel(4)).not.toContain("tnt");
    expect(resourceKindsForLevel(5)).toContain("tnt");
  });
  it("tnt explodes 1 second after placing", () => {
    expect(TNT_FUSE_SECONDS).toBe(1);
  });
  it("more blocks can float by during the day", () => {
    expect(RESOURCE_MAX_ON_SCREEN).toBeGreaterThan(3);
  });
});
