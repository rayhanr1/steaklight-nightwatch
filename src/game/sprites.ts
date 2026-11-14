// Pixel-art sprites drawn from character maps, rendered once to offscreen canvases.
// Sprite palettes are in-game art, not UI theme colors.

type Palette = Record<string, string>;

const STEVE = [
  "HHHHHHHH",
  "HHHHHHHH",
  "HSSSSSSH",
  "SSSSSSSS",
  "SEPSSPES",
  "SSSNNSSS",
  "SSMMMMSS",
  "SSSSSSSS",
  "TTTTTTTT",
  "TTTTTTTT",
  "SSTTTTSS",
  "SSTTTTSS",
  "..LLLL..",
  "..LLLL..",
  "..LLLL..",
  "..BBBB..",
];
const STEVE_PAL: Palette = {
  H: "#3b2716", S: "#c58c69", E: "#ffffff", P: "#4b3aa0", N: "#8a5a3c", M: "#6b3b24",
  T: "#00a6a6", L: "#3433a8", B: "#4a4a4a",
};

const SKELETON = [
  "WWWWWWWW",
  "WGWWWWGW",
  "WWWWWWWW",
  "WKKWWKKW",
  "WKKWWKKW",
  "WWWKKWWW",
  "WGKKKKGW",
  "WWWWWWWW",
  "W.WWWW.W",
  "W.GWWG.W",
  "W.WWWW.W",
  "G.GWWG.G",
  "..W..W..",
  "..W..W..",
  "..W..W..",
  "..G..G..",
];
const SKELETON_PAL: Palette = { W: "#d9d9d9", G: "#9c9c9c", K: "#1f1f1f" };

const CREEPER = [
  "LDLMLLDL",
  "MLLDLMLL",
  "LKKLLKKL",
  "DKKMLKKD",
  "LLMKKLLM",
  "LDKKKKDL",
  "MLKKKKLM",
  "LLKLLKLL",
  "..LDML..",
  "..MLLD..",
  "..DLML..",
  "..LMDL..",
  ".MLDLML.",
  ".LDMLDL.",
  ".DL..LD.",
  ".DD..DD.",
];
const CREEPER_PAL: Palette = { L: "#5cb83a", D: "#3a8a2a", M: "#86dc5c", K: "#111111" };

const STEAK = [
  "...FFF..",
  "..FMMMF.",
  ".FMDMMMF",
  "FMMMDMMF",
  "FMDMMMDF",
  "FMMMDMF.",
  ".FMMMF..",
  "..FFF...",
];
const STEAK_PAL: Palette = { F: "#e9c79a", M: "#8a4a22", D: "#5a2a10" };

function render(map: string[], pal: Palette, scale: number, flip = false) {
  const w = map[0]?.length ?? 0, h = map.length;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect((flip ? w - 1 - x : x) * scale, y * scale, scale, scale);
    }),
  );
  return c;
}

export type SpriteSet = ReturnType<typeof buildSprites>;

export function buildSprites() {
  return {
    steve: render(STEVE, STEVE_PAL, 4),
    skeleton: render(SKELETON, SKELETON_PAL, 4),
    creeper: render(CREEPER, CREEPER_PAL, 4),
    steak: render(STEAK, STEAK_PAL, 4),
  };
}

export const SPRITE_SIZE = {
  steve: { w: 32, h: 64 },
  skeleton: { w: 32, h: 64 },
  creeper: { w: 32, h: 64 },
  steak: { w: 32, h: 32 },
};
