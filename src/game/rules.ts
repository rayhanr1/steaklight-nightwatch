// Pure game rules: no DOM, no React. Everything the game decides lives here so it can be tested.

export type Settings = {
  /** 1 (slow) – 10 (fast) */
  enemySpeed: number;
  /** seconds */
  dayDuration: number;
  /** seconds, for level 1 */
  nightDuration: number;
};

export const DEFAULT_SETTINGS: Settings = { enemySpeed: 5, dayDuration: 5, nightDuration: 20 };

export const STARTING_HEARTS = 3;
export const MAX_HEARTS = 18;
export const HEARTS_PER_ROW = 9;
export function clampHearts(hearts: number) {
  return Math.min(MAX_HEARTS, Math.max(0, hearts));
}
export const STEAK_HEAL = 0.5;
export const SKELETON_DAMAGE = 0.5;
export const CREEPER_DAMAGE = 1;
/** Enemies bounce off this many edges, then leave the screen on the next one. */
export const ENEMY_MAX_BOUNCES = 2;
/** Nights stay a fixed length; difficulty grows through mobs instead. */
export const NIGHT_GROWTH_SECONDS = 0;
export const NIGHT_MIN = 15;
export const NIGHT_MAX = 30;
/** Extra day seconds added per level. */
export const DAY_GROWTH_SECONDS = 1;
/** Max steaks on screen at once. */
export const STEAK_MAX_ON_SCREEN = 6;
/** Seconds between steak spawns (random between min and max). */
export const STEAK_SPAWN_MIN = 0.9;
export const STEAK_SPAWN_MAX = 1.8;
/** From this level on, more steaks float by and they spawn faster. */
export const STEAK_RAMP_FROM_LEVEL = 5;
/** Extra steaks allowed on screen per level past the ramp start. */
export const STEAK_MAX_GROWTH_PER_LEVEL = 2;

export type SteakConfig = {
  maxOnScreen: number;
  spawnMin: number;
  spawnMax: number;
};

/** Steaks stay at the base rate through level 4, then keep growing each level without a level cap. */
export function steakConfig(level: number): SteakConfig {
  const n = Math.max(0, Math.floor(level) - (STEAK_RAMP_FROM_LEVEL - 1));
  const scale = Math.pow(0.85, n);
  return {
    maxOnScreen: STEAK_MAX_ON_SCREEN + n * STEAK_MAX_GROWTH_PER_LEVEL,
    spawnMin: Math.max(0.3, STEAK_SPAWN_MIN * scale),
    spawnMax: Math.max(0.6, STEAK_SPAWN_MAX * scale),
  };
}

export type LevelConfig = {
  dayDuration: number;
  nightDuration: number;
  /** seconds between enemy waves */
  enemySpawnInterval: number;
  enemiesPerWave: number;
  /** px per second */
  enemySpeed: number;
};

export function enemySpeedPx(slider: number) {
  return 40 + (slider + 1) * 22;
}

// ---------- Steve ----------
/** Steve's base speed in px per second. */
export const STEVE_SPEED_BASE = 330;
/** From this level on, Steve moves faster to keep up with the mobs. */
export const STEVE_SPEEDUP_FROM_LEVEL = 10;
/** Extra speed per level past the speedup start, as a fraction of base speed. */
export const STEVE_SPEEDUP_PER_LEVEL = 0.05;

/** Steve's speed for a level: flat through level 9, then +5% per level. */
export function steveSpeed(level: number) {
  const n = Math.max(0, Math.floor(level) - (STEVE_SPEEDUP_FROM_LEVEL - 1));
  return STEVE_SPEED_BASE * (1 + n * STEVE_SPEEDUP_PER_LEVEL);
}

export function levelConfig(level: number, settings: Settings): LevelConfig {
  const n = Math.max(1, Math.floor(level)) - 1;
  return {
    dayDuration: settings.dayDuration + n * DAY_GROWTH_SECONDS,
    nightDuration: Math.min(NIGHT_MAX, Math.max(NIGHT_MIN, settings.nightDuration)),
    enemySpawnInterval: Math.max(1, 2.2 * Math.pow(0.93, n)),
    enemiesPerWave: Math.min(4, 1 + Math.floor(n / 3)),
    enemySpeed: enemySpeedPx(settings.enemySpeed) * (1 + Math.min(n, 10) * 0.06),
  };
}

export type MobKind = "skeleton" | "creeper" | "zombie" | "spider";
export type HitKind = "steak" | MobKind | "arrow";

