import { describe, expect, it } from "vitest";
import {
  applyContact,
  clampHearts,
  MAX_HEARTS,
  HEARTS_PER_ROW,
  BLOCK_DURABILITY,
  enemySpeedPx,
  survivingBlocks,
  repelFromBlock,
  RESOURCE_SPAWN_MIN,
  RESOURCE_SPAWN_MAX,
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

  it("caps life at 14 hearts including healing at the limit", () => {
    expect(MAX_HEARTS).toBe(14);
    expect(clampHearts(30)).toBe(14);
    expect(applyContact(13.5, "steak")).toBe(14);
    expect(applyContact(14, "steak")).toBe(14);
    expect(applyContact(14, "skeleton")).toBe(13.5);
  });

  it("allocates seven hearts per row for two rows at maximum life", () => {
    expect(HEARTS_PER_ROW).toBe(7);
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

  it("night length grows one second per level from 20 seconds without a later cap", () => {
    expect(levelConfig(1, DEFAULT_SETTINGS).nightDuration).toBe(20);
    expect(levelConfig(2, DEFAULT_SETTINGS).nightDuration).toBe(21);
    expect(levelConfig(6, DEFAULT_SETTINGS).nightDuration).toBe(25);
    expect(levelConfig(11, DEFAULT_SETTINGS).nightDuration).toBe(30);
    expect(levelConfig(22, DEFAULT_SETTINGS).nightDuration).toBe(41);
    expect(levelConfig(50, DEFAULT_SETTINGS).nightDuration).toBe(69);
  });

  it("wood lasts 2 hits, stone 4, iron 6", () => {
    expect(BLOCK_DURABILITY).toMatchObject({ wood: 2, stone: 4, iron: 6 });
    for (const kind of ["wood", "stone", "iron"] as const) {
      let hp = BLOCK_DURABILITY[kind];
      for (let i = 1; i < BLOCK_DURABILITY[kind]; i++) hp = hitBlock(hp);
      expect(hp).toBe(1);
      expect(hitBlock(hp)).toBe(0);
    }
  });

  it("retains surviving blocks through day/night transitions without repairing them", () => {
    const wood = { hp: 1 }, iron = { hp: 5 }, broken = { hp: 0 };
    const nextDay = survivingBlocks(survivingBlocks([wood, iron, broken]));
    expect(nextDay).toEqual([wood, iron]);
    expect(nextDay[0]).toBe(wood);
  });

  it("shifts every enemy speed setting up one step while keeping default 5", () => {
    expect(DEFAULT_SETTINGS.enemySpeed).toBe(5);
    expect(enemySpeedPx(5)).toBe(172);
    expect(enemySpeedPx(1)).toBe(84);
    expect(enemySpeedPx(10)).toBe(282);
    expect(levelConfig(1, DEFAULT_SETTINGS).enemySpeed).toBe(172);
  });

  it("blocks forcibly repel enemies away from every collision side", () => {
    const block = { x: 100, y: 100, w: 40, h: 40 };
    for (const [x, y, vx, vy, expectedVx, expectedVy] of [
      [80, 110, 100, 0, -180, 0], [130, 110, -100, 0, 180, 0],
      [110, 80, 0, 100, 0, -180], [110, 130, 0, -100, 0, 180],
    ] as const) {
      const mob: Mover = { x, y, w: 20, h: 20, vx, vy, bounces: 0, maxBounces: 2, entered: true };
      repelFromBlock(mob, block, 100);
      expect(mob.vx).toBe(expectedVx);
      expect(mob.vy).toBe(expectedVy);
      expect(mob.x + mob.w <= block.x || mob.x >= block.x + block.w || mob.y + mob.h <= block.y || mob.y >= block.y + block.h).toBe(true);
      expect(mob.bounces).toBe(0);
    }
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

import { RESOURCE_MAX_ON_SCREEN, STEAK_MAX_ON_SCREEN, tntDetonates, TNT_HP, daySupply, steakConfig } from "@/game/rules";
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
  it("stays at base speed for the first three levels", () => {
    for (const level of [1, 2, 3]) {
      expect(steveSpeed(level)).toBe(STEVE_SPEED_BASE);
    }
  });
  it("steve speeds up every three levels, not every level", () => {
    for (const [level, speed] of [[4, 346.5], [5, 346.5], [6, 346.5], [7, 363], [8, 363], [9, 363], [10, 379.5], [11, 379.5], [12, 379.5], [13, 396]] as const) {
      expect(steveSpeed(level)).toBeCloseTo(speed);
    }
  });
  it("enemies still speed up every level until level 10", () => {
    for (let level = 2; level <= 10; level++) {
      expect(levelConfig(level, DEFAULT_SETTINGS).enemySpeed).toBeCloseTo(172 * (1 + (level - 1) * 0.06));
      expect(levelConfig(level, DEFAULT_SETTINGS).enemySpeed).toBeGreaterThan(levelConfig(level - 1, DEFAULT_SETTINGS).enemySpeed);
    }
    expect(levelConfig(11, DEFAULT_SETTINGS).enemySpeed).toBe(levelConfig(10, DEFAULT_SETTINGS).enemySpeed);
  });
});
describe("tnt and block supply", () => {
  it("tnt only appears from level 5", () => {
    expect(resourceKindsForLevel(4)).not.toContain("tnt");
    expect(resourceKindsForLevel(5)).toContain("tnt");
  });
  it("tnt only detonates after a hit, not because time passes", () => {
    expect(tntDetonates({ kind: "tnt", hp: TNT_HP })).toBe(false);
    expect(tntDetonates({ kind: "tnt", hp: hitBlock(TNT_HP) })).toBe(true);
    expect(tntDetonates({ kind: "tnt", hp: 0 })).toBe(false);
    expect(tntDetonates({ kind: "wood", hp: 1 })).toBe(false);
  });
  it("more blocks can float by during the day", () => {
    expect(RESOURCE_MAX_ON_SCREEN).toBe(9);
    expect(RESOURCE_SPAWN_MIN).toBe(0.3);
    expect(RESOURCE_SPAWN_MAX).toBe(0.6);
  });
});

describe("survival caps", () => {
  it("caps all day cycles at 20 seconds", () => {
    expect(levelConfig(16, DEFAULT_SETTINGS).dayDuration).toBe(20);
    expect(levelConfig(50, DEFAULT_SETTINGS).dayDuration).toBe(20);
    expect(levelConfig(1, { ...DEFAULT_SETTINGS, dayDuration: 120 }).dayDuration).toBe(20);
  });
  it("stops enemy speed growth after level 10", () => {
    expect(levelConfig(10, DEFAULT_SETTINGS).enemySpeed).toBeCloseTo(172 * 1.54);
    expect(levelConfig(9, DEFAULT_SETTINGS).enemySpeed).toBeLessThan(levelConfig(10, DEFAULT_SETTINGS).enemySpeed);
    for (const level of [11, 30, 100]) expect(levelConfig(level, DEFAULT_SETTINGS).enemySpeed).toBe(levelConfig(10, DEFAULT_SETTINGS).enemySpeed);
  });
  it("replaces new steaks with extra blocks at 14 hearts and restores steaks below the cap", () => {
    expect(daySupply(10, 14)).toEqual({ spawnSteaks: false, maxBlocks: 27, blockSpawnMin: 0.15, blockSpawnMax: 0.3 });
    expect(daySupply(10, 13.5)).toEqual({ spawnSteaks: true, maxBlocks: 9, blockSpawnMin: 0.3, blockSpawnMax: 0.6 });
  });
});

import { remainingSteaks, endermanSpawnDelay, ENDERMAN_HP, hitEnderman, stepEnderman, mobAffectedByExplosion, type EndermanCombat } from "@/game/rules";
describe("full health food removal", () => {
  it("removes every existing steak at 14 hearts but retains them below the cap", () => {
    const steaks = [{ x: 20 }, { x: 80 }];
    expect(remainingSteaks(steaks, 14)).toEqual([]);
    expect(remainingSteaks(steaks, 13.5)).toBe(steaks);
  });
});
describe("Enderman", () => {
  const fresh = (): EndermanCombat => ({ hp: ENDERMAN_HP, attackPhase: "chase", attackTimer: 0, lastSwordSwing: -1 });
  it("appears only after level 10, at a random time once per night", () => {
    expect(endermanSpawnDelay(10, 20, 0.5)).toBe(-1);
    expect(endermanSpawnDelay(11, 20, 0)).toBe(3);
    expect(endermanSpawnDelay(11, 20, 1)).toBe(13);
  });
  it("needs three separate sword strikes, not three animation frames", () => {
    let e = hitEnderman(fresh(), 1);
    expect(e.hp).toBe(2);
    e = hitEnderman(e, 1);
    expect(e.hp).toBe(2);
    e = hitEnderman(e, 2);
    expect(e.hp).toBe(1);
    expect(hitEnderman(e, 3).hp).toBe(0);
  });
  it("is immune to explosions while normal mobs are not", () => {
    expect(mobAffectedByExplosion("enderman")).toBe(false);
    for (const kind of ["creeper", "skeleton", "zombie", "spider"] as const) expect(mobAffectedByExplosion(kind)).toBe(true);
  });
  it("winds up slowly then swipes once for two hearts", () => {
    const windup = stepEnderman(fresh(), 60, 0.01);
    expect(windup.state.attackPhase).toBe("windup");
    expect(windup.state.attackTimer).toBe(1.6);
    expect(windup.swipe).toBe(false);
    const waiting = stepEnderman(windup.state, 60, 1.5);
    expect(waiting.swipe).toBe(false);
    const swipe = stepEnderman(waiting.state, 60, 0.11);
    expect(swipe.swipe).toBe(true);
    expect(applyContact(14, "enderman")).toBe(12);
    expect(swipe.state.attackPhase).toBe("recovery");
    expect(stepEnderman(swipe.state, 60, 0.3).swipe).toBe(false);
  });
  it("can be dodged by leaving swipe range during windup", () => {
    const e = stepEnderman(fresh(), 60, 0).state;
    expect(stepEnderman(e, 120, 1.6).swipe).toBe(false);
  });
});
