// Pure game rules: no DOM, no React. Everything the game decides lives here so it can be tested.

export type Settings = {
  /** 1 (slow) – 10 (fast) */
  enemySpeed: number;
  /** seconds */
  dayDuration: number;
  /** seconds, for level 1 */
  nightDuration: number;
};

export const DEFAULT_SETTINGS: Settings = { enemySpeed: 3, dayDuration: 5, nightDuration: 60 };

export const STARTING_HEARTS = 3;
export const STEAK_HEAL = 0.5;
export const SKELETON_DAMAGE = 0.5;
export const CREEPER_DAMAGE = 1;
/** Enemies bounce off this many edges, then leave the screen on the next one. */
export const ENEMY_MAX_BOUNCES = 2;
/** Extra night seconds added per level. */
export const NIGHT_GROWTH_SECONDS = 5;
/** Extra day seconds added per level. */
export const DAY_GROWTH_SECONDS = 1;
/** Max steaks on screen at once. */
export const STEAK_MAX_ON_SCREEN = 6;
/** Seconds between steak spawns (random between min and max). */
export const STEAK_SPAWN_MIN = 0.9;
export const STEAK_SPAWN_MAX = 1.8;

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
  return 40 + slider * 22;
}

export function levelConfig(level: number, settings: Settings): LevelConfig {
  const n = Math.max(1, Math.floor(level)) - 1;
  return {
    dayDuration: settings.dayDuration + n * DAY_GROWTH_SECONDS,
    nightDuration: settings.nightDuration + n * NIGHT_GROWTH_SECONDS,
    enemySpawnInterval: Math.max(0.6, 2.6 * Math.pow(0.88, n)),
    enemiesPerWave: 1 + Math.floor(n / 3),
    enemySpeed: enemySpeedPx(settings.enemySpeed),
  };
}

export type HitKind = "steak" | "skeleton" | "creeper";

export function applyContact(hearts: number, kind: HitKind) {
  const delta = kind === "steak" ? STEAK_HEAL : kind === "skeleton" ? -SKELETON_DAMAGE : -CREEPER_DAMAGE;
  return Math.max(0, Math.round((hearts + delta) * 2) / 2);
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