export const HIT_DELTA: Record<HitKind, number> = {
  steak: STEAK_HEAL, skeleton: -SKELETON_DAMAGE, creeper: -CREEPER_DAMAGE, zombie: -0.5, spider: -0.5, arrow: -0.5,
};

export function applyContact(hearts: number, kind: HitKind) {
  const delta = HIT_DELTA[kind];
  return clampHearts(Math.round((hearts + delta) * 2) / 2);
}

export type Mover = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  bounces: number;
  maxBounces: number;
  /** becomes true once the mover is fully inside the screen */
  entered: boolean;
};

const SPAWN_MARGIN = 240;

/** Advance a pong-style mover. Returns false once it has left the screen for good. */
export function stepMover(m: Mover, dt: number, W: number, H: number): boolean {
  m.x += m.vx * dt;
  m.y += m.vy * dt;

  if (!m.entered) {
    if (m.x >= 0 && m.y >= 0 && m.x + m.w <= W && m.y + m.h <= H) m.entered = true;
    else
      return !(
        m.x < -m.w - SPAWN_MARGIN ||
        m.y < -m.h - SPAWN_MARGIN ||
        m.x > W + SPAWN_MARGIN ||
        m.y > H + SPAWN_MARGIN
      );
    return true;
  }

  if (m.bounces < m.maxBounces) {
    if (m.x < 0 && m.vx < 0) bounce(m, "x", 0);
    else if (m.x + m.w > W && m.vx > 0) bounce(m, "x", W - m.w);
  }
  if (m.bounces < m.maxBounces) {
    if (m.y < 0 && m.vy < 0) bounce(m, "y", 0);
    else if (m.y + m.h > H && m.vy > 0) bounce(m, "y", H - m.h);
  }

  const off = m.x + m.w < 0 || m.y + m.h < 0 || m.x > W || m.y > H;
  return !off;
}

function bounce(m: Mover, axis: "x" | "y", edge: number) {
  if (axis === "x") {
    m.x = edge;
    m.vx = -m.vx;
  } else {
    m.y = edge;
    m.vy = -m.vy;
  }
  m.bounces += 1;
}

/** Spawn just outside a random edge, heading into the screen. */
export function spawnMover(
  W: number,
  H: number,
  w: number,
  h: number,
  speed: number,
  maxBounces: number,
  rand: () => number = Math.random,
): Mover {
  const edge = Math.floor(rand() * 4);
  // inward angle with ±55° of spread
  const spread = (rand() - 0.5) * ((110 * Math.PI) / 180);
  let x = 0,
    y = 0,
    base = 0;
  if (edge === 0) {
    x = -w; y = rand() * (H - h); base = 0; // left → right
  } else if (edge === 1) {
    x = W; y = rand() * (H - h); base = Math.PI; // right → left
  } else if (edge === 2) {
    x = rand() * (W - w); y = -h; base = Math.PI / 2; // top → down
  } else {
    x = rand() * (W - w); y = H; base = -Math.PI / 2; // bottom → up
  }
  const a = base + spread;
  return { x, y, w, h, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, bounces: 0, maxBounces, entered: false };
}

export function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  inset = 0.18,
) {
  const ax = a.w * inset, ay = a.h * inset, bx = b.w * inset, by = b.h * inset;
  return (
    a.x + ax < b.x + b.w - bx &&
    a.x + a.w - ax > b.x + bx &&
    a.y + ay < b.y + b.h - by &&
    a.y + a.h - ay > b.y + by
  );
}

// ---------- Mobs ----------
/** Zombies join on level 2, spiders on level 3. */
export function mobKindsForLevel(level: number): MobKind[] {
  const kinds: MobKind[] = ["skeleton", "creeper"];
  if (level >= 2) kinds.push("zombie");
  if (level >= 3) kinds.push("spider");
  return kinds;
}
export const CREEPER_FUSE_RANGE = 90;
export const CREEPER_FUSE_SECONDS = 1.1;
export const CREEPER_BLAST_RADIUS = 110;
export const SKELETON_SHOOT_EVERY = 2.6;
export const ARROW_SPEED = 300;

/** Turn a mover's velocity toward a target while keeping its speed. */
export function steerToward(m: Mover, tx: number, ty: number, speed: number, turn: number, dt: number) {
  const dx = tx - (m.x + m.w / 2), dy = ty - (m.y + m.h / 2);
  const d = Math.hypot(dx, dy) || 1;
  const vx = m.vx + (dx / d) * speed * turn * dt;
  const vy = m.vy + (dy / d) * speed * turn * dt;
  const v = Math.hypot(vx, vy) || 1;
  m.vx = (vx / v) * speed;
  m.vy = (vy / v) * speed;
}

