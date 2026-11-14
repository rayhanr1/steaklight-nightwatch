import { useCallback, useEffect, useRef, useState } from "react";
import dayImg from "@/assets/forest-day.jpg";
import nightImg from "@/assets/forest-night.jpg";
import { cn } from "@/lib/utils";
import { HeartsRow } from "./PixelHeart";
import { PixelSlider } from "./PixelSlider";
import {
  applyContact,
  ARROW_SPEED,
  BLOCK_DURABILITY,
  BLOCK_SIZE,
  CREEPER_BLAST_RADIUS,
  CREEPER_FUSE_RANGE,
  CREEPER_FUSE_SECONDS,
  hitBlock,
  mobKindsForLevel,
  RESOURCE_MAX_ON_SCREEN,
  resourceKindsForLevel,
  SKELETON_SHOOT_EVERY,
  steerToward,
  SWORD_COOLDOWN,
  SWORD_SWING_SECONDS,
  swordHits,
  type BlockKind,
  type MobKind,
  DEFAULT_SETTINGS,
  ENEMY_MAX_BOUNCES,
  levelConfig,
  overlaps,
  spawnMover,
  STARTING_HEARTS,
  STEAK_MAX_ON_SCREEN,
  STEAK_SPAWN_MAX,
  STEAK_SPAWN_MIN,
  stepMover,
  type LevelConfig,
  type Mover,
  type Settings,
} from "./rules";
import { buildSprites, SPRITE_SIZE, type SpriteSet } from "./sprites";
import { Button } from "@/components/ui/button";
import { Pause, Play, Save, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { captureProgress, progressSchema, simulationDelta, type Progress } from "./progress";

type Phase = "menu" | "day" | "night" | "levelComplete" | "gameOver";
type Enemy = Mover & { kind: MobKind; bob: number; timer: number; fuse: number };
type Resource = Mover & { kind: BlockKind };
type Block = { x: number; y: number; w: number; h: number; kind: BlockKind; hp: number };
type Arrow = { x: number; y: number; w: number; h: number; vx: number; vy: number };
type Steak = Mover & { spin: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Floater = { x: number; y: number; text: string; life: number; color: string };
type Flash = { x: number; y: number; life: number; max: number };

export type World = {
  W: number;
  H: number;
  phase: Phase;
  level: number;
  hearts: number;
  timeLeft: number;
  cfg: LevelConfig;
  steve: { x: number; y: number; w: number; h: number; facing: 1 | -1; hurt: number; walk: number };
  steaks: Steak[];
  enemies: Enemy[];
  resources: Resource[];
  blocks: Block[];
  arrows: Arrow[];
  inventory: Record<BlockKind, number>;
  swing: number;
  swingCooldown: number;
  resourceTimer: number;
  kills: number;
  particles: Particle[];
  floaters: Floater[];
  flashes: Flash[];
  steakTimer: number;
  enemyTimer: number;
  shake: number;
  steaksEaten: number;
  pointer: { x: number; y: number } | null;
};

type Hud = { hearts: number; level: number; timeLeft: number; total: number; steaks: number; wood: number; stone: number; iron: number; kills: number };

const STEVE_SPEED = 330;
// In-game art colors (canvas), not UI theme colors.
const FX = {
  steak: ["#f5c16b", "#ffe9a8", "#c8742e"],
  bone: ["#e8e8e8", "#bdbdbd", "#8f8f8f"],
  boom: ["#ffffff", "#f6d36b", "#f08a2a", "#6b6b6b", "#3c3c3c"],
  mob: ["#5cb83a", "#3a302a", "#d21f1f", "#3f6e30"],
  wood: ["#b8894c", "#9a6f38", "#6e4c22"],
  stone: ["#8d8d8d", "#6f6f6f", "#4f4f4f"],
  iron: ["#d8d8d8", "#bcbcbc", "#8a8a8a"],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] as T;
const fmtTime = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(false);
  const animationTime = useRef(0);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState<Progress | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("menu");
  const [night, setNight] = useState(false);
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null);
  const [hud, setHud] = useState<Hud>({ hearts: STARTING_HEARTS, level: 1, timeLeft: 0, total: 1, steaks: 0, wood: 0, stone: 0, iron: 0, kills: 0 });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setSaved(null);
    if (userId) void supabase.from("saved_games").select("snapshot").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { setSaveMessage("Couldn't load saved progress. Try again later."); return; }
      const result = progressSchema.safeParse(data?.snapshot);
      if (result.success) setSaved(result.data);
    });
    return () => { active = false; };
  }, [userId]);

  const world = useRef<World>({
    W: 1280,
    H: 720,
    phase: "menu",
    level: 1,
    hearts: STARTING_HEARTS,
    timeLeft: 0,
    cfg: levelConfig(1, DEFAULT_SETTINGS),
    steve: { x: 600, y: 320, w: SPRITE_SIZE.steve.w, h: SPRITE_SIZE.steve.h, facing: 1, hurt: 0, walk: 0 },
    steaks: [],
    enemies: [],
    resources: [],
    blocks: [],
    arrows: [],
    inventory: { wood: 0, stone: 0, iron: 0 },
    swing: 0,
    swingCooldown: 0,
    resourceTimer: 1,
    kills: 0,
    particles: [],
    floaters: [],
    flashes: [],
    steakTimer: 0,
    enemyTimer: 0,
    shake: 0,
    steaksEaten: 0,
    pointer: null,
  });

  const changePause = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
    keys.current.clear();
    world.current.pointer = null;
    const video = videoRef.current;
    if (value) video?.pause();
    else void video?.play().catch(() => {});
    setConfirmQuit(false);
  }, []);

  const saveProgress = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const snapshot = captureProgress(world.current, settingsRef.current, animationTime.current, videoRef.current?.currentTime ?? 0);
      const { error } = await supabase.from("saved_games").upsert({ user_id: userId, snapshot: JSON.parse(JSON.stringify(snapshot)), updated_at: new Date().toISOString() });
      if (error) throw error;
      setSaved(snapshot);
      setSaveMessage("Progress saved.");
    } catch { setSaveMessage("Couldn't save progress. Your game is still paused; try again."); }
    finally { setSaving(false); }
  };

  const signInToSave = async () => {
    // Keep the paused run through a full-page sign-in round trip; Cloud is the durable save.
    sessionStorage.setItem("pending-game-save", JSON.stringify(captureProgress(world.current, settingsRef.current, animationTime.current, videoRef.current?.currentTime ?? 0)));
    const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
    if (result.error) setSaveMessage("Sign-in didn't finish. Your game is still paused.");
  };

  const pushHud = useCallback(() => {
    const w = world.current;
    const total = w.phase === "night" ? w.cfg.nightDuration : w.cfg.dayDuration;
    setHud((prev) => {
      const next: Hud = { hearts: w.hearts, level: w.level, timeLeft: Math.ceil(w.timeLeft), total, steaks: w.steaksEaten, ...w.inventory, kills: w.kills };
      return (Object.keys(next) as (keyof Hud)[]).every((k) => prev[k] === next[k]) ? prev : next;
    });
  }, []);

  const go = useCallback(
    (p: Phase) => {
      world.current.phase = p;
      setPhase(p);
      pushHud();
    },
    [pushHud],
  );

  const showBanner = (text: string, sub: string) => setBanner({ text, sub, key: Date.now() });

  const startDay = useCallback(() => {
    changePause(false);
    const w = world.current;
    w.cfg = levelConfig(w.level, settingsRef.current);
    w.timeLeft = w.cfg.dayDuration;
    w.steaks = [];
    w.enemies = [];
    w.resources = [];
    w.blocks = [];
    w.arrows = [];
    w.particles = [];
    w.floaters = [];
    w.flashes = [];
    w.steakTimer = 0.3;
    w.resourceTimer = 0.8;
    w.steve.x = w.W / 2 - w.steve.w / 2;
    w.steve.y = w.H / 2 - w.steve.h / 2;
    w.steve.hurt = 0;
    setNight(false);
    showBanner(`Level ${w.level} · Day`, "Grab the steaks!");
    (document.activeElement as HTMLElement | null)?.blur?.();
    go("day");
  }, [go, changePause]);

  const startNight = useCallback(() => {
    const w = world.current;
    for (const s of w.steaks) burst(w, s.x + s.w / 2, s.y + s.h / 2, FX.steak, 6, 80);
    w.steaks = [];
    w.resources = [];
    w.timeLeft = w.cfg.nightDuration;
    w.enemyTimer = 0.8;
    setNight(true);
    showBanner("Night falls", "Space to swing · 1/2/3 to place blocks");
    go("night");
  }, [go]);

  const startGame = useCallback(() => {
    settingsRef.current = settings;
    const w = world.current;
    w.level = 1;
    w.hearts = STARTING_HEARTS;
    w.steaksEaten = 0;
    w.kills = 0;
    w.inventory = { wood: 0, stone: 0, iron: 0 };
    startDay();
  }, [settings, startDay]);

  const nextLevel = useCallback(() => {
    world.current.level += 1;
    startDay();
  }, [startDay]);

  const toMenu = useCallback(() => {
    changePause(false);
    setSaveMessage("");
    const w = world.current;
    w.enemies = [];
    w.steaks = [];
    setNight(false);
    setBanner(null);
    go("menu");
  }, [go, changePause]);

  const restoreProgress = useCallback((snapshot: Progress) => {
    const W = world.current.W, H = world.current.H;
    const restored = structuredClone(snapshot.world);
    for (const object of [restored.steve, ...restored.steaks, ...restored.enemies, ...restored.resources, ...restored.blocks, ...restored.arrows, ...restored.particles, ...restored.floaters, ...restored.flashes]) {
      object.x *= W / restored.W;
      object.y *= H / restored.H;
    }
    world.current = { ...restored, W, H };
    settingsRef.current = snapshot.settings;
    setSettings(snapshot.settings);
    animationTime.current = snapshot.animationTime;
    if (videoRef.current) videoRef.current.currentTime = snapshot.videoTime;
    setNight(snapshot.world.phase !== "day");
    setBanner(null);
    go(snapshot.world.phase);
    changePause(true);
  }, [go, changePause]);

  useEffect(() => {
    if (!userId) return;
    const raw = sessionStorage.getItem("pending-game-save");
    if (!raw) return;
    sessionStorage.removeItem("pending-game-save");
    try {
      const result = progressSchema.safeParse(JSON.parse(raw));
      if (result.success && world.current.phase === "menu") restoreProgress(result.data);
    } catch { /* Ignore an incomplete sign-in handoff. */ }
  }, [userId, restoreProgress]);

  // Keyboard
  useEffect(() => {
    const MOVE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];
    const down = (e: KeyboardEvent) => {
      const p = world.current.phase;
      if (e.key === "Escape" && (p === "day" || p === "night")) {
        e.preventDefault();
        changePause(!pausedRef.current);
        return;
      }
      if (pausedRef.current) return;
      if (p === "day" || p === "night") {
        const w = world.current;
        if (e.key === " " && !e.repeat) { e.preventDefault(); swingSword(w); return; }
        const place: Record<string, BlockKind> = { "1": "wood", z: "wood", "2": "stone", x: "stone", "3": "iron", c: "iron" };
        const kind = place[e.key.toLowerCase()];
        if (kind && !e.repeat) { e.preventDefault(); placeBlock(w, kind); return; }
      }
      if (MOVE.includes(e.key) && (p === "day" || p === "night")) {
        e.preventDefault();
        keys.current.add(e.key.toLowerCase());
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => {
      keys.current.clear();
      if (world.current.phase === "day" || world.current.phase === "night") changePause(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [changePause]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sprites = buildSprites();
    const w = world.current;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w.W = window.innerWidth;
      w.H = window.innerHeight;
      canvas.width = w.W * dpr;
      canvas.height = w.H * dpr;
      canvas.style.width = `${w.W}px`;
      canvas.style.height = `${w.H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      w.steve.x = Math.min(w.steve.x, w.W - w.steve.w);
      w.steve.y = Math.min(w.steve.y, w.H - w.steve.h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let hudTick = 0;
    const frame = (t: number) => {
      const dt = simulationDelta(pausedRef.current, (t - last) / 1000);
      last = t;
      if (pausedRef.current) { raf = requestAnimationFrame(frame); return; }
      animationTime.current += dt;
      update(dt);
      draw(ctx, sprites, world.current, animationTime.current);
      hudTick += dt;
      if (hudTick > 0.1) {
        hudTick = 0;
        pushHud();
      }
      raf = requestAnimationFrame(frame);
    };

    const update = (dt: number) => {
      const w = world.current;
      // effects always animate
      w.particles = w.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt;
        return p.life > 0;
      });
      w.floaters = w.floaters.filter((f) => {
        f.life -= dt;
        f.y -= 50 * dt;
        return f.life > 0;
      });
      w.flashes = w.flashes.filter((f) => (f.life -= dt) > 0);
      w.shake = Math.max(0, w.shake - dt * 30);

      if (w.phase !== "day" && w.phase !== "night") return;

      // Steve
      const s = w.steve;
      let dx = 0,
        dy = 0;
      const k = keys.current;
      if (k.has("arrowleft") || k.has("a")) dx -= 1;
      if (k.has("arrowright") || k.has("d")) dx += 1;
      if (k.has("arrowup") || k.has("w")) dy -= 1;
      if (k.has("arrowdown") || k.has("s")) dy += 1;
      if (!dx && !dy && w.pointer) {
        const tx = w.pointer.x - (s.x + s.w / 2);
        const ty = w.pointer.y - (s.y + s.h / 2);
        const d = Math.hypot(tx, ty);
        if (d > 6) {
          dx = tx / d;
          dy = ty / d;
        }
      }
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        s.x += (dx / len) * STEVE_SPEED * dt;
        s.y += (dy / len) * STEVE_SPEED * dt;
        if (dx) s.facing = dx > 0 ? 1 : -1;
        s.walk += dt * 12;
      }
      s.x = Math.max(0, Math.min(w.W - s.w, s.x));
      s.y = Math.max(0, Math.min(w.H - s.h, s.y));
      s.hurt = Math.max(0, s.hurt - dt);
      w.swing = Math.max(0, w.swing - dt);
      w.swingCooldown = Math.max(0, w.swingCooldown - dt);

      w.timeLeft -= dt;

      if (w.phase === "day") {
        w.steakTimer -= dt;
        if (w.steakTimer <= 0 && w.steaks.length < STEAK_MAX_ON_SCREEN) {
          w.steakTimer = rnd(STEAK_SPAWN_MIN, STEAK_SPAWN_MAX);
          const m = spawnMover(w.W, w.H, SPRITE_SIZE.steak.w, SPRITE_SIZE.steak.h, rnd(130, 220), Math.floor(rnd(0, 4)));
          w.steaks.push({ ...m, spin: rnd(-2, 2) });
        }
        w.steaks = w.steaks.filter((st) => {
          if (!stepMover(st, dt, w.W, w.H)) return false;
          if (overlaps(s, st, 0.1)) {
            w.hearts = applyContact(w.hearts, "steak");
            w.steaksEaten += 1;
            burst(w, st.x + st.w / 2, st.y + st.h / 2, FX.steak, 10, 160);
            w.floaters.push({ x: st.x, y: st.y, text: "+½", life: 0.9, color: "#ffe066" });
            return false;
          }
          return true;
        });
        w.resourceTimer -= dt;
        if (w.resourceTimer <= 0 && w.resources.length < RESOURCE_MAX_ON_SCREEN) {
          w.resourceTimer = rnd(1.2, 2.2);
          const m = spawnMover(w.W, w.H, 32, 32, rnd(110, 180), Math.floor(rnd(1, 4)));
          w.resources.push({ ...m, kind: pick(resourceKindsForLevel(w.level)) });
        }
        w.resources = w.resources.filter((r) => {
          if (!stepMover(r, dt, w.W, w.H)) return false;
          if (overlaps(s, r, 0.1)) {
            w.inventory[r.kind] += 1;
            burst(w, r.x + 16, r.y + 16, FX[r.kind], 8, 140);
            w.floaters.push({ x: r.x, y: r.y, text: `+1 ${r.kind}`, life: 0.9, color: "#f0f0f0" });
            return false;
          }
          return true;
        });
        if (w.timeLeft <= 0) startNight();
      } else {
        w.enemyTimer -= dt;
        if (w.enemyTimer <= 0) {
          w.enemyTimer = w.cfg.enemySpawnInterval * rnd(0.8, 1.2);
          const kinds = mobKindsForLevel(w.level);
          for (let i = 0; i < w.cfg.enemiesPerWave; i++) {
            const kind = pick(kinds);
            const size = SPRITE_SIZE[kind];
            const m = spawnMover(w.W, w.H, size.w, size.h, w.cfg.enemySpeed * rnd(0.85, 1.15), ENEMY_MAX_BOUNCES);
            w.enemies.push({ ...m, kind, bob: rnd(0, Math.PI * 2), timer: rnd(1, SKELETON_SHOOT_EVERY), fuse: 0 });
          }
        }
        const scx = s.x + s.w / 2, scy = s.y + s.h / 2;
        const hurt = (kind: Parameters<typeof applyContact>[1], x: number, y: number) => {
          w.hearts = applyContact(w.hearts, kind);
          s.hurt = 0.6;
          w.floaters.push({ x: x - 10, y, text: kind === "creeper" ? "-1" : "-½", life: 1, color: "#ff5a4a" });
        };
        w.enemies = w.enemies.filter((e) => {
          const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
          const speed = w.cfg.enemySpeed;
          if (e.entered && e.kind === "creeper") {
            const d = Math.hypot(scx - cx, scy - cy);
            if (e.fuse > 0 || d < CREEPER_FUSE_RANGE) {
              e.fuse += dt;
              e.vx *= 0.9; e.vy *= 0.9;
              if (e.fuse >= CREEPER_FUSE_SECONDS) {
                explode(w, cx, cy);
                if (Math.hypot(scx - cx, scy - cy) < CREEPER_BLAST_RADIUS) hurt("creeper", cx, e.y);
                for (const b of w.blocks) if (Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy) < CREEPER_BLAST_RADIUS) b.hp = hitBlock(b.hp);
                return false;
              }
            } else steerToward(e, scx, scy, speed * 0.9, 1.2, dt);
          } else if (e.entered && e.kind === "zombie") {
            steerToward(e, scx, scy, speed * 0.75, 2, dt);
          } else if (e.entered && e.kind === "spider") {
            e.timer -= dt;
            if (e.timer <= 0) {
              e.timer = rnd(1.8, 2.8);
              const d = Math.hypot(scx - cx, scy - cy) || 1;
              e.vx = ((scx - cx) / d) * speed * 2.6;
              e.vy = ((scy - cy) / d) * speed * 2.6;
            } else if (Math.hypot(e.vx, e.vy) > speed * 1.05) { e.vx *= 1 - dt * 1.5; e.vy *= 1 - dt * 1.5; }
          } else if (e.entered && e.kind === "skeleton") {
            e.timer -= dt;
            if (e.timer <= 0) {
              e.timer = SKELETON_SHOOT_EVERY * rnd(0.8, 1.2);
              const d = Math.hypot(scx - cx, scy - cy) || 1;
              w.arrows.push({ x: cx, y: cy, w: 6, h: 6, vx: ((scx - cx) / d) * ARROW_SPEED, vy: ((scy - cy) / d) * ARROW_SPEED });
            }
          }
          if (!stepMover(e, dt, w.W, w.H)) return false;
          // Placed blocks stop mobs and take a hit.
          for (const b of w.blocks) {
            if (b.hp > 0 && overlaps(e, b, 0.05)) {
              b.hp = hitBlock(b.hp);
              burst(w, b.x + b.w / 2, b.y + b.h / 2, FX[b.kind], 10, 150);
              if (e.kind === "creeper") { explode(w, cx, cy); if (Math.hypot(scx - cx, scy - cy) < CREEPER_BLAST_RADIUS) hurt("creeper", cx, e.y); return false; }
              const ox = cx - (b.x + b.w / 2), oy = cy - (b.y + b.h / 2);
              if (Math.abs(ox) / (e.w + b.w) > Math.abs(oy) / (e.h + b.h)) { e.vx = Math.sign(ox || 1) * Math.abs(e.vx || speed); e.x += Math.sign(ox || 1) * 8; }
              else { e.vy = Math.sign(oy || 1) * Math.abs(e.vy || speed); e.y += Math.sign(oy || 1) * 8; }
              if (e.kind === "spider") e.timer = Math.max(e.timer, 1.2);
              break;
            }
          }
          if (w.swing > 0 && swordHits(s, s.facing, e)) {
            w.kills += 1;
            burst(w, cx, cy, e.kind === "skeleton" ? FX.bone : FX.mob, 16, 220);
            w.floaters.push({ x: cx - 10, y: e.y, text: "POW", life: 0.7, color: "#ffe066" });
            return false;
          }
          if (e.kind !== "creeper" && overlaps(s, e)) {
            hurt(e.kind, cx, e.y);
            burst(w, cx, cy, e.kind === "skeleton" ? FX.bone : FX.mob, 18, 200);
            w.shake = 6;
            return false;
          }
          return true;
        });
        w.arrows = w.arrows.filter((ar) => {
          ar.x += ar.vx * dt; ar.y += ar.vy * dt;
          if (ar.x < -20 || ar.y < -20 || ar.x > w.W + 20 || ar.y > w.H + 20) return false;
          if (w.swing > 0 && swordHits(s, s.facing, ar)) return false;
          for (const b of w.blocks) if (b.hp > 0 && overlaps(ar, b, 0)) { b.hp = hitBlock(b.hp); burst(w, ar.x, ar.y, FX[b.kind], 6, 100); return false; }
          if (overlaps(s, ar, 0.15)) { hurt("arrow", ar.x, ar.y); w.shake = 4; return false; }
          return true;
        });
        w.blocks = w.blocks.filter((b) => {
          if (b.hp > 0) return true;
          burst(w, b.x + b.w / 2, b.y + b.h / 2, FX[b.kind], 18, 220);
          return false;
        });
        if (w.hearts <= 0) {
          go("gameOver");
          return;
        }
        if (w.timeLeft <= 0) {
          for (const e of w.enemies) burst(w, e.x + e.w / 2, e.y + e.h / 2, FX.bone, 6, 100);
          w.enemies = [];
          w.arrows = [];
          w.blocks = [];
          go("levelComplete");
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [go, pushHud, startNight]);

  const playing = phase === "day" || phase === "night";
  const progress = hud.total > 0 ? Math.max(0, Math.min(1, hud.timeLeft / hud.total)) : 0;
  const nextNight = levelConfig(hud.level + 1, settingsRef.current).nightDuration;

  return (
    <div className={cn("relative h-dvh w-full select-none overflow-hidden bg-night", paused && "game-paused")}>
      {/* Background: day video crossfades to the night scene */}
      <img
        src={dayImg}
        alt=""
        width={1920}
        height={1088}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-[2500ms]",
          night ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-[2500ms]",
          night ? "opacity-100" : "opacity-0",
        )}
      >
        <img src={nightImg} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="night-stars absolute inset-x-0 top-0 h-1/2" />
        <div className="night-mist absolute inset-x-0 bottom-0 h-1/2" />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-background transition-opacity duration-500",
          playing ? "opacity-0" : "opacity-40",
        )}
      />

      <canvas
        ref={canvasRef}
        className="pixelated absolute inset-0 touch-none"
        onPointerDown={(e) => { if (!pausedRef.current) world.current.pointer = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          if (world.current.pointer) world.current.pointer = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (world.current.pointer = null)}
        onPointerLeave={() => (world.current.pointer = null)}
      />

      {playing && !paused && (
        <Button variant="secondary" size="icon" aria-label="Pause game" title="Pause game" onClick={() => changePause(true)} className="pixel-button absolute bottom-4 right-4 h-12 w-12 rounded-none"><Pause /></Button>
      )}
      {paused && (
        <Overlay>
          <h2 className="text-center font-display text-2xl text-accent text-pixel-shadow">Paused</h2>
          <p className="mt-4 text-center text-2xl text-muted-foreground">Level {hud.level} · {night ? "Night" : "Day"} · {fmtTime(hud.timeLeft)}</p>
          <div className="mt-6 space-y-3">
            <Button onClick={() => changePause(false)} disabled={saving} className="pixel-button h-auto w-full rounded-none py-4"><Play /> Resume</Button>
            <Button onClick={userId ? saveProgress : signInToSave} disabled={saving} className="pixel-button h-auto w-full rounded-none py-4"><Save /> {saving ? "Saving…" : userId ? "Save progress" : "Sign in to save"}</Button>
            {saveMessage && <p role="status" className="text-center text-xl text-accent">{saveMessage}</p>}
            {confirmQuit ? (
              <div className="space-y-3">
                <p className="text-center text-xl text-muted-foreground">Quit this run? Unsaved progress will be lost.</p>
                <Button variant="destructive" onClick={toMenu} className="h-auto w-full rounded-none py-3">Quit to menu</Button>
                <Button variant="ghost" onClick={() => setConfirmQuit(false)} className="w-full">Cancel</Button>
              </div>
            ) : <Button variant="ghost" onClick={() => setConfirmQuit(true)} disabled={saving} className="h-auto w-full py-3"><LogOut /> Quit game</Button>}
          </div>
        </Overlay>
      )}

      {/* HUD */}
      {phase !== "menu" && (
        <>
          <div className="pixel-panel absolute left-4 top-4 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-6">
              <span className="font-display text-[10px] uppercase text-muted-foreground">Life</span>
              <span className="font-display text-[10px] text-foreground">{hud.hearts.toFixed(1)}</span>
            </div>
            <HeartsRow hearts={hud.hearts} />
            <div className="mt-3 flex gap-3 font-display text-[10px] text-foreground">
              {(["wood", "stone", "iron"] as const).map((k, i) => (
                <span key={k} className="flex items-center gap-1" title={`${k} (press ${i + 1})`}>
                  <span className={cn("inline-block h-4 w-4 border-2 border-border", k === "wood" ? "bg-block-wood" : k === "stone" ? "bg-block-stone" : "bg-block-iron")} />
                  {i + 1}:{hud[k]}
                </span>
              ))}
            </div>
          </div>
          <div className="pixel-panel absolute right-4 top-4 w-56 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] uppercase text-muted-foreground">Level {hud.level}</span>
              <span className="font-display text-[10px] uppercase text-accent">
                {phase === "night" || phase === "levelComplete" ? "Night" : "Day"}
              </span>
            </div>
            <div className="mt-2 font-display text-xl text-foreground text-pixel-shadow">{fmtTime(hud.timeLeft)}</div>
            <div className="mt-2 h-3 border-2 border-border bg-muted">
              <div
                className={cn("h-full", phase === "night" ? "bg-secondary" : "bg-accent")}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </>
      )}

      {banner && playing && (
        <div key={banner.key} className="banner-fade pointer-events-none absolute inset-x-0 top-[22%] text-center">
          <div className="font-display text-2xl uppercase text-foreground text-pixel-shadow sm:text-4xl">{banner.text}</div>
          <div className="mt-3 text-3xl text-accent text-pixel-shadow">{banner.sub}</div>
        </div>
      )}

      {/* Overlays */}
      {phase === "menu" && !paused && (
        <Overlay>
          <h1 className="text-center font-display text-2xl leading-relaxed text-accent text-pixel-shadow sm:text-3xl">
            Steak &amp; Survive
          </h1>
          <p className="mt-2 text-center text-2xl leading-tight text-muted-foreground">
            Eat steaks and gather blocks by day. Fight or wall off the mobs by night.
          </p>
          {saved && <Button onClick={() => restoreProgress(saved)} className="pixel-button mt-4 h-auto w-full rounded-none py-3"><Play /> Continue saved game · Level {saved.world.level}</Button>}
          {!userId && <Button variant="ghost" onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
            if (result.error) setSaveMessage("Sign-in didn't finish. Please try again.");
          }} className="mt-3 h-auto w-full whitespace-normal">Sign in to load saved game</Button>}
          {saveMessage && <p role="status" className="mt-2 text-center text-xl text-accent">{saveMessage}</p>}
          <div className="mt-6 space-y-5">
            <PixelSlider
              label="Enemy speed"
              value={settings.enemySpeed}
              min={1}
              max={10}
              step={1}
              format={(v) => `${v}`}
              hint={["Slow", "Fast"]}
              onChange={(v) => setSettings((s) => ({ ...s, enemySpeed: v }))}
            />
            <PixelSlider
              label="Day length"
              value={settings.dayDuration}
              min={5}
              max={120}
              step={5}
              format={(v) => `${v}s`}
              onChange={(v) => setSettings((s) => ({ ...s, dayDuration: v }))}
            />
            <PixelSlider
              label="Night length"
              value={settings.nightDuration}
              min={15}
              max={30}
              step={5}
              format={(v) => `${v}s`}
              onChange={(v) => setSettings((s) => ({ ...s, nightDuration: v }))}
            />
          </div>
          <button onClick={startGame} className="pixel-button mt-7 w-full px-6 py-4 text-sm uppercase">
            Start new game
          </button>
          <p className="mt-4 text-center text-xl leading-tight text-muted-foreground">
            Arrows/WASD move · Space swings sword · 1/2/3 place wood/stone/iron where you stand
          </p>
        </Overlay>
      )}

      {phase === "levelComplete" && !paused && (
        <Overlay>
          <h2 className="text-center font-display text-xl leading-relaxed text-primary text-pixel-shadow sm:text-2xl">
            Level {hud.level} complete
          </h2>
          <p className="mt-3 text-center text-2xl text-muted-foreground">You survived the night!</p>
          <div className="mt-5 flex justify-center">
            <HeartsRow hearts={hud.hearts} />
          </div>
          <p className="mt-5 text-center text-xl leading-tight text-muted-foreground">
            Mobs defeated: {hud.kills}. Next night: {nextNight}s with more, faster mobs{hud.level === 1 ? " and zombies" : hud.level === 2 ? " and spiders" : ""}.
          </p>
          <button autoFocus onClick={nextLevel} className="pixel-button mt-6 w-full px-6 py-4 text-sm uppercase">
            Next level
          </button>
        </Overlay>
      )}

      {phase === "gameOver" && (
        <Overlay>
          <h2 className="text-center font-display text-3xl leading-relaxed text-destructive text-pixel-shadow sm:text-4xl">
            Game over
          </h2>
          <p className="mt-3 text-center text-2xl text-muted-foreground">
            You fell on level {hud.level} after eating {hud.steaks} steaks.
          </p>
          <button autoFocus onClick={toMenu} className="pixel-button mt-6 w-full px-6 py-4 text-sm uppercase">
            New game
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="pixel-panel pop-in my-auto w-full max-w-md px-6 py-7 sm:px-8">{children}</div>
    </div>
  );
}

function explode(w: World, x: number, y: number) {
  burst(w, x, y, FX.boom, 46, 380);
  w.flashes.push({ x, y, life: 0.45, max: 0.45 });
  w.shake = 14;
}

function swingSword(w: World) {
  if (w.swingCooldown > 0) return;
  w.swing = SWORD_SWING_SECONDS;
  w.swingCooldown = SWORD_COOLDOWN;
}

/** Drop a block right where Steve is standing. */
function placeBlock(w: World, kind: BlockKind) {
  if (w.inventory[kind] <= 0) {
    w.floaters.push({ x: w.steve.x - 10, y: w.steve.y - 8, text: `no ${kind}`, life: 0.8, color: "#ff9a8a" });
    return;
  }
  const s = w.steve;
  const x = Math.round(s.x + s.w / 2 - BLOCK_SIZE / 2), y = Math.round(s.y + s.h - BLOCK_SIZE);
  if (w.blocks.some((b) => Math.abs(b.x - x) < BLOCK_SIZE * 0.6 && Math.abs(b.y - y) < BLOCK_SIZE * 0.6)) return;
  w.inventory[kind] -= 1;
  w.blocks.push({ x, y, w: BLOCK_SIZE, h: BLOCK_SIZE, kind, hp: BLOCK_DURABILITY[kind] });
}

function burst(w: World, x: number, y: number, colors: string[], n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rnd(speed * 0.3, speed);
    const life = rnd(0.35, 0.8);
    w.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, size: Math.floor(rnd(3, 8)), color: pick(colors) });
  }
}

function draw(ctx: CanvasRenderingContext2D, sp: SpriteSet, w: World, t: number) {
  ctx.clearRect(0, 0, w.W, w.H);
  ctx.save();
  if (w.shake > 0) ctx.translate(rnd(-w.shake, w.shake), rnd(-w.shake, w.shake));

  const shadow = (x: number, y: number, width: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, width / 2, width / 6, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const s of w.steaks) {
    ctx.save();
    ctx.translate(Math.round(s.x + s.w / 2), Math.round(s.y + s.h / 2 + Math.sin(t * 2 + s.spin) * 2));
    ctx.drawImage(sp.steak, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }

  for (const r of w.resources) {
    ctx.save();
    ctx.translate(Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2));
    ctx.drawImage(sp[r.kind], -r.w / 2, -r.h / 2, r.w, r.h);
    ctx.restore();
  }

  for (const b of w.blocks) {
    ctx.drawImage(sp[b.kind], b.x, b.y, b.w, b.h);
    const max = BLOCK_DURABILITY[b.kind];
    if (b.hp < max) {
      ctx.strokeStyle = "rgba(20,20,20,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + 6); ctx.lineTo(b.x + 20, b.y + 22); ctx.lineTo(b.x + 14, b.y + 34);
      if (b.hp < max - 1) { ctx.moveTo(b.x + 34, b.y + 8); ctx.lineTo(b.x + 22, b.y + 20); }
      ctx.stroke();
    }
    for (let i = 0; i < b.hp; i++) { ctx.fillStyle = "#ffe066"; ctx.fillRect(b.x + 4 + i * 8, b.y - 8, 6, 4); }
  }

  for (const a of w.arrows) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#6e4c22"; ctx.fillRect(-14, -1, 20, 3);
    ctx.fillStyle = "#d8d8d8"; ctx.fillRect(6, -3, 5, 7);
    ctx.fillStyle = "#f0f0f0"; ctx.fillRect(-16, -3, 4, 7);
    ctx.restore();
  }

  for (const e of w.enemies) {
    const bob = e.kind === "spider" ? 0 : Math.sin(t * 2 + e.bob) * 2;
    shadow(e.x + e.w / 2, e.y + e.h + 6, e.w);
    ctx.save();
    ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + bob));
    if (e.vx < 0) ctx.scale(-1, 1);
    if (e.fuse > 0) {
      const swell = 1 + (e.fuse / CREEPER_FUSE_SECONDS) * 0.25;
      ctx.translate(0, e.h / 2); ctx.scale(swell, swell); ctx.translate(0, -e.h / 2);
    }
    ctx.drawImage(sp[e.kind], -e.w / 2, 0, e.w, e.h);
    if (e.fuse > 0 && Math.floor(e.fuse * 10) % 2 === 0) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = "#ffffff"; ctx.fillRect(-e.w / 2, 0, e.w, e.h); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  if (w.phase !== "menu") {
    const s = w.steve;
    const blink = s.hurt > 0 && Math.floor(s.hurt * 14) % 2 === 0;
    shadow(s.x + s.w / 2, s.y + s.h + 4, s.w);
    if (!blink) {
      ctx.save();
      ctx.translate(Math.round(s.x + s.w / 2), Math.round(s.y + Math.abs(Math.sin(s.walk)) * -2));
      ctx.scale(s.facing, 1);
      ctx.drawImage(sp.steve, -s.w / 2, 0, s.w, s.h);
      if (w.phase === "night" || w.swing > 0) {
        const k = w.swing > 0 ? 1 - w.swing / SWORD_SWING_SECONDS : 0;
        ctx.save();
        ctx.translate(s.w / 2 - 4, s.h * 0.55);
        ctx.rotate(-1.2 + k * 2.4);
        ctx.drawImage(sp.sword, 0, -32, 32, 32);
        ctx.restore();
      }
      ctx.restore();
      if (w.swing > 0) {
        const k = w.swing / SWORD_SWING_SECONDS;
        ctx.strokeStyle = `rgba(255,255,255,${k * 0.8})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        if (s.facing > 0) ctx.arc(cx, cy, 58, -1.1, 1.1); else ctx.arc(cx, cy, 58, Math.PI - 1.1, Math.PI + 1.1);
        ctx.stroke();
      }
    }
  }

  for (const f of w.flashes) {
    const k = f.life / f.max;
    ctx.fillStyle = `rgba(255,245,210,${k * 0.85})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, (1 - k) * 110 + 20, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of w.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.font = '16px "Press Start 2P", monospace';
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(f.text, f.x + 2, f.y + 2);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
