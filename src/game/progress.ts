import { z } from "zod";
import type { World } from "./Game";
import { clampHearts, type Settings } from "./rules";

const number = z.number().finite();
const mover = z.object({ x: number, y: number, w: number.positive(), h: number.positive(), vx: number, vy: number, bounces: number, maxBounces: number, entered: z.boolean() });
const blockKind = z.enum(["wood", "stone", "iron", "tnt"]);
const settingsSchema = z.object({ enemySpeed: number.min(1).max(10), dayDuration: number.min(5).max(120), nightDuration: number.min(15).max(30) });
export const progressSchema = z.object({
  version: z.literal(2), settings: settingsSchema, animationTime: number.nonnegative(), videoTime: number.nonnegative(),
  world: z.object({
    W: number.positive(), H: number.positive(), phase: z.enum(["day", "night", "levelComplete"]), level: number.int().positive(), hearts: number.positive().transform(clampHearts), timeLeft: number,
    cfg: z.object({ dayDuration: number, nightDuration: number, enemySpawnInterval: number, enemiesPerWave: number, enemySpeed: number }),
    steve: z.object({ x: number, y: number, w: number, h: number, facing: z.union([z.literal(1), z.literal(-1)]), hurt: number, walk: number }),
    steaks: z.array(mover.extend({ spin: number })), enemies: z.array(mover.extend({ kind: z.enum(["skeleton", "creeper", "zombie", "spider"]), bob: number, timer: number, fuse: number })),
    resources: z.array(mover.extend({ kind: blockKind })), blocks: z.array(z.object({ x: number, y: number, w: number, h: number, kind: blockKind, hp: number, fuse: number.default(0) })),
    arrows: z.array(z.object({ x: number, y: number, w: number, h: number, vx: number, vy: number })),
    inventory: z.object({ wood: number.int().nonnegative(), stone: number.int().nonnegative(), iron: number.int().nonnegative(), tnt: number.int().nonnegative().default(0) }),
    swing: number, swingCooldown: number, resourceTimer: number, kills: number,
    particles: z.array(z.object({ x: number, y: number, vx: number, vy: number, life: number, max: number, size: number, color: z.string() })),
    floaters: z.array(z.object({ x: number, y: number, text: z.string(), life: number, color: z.string() })),
    flashes: z.array(z.object({ x: number, y: number, life: number, max: number })),
    steakTimer: number, enemyTimer: number, shake: number, steaksEaten: number, pointer: z.null(),
  }),
});
export type Progress = z.infer<typeof progressSchema>;
export function captureProgress(world: World, settings: Settings, animationTime: number, videoTime: number): Progress {
  return progressSchema.parse(structuredClone({ version: 2, world: { ...world, pointer: null }, settings, animationTime, videoTime }));
}
export function simulationDelta(paused: boolean, elapsed: number) {
  return paused ? 0 : Math.min(0.05, Math.max(0, elapsed));
}