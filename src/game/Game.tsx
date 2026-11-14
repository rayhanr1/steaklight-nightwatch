import { useCallback, useEffect, useRef, useState } from "react";
import dayVideo from "@/assets/forest-day.mp4.asset.json";
import dayImg from "@/assets/forest-day.jpg";
import nightImg from "@/assets/forest-night.jpg";
import { cn } from "@/lib/utils";
import { HeartsRow } from "./PixelHeart";
import { PixelSlider } from "./PixelSlider";
import {
  applyContact,
  DEFAULT_SETTINGS,
  ENEMY_MAX_BOUNCES,
  levelConfig,
  NIGHT_GROWTH_SECONDS,
  overlaps,
  spawnMover,
  STARTING_HEARTS,
  stepMover,
  type LevelConfig,
  type Mover,
  type Settings,
} from "./rules";
import { buildSprites, SPRITE_SIZE, type SpriteSet } from "./sprites";

type Phase = "menu" | "day" | "night" | "levelComplete" | "gameOver";
type EnemyKind = "skeleton" | "creeper";
type Enemy = Mover & { kind: EnemyKind; bob: number };
type Steak = Mover & { spin: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Floater = { x: number; y: number; text: string; life: number; color: string };
type Flash = { x: number; y: number; life: number; max: number };

type World = {
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
  particles: Particle[];
  floaters: Floater[];
  flashes: Flash[];
  steakTimer: number;
  enemyTimer: number;
  shake: number;
  steaksEaten: number;
  pointer: { x: number; y: number } | null;
};

type Hud = { hearts: number; level: number; timeLeft: number; total: number; steaks: number };

const STEVE_SPEED = 330;
// In-game art colors (canvas), not UI theme colors.
const FX = {
  steak: ["#f5c16b", "#ffe9a8", "#c8742e"],
  bone: ["#e8e8e8", "#bdbdbd", "#8f8f8f"],
  boom: ["#ffffff", "#f6d36b", "#f08a2a", "#6b6b6b", "#3c3c3c"],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] as T;
const fmtTime = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("menu");
  const [night, setNight] = useState(false);
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null);
  const [hud, setHud] = useState<Hud>({ hearts: STARTING_HEARTS, level: 1, timeLeft: 0, total: 1, steaks: 0 });
  const keys = useRef(new Set<string>());

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
    particles: [],
    floaters: [],
    flashes: [],
    steakTimer: 0,
    enemyTimer: 0,
    shake: 0,
    steaksEaten: 0,
    pointer: null,
  });

  const pushHud = useCallback(() => {
    const w = world.current;
    const total = w.phase === "night" ? w.cfg.nightDuration : w.cfg.dayDuration;
    setHud((prev) => {
      const next = { hearts: w.hearts, level: w.level, timeLeft: Math.ceil(w.timeLeft), total, steaks: w.steaksEaten };
      return prev.hearts === next.hearts &&
        prev.level === next.level &&
        prev.timeLeft === next.timeLeft &&
        prev.total === next.total &&
        prev.steaks === next.steaks
        ? prev
        : next;
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
    const w = world.current;
    w.cfg = levelConfig(w.level, settingsRef.current);
    w.timeLeft = w.cfg.dayDuration;
    w.steaks = [];
    w.enemies = [];
    w.particles = [];
    w.floaters = [];
    w.flashes = [];
    w.steakTimer = 0.3;
    w.steve.x = w.W / 2 - w.steve.w / 2;
    w.steve.y = w.H / 2 - w.steve.h / 2;
    w.steve.hurt = 0;
    setNight(false);
    showBanner(`Level ${w.level} · Day`, "Grab the steaks!");
    (document.activeElement as HTMLElement | null)?.blur?.();
    go("day");
  }, [go]);

  const startNight = useCallback(() => {
    const w = world.current;
    for (const s of w.steaks) burst(w, s.x + s.w / 2, s.y + s.h / 2, FX.steak, 6, 80);
    w.steaks = [];
    w.timeLeft = w.cfg.nightDuration;
    w.enemyTimer = 0.8;
    setNight(true);
    showBanner("Night falls", "Avoid the mobs!");
    go("night");
  }, [go]);

  const startGame = useCallback(() => {
    settingsRef.current = settings;
    const w = world.current;
    w.level = 1;
    w.hearts = STARTING_HEARTS;
    w.steaksEaten = 0;
    startDay();
  }, [settings, startDay]);

  const nextLevel = useCallback(() => {
    world.current.level += 1;
    startDay();
  }, [startDay]);

  const toMenu = useCallback(() => {
    const w = world.current;
    w.enemies = [];
    w.steaks = [];
    setNight(false);
    setBanner(null);
    go("menu");
  }, [go]);

  // Keyboard
  useEffect(() => {
    const MOVE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];
    const down = (e: KeyboardEvent) => {
      const p = world.current.phase;
      if (MOVE.includes(e.key) && (p === "day" || p === "night")) {
        e.preventDefault();
        keys.current.add(e.key.toLowerCase());
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
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
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      update(dt);
      draw(ctx, sprites, w, t / 1000);
      hudTick += dt;
      if (hudTick > 0.1) {
        hudTick = 0;
        pushHud();
      }
      raf = requestAnimationFrame(frame);
    };

    const update = (dt: number) => {
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

      w.timeLeft -= dt;

      if (w.phase === "day") {
        w.steakTimer -= dt;
        if (w.steakTimer <= 0 && w.steaks.length < 14) {
          w.steakTimer = rnd(0.45, 0.9);
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
        if (w.timeLeft <= 0) startNight();
      } else {
        w.enemyTimer -= dt;
        if (w.enemyTimer <= 0) {
          w.enemyTimer = w.cfg.enemySpawnInterval * rnd(0.8, 1.2);
          for (let i = 0; i < w.cfg.enemiesPerWave; i++) {
            const kind: EnemyKind = Math.random() < 0.6 ? "skeleton" : "creeper";
            const m = spawnMover(w.W, w.H, 32, 64, w.cfg.enemySpeed * rnd(0.85, 1.15), ENEMY_MAX_BOUNCES);
            w.enemies.push({ ...m, kind, bob: rnd(0, Math.PI * 2) });
          }
        }
        w.enemies = w.enemies.filter((e) => {
          if (!stepMover(e, dt, w.W, w.H)) return false;
          if (overlaps(s, e)) {
            const cx = e.x + e.w / 2,
              cy = e.y + e.h / 2;
            w.hearts = applyContact(w.hearts, e.kind);
            s.hurt = 0.6;
            if (e.kind === "creeper") {
              burst(w, cx, cy, FX.boom, 46, 380);
              w.flashes.push({ x: cx, y: cy, life: 0.45, max: 0.45 });
              w.shake = 14;
              w.floaters.push({ x: cx - 10, y: e.y, text: "-1", life: 1, color: "#ff5a4a" });
            } else {
              burst(w, cx, cy, FX.bone, 18, 200);
              w.shake = 6;
              w.floaters.push({ x: cx - 10, y: e.y, text: "-½", life: 1, color: "#ff5a4a" });
            }
            return false;
          }
          return true;
        });
        if (w.hearts <= 0) {
          go("gameOver");
          return;
        }
        if (w.timeLeft <= 0) {
          for (const e of w.enemies) burst(w, e.x + e.w / 2, e.y + e.h / 2, FX.bone, 6, 100);
          w.enemies = [];
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
    <div className="relative h-dvh w-full select-none overflow-hidden bg-night">
      {/* Background: day video crossfades to the night scene */}
      <video
        src={dayVideo.url}
        poster={dayImg}
        autoPlay
        muted
        loop
        playsInline
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
        <img src={nightImg} alt="" width={1920} height={1088} className="ken-burns absolute inset-0 h-full w-full object-cover" />
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
        onPointerDown={(e) => (world.current.pointer = { x: e.clientX, y: e.clientY })}
        onPointerMove={(e) => {
          if (world.current.pointer) world.current.pointer = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (world.current.pointer = null)}
        onPointerLeave={() => (world.current.pointer = null)}
      />

      {/* HUD */}
      {phase !== "menu" && (
        <>
          <div className="pixel-panel absolute left-4 top-4 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-6">
              <span className="font-display text-[10px] uppercase text-muted-foreground">Life</span>
              <span className="font-display text-[10px] text-foreground">{hud.hearts.toFixed(1)}</span>
            </div>
            <HeartsRow hearts={hud.hearts} />
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
      {phase === "menu" && (
        <Overlay>
          <h1 className="text-center font-display text-2xl leading-relaxed text-accent text-pixel-shadow sm:text-3xl">
            Steak &amp; Survive
          </h1>
          <p className="mt-2 text-center text-2xl leading-tight text-muted-foreground">
            Eat steaks by day. Dodge skeletons and creepers by night.
          </p>
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
              min={10}
              max={120}
              step={5}
              format={(v) => `${v}s`}
              onChange={(v) => setSettings((s) => ({ ...s, dayDuration: v }))}
            />
            <PixelSlider
              label="Night length"
              value={settings.nightDuration}
              min={20}
              max={180}
              step={5}
              format={(v) => `${v}s`}
              onChange={(v) => setSettings((s) => ({ ...s, nightDuration: v }))}
            />
          </div>
          <button onClick={startGame} className="pixel-button mt-7 w-full px-6 py-4 text-sm uppercase">
            Start new game
          </button>
          <p className="mt-4 text-center text-xl leading-tight text-muted-foreground">
            Arrow keys or WASD to move · tap and hold on touch screens
          </p>
        </Overlay>
      )}

      {phase === "levelComplete" && (
        <Overlay>
          <h2 className="text-center font-display text-xl leading-relaxed text-primary text-pixel-shadow sm:text-2xl">
            Level {hud.level} complete
          </h2>
          <p className="mt-3 text-center text-2xl text-muted-foreground">You survived the night!</p>
          <div className="mt-5 flex justify-center">
            <HeartsRow hearts={hud.hearts} />
          </div>
          <p className="mt-5 text-center text-xl leading-tight text-muted-foreground">
            Next night: {nextNight}s (+{NIGHT_GROWTH_SECONDS}s) with more mobs.
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
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="pixel-panel pop-in w-full max-w-md px-6 py-7 sm:px-8">{children}</div>
    </div>
  );
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
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2 + Math.sin(t * 4 + s.spin) * 3);
    ctx.rotate(Math.sin(t * 2 + s.spin) * 0.35);
    ctx.drawImage(sp.steak, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }

  for (const e of w.enemies) {
    const bob = Math.sin(t * 3 + e.bob) * 4;
    shadow(e.x + e.w / 2, e.y + e.h + 6, e.w);
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + bob);
    if (e.vx < 0) ctx.scale(-1, 1);
    ctx.drawImage(e.kind === "skeleton" ? sp.skeleton : sp.creeper, -e.w / 2, 0, e.w, e.h);
    ctx.restore();
  }

  if (w.phase !== "menu") {
    const s = w.steve;
    const blink = s.hurt > 0 && Math.floor(s.hurt * 14) % 2 === 0;
    shadow(s.x + s.w / 2, s.y + s.h + 4, s.w);
    if (!blink) {
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + Math.abs(Math.sin(s.walk)) * -3);
      ctx.scale(s.facing, 1);
      ctx.drawImage(sp.steve, -s.w / 2, 0, s.w, s.h);
      ctx.restore();
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