// ---------- Sword ----------
export const SWORD_RANGE = 70;
export const SWORD_SWING_SECONDS = 0.22;
export const SWORD_COOLDOWN = 0.4;
type Box = { x: number; y: number; w: number; h: number };
/** The sword hits targets in front of Steve (facing side) within reach. */
export function swordHits(steve: Box, facing: 1 | -1, target: Box) {
  const sx = steve.x + steve.w / 2, sy = steve.y + steve.h / 2;
  const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
  const ahead = (tx - sx) * facing;
  return ahead > -steve.w * 0.3 && ahead < SWORD_RANGE + target.w / 2 + steve.w / 2 && Math.abs(ty - sy) < steve.h * 0.75;
}

// ---------- Blocks ----------
export type BlockKind = "wood" | "stone" | "iron" | "tnt";
export const BLOCK_SIZE = 40;
/** Placed TNT is not an obstacle; it explodes this long after being placed. */
export const TNT_FUSE_SECONDS = 1;
export const TNT_BLAST_RADIUS = 130;
export const TNT_FROM_LEVEL = 5;
/** Large so hits never remove TNT; any hit just shortens its fuse. */
export const TNT_HP = 99;
/** Hits a placed block absorbs before breaking. */
export const BLOCK_DURABILITY: Record<BlockKind, number> = { wood: 2, stone: 4, iron: 6, tnt: TNT_HP };
/** Surviving blocks remain in the run across phase and level transitions. */
export function survivingBlocks<T extends { hp: number }>(blocks: T[]): T[] {
  return blocks.filter((block) => block.hp > 0);
}
export const BLOCK_REPEL_SECONDS = 0.75;
export const BLOCK_REPEL_SPEED_MULTIPLIER = 1.8;
export const BLOCK_REPEL_GAP = 8;
/** Separate a mob from the block, then launch it along the outward collision normal. */
export function repelFromBlock(m: Mover, block: Box, speed: number) {
  const dx = m.x + m.w / 2 - (block.x + block.w / 2);
  const dy = m.y + m.h / 2 - (block.y + block.h / 2);
  const horizontal = Math.abs(dx) / (m.w + block.w) >= Math.abs(dy) / (m.h + block.h);
  const launchSpeed = speed * BLOCK_REPEL_SPEED_MULTIPLIER;
  if (horizontal) {
    const direction = Math.sign(dx) || (m.vx > 0 ? -1 : 1);
    m.x = direction < 0 ? block.x - m.w - BLOCK_REPEL_GAP : block.x + block.w + BLOCK_REPEL_GAP;
    m.vx = direction * launchSpeed;
    m.vy = 0;
  } else {
    const direction = Math.sign(dy) || (m.vy > 0 ? -1 : 1);
    m.y = direction < 0 ? block.y - m.h - BLOCK_REPEL_GAP : block.y + block.h + BLOCK_REPEL_GAP;
    m.vx = 0;
    m.vy = direction * launchSpeed;
  }
}
/** Wood from level 1, stone from level 2, iron from level 3, TNT from level 5. */
export function resourceKindsForLevel(level: number): BlockKind[] {
  const kinds = (["wood", "stone", "iron"] as BlockKind[]).slice(0, Math.min(3, Math.max(1, Math.floor(level))));
  if (level >= TNT_FROM_LEVEL) kinds.push("tnt");
  return kinds;
}
/** Returns the block's remaining hits after taking one; 0 means it breaks. */
export function hitBlock(hp: number) {
  return Math.max(0, hp - 1);
}
export const RESOURCE_MAX_ON_SCREEN = 9;
/** Seconds between block spawns by day (random between min and max). */
export const RESOURCE_SPAWN_MIN = 0.3;
export const RESOURCE_SPAWN_MAX = 0.6;

// ---------- Score ----------
export const SCORE_PER_LEVEL = 100;
export const SCORE_PER_KILL = 10;
export const SCORE_PER_STEAK = 5;
export type HighScore = { score: number; level: number };
export function runScore(levelsCleared: number, kills: number, steaks: number) {
  return levelsCleared * SCORE_PER_LEVEL + kills * SCORE_PER_KILL + steaks * SCORE_PER_STEAK;
}
/** Keeps the best score and best level reached, independently. */
export function mergeHighScore(prev: HighScore, run: HighScore): HighScore {
  return { score: Math.max(prev.score, run.score), level: Math.max(prev.level, run.level) };
}
