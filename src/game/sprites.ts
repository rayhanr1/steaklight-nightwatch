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
  const ctx = c.getContext("2d");
  if (!ctx) return c;
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

const ZOMBIE = [
  "GGGGGGGG","GDGGGGDG","GGGGGGGG","GKKGGKKG","GGGDDGGG","GGDDDDGG","GGGGGGGG","GGGGGGGG",
  "TTTTTTTT","TTTTTTTT","GGTTTTGG","GGTTTTGG","..LLLL..","..LLLL..","..LLLL..","..LLLL..",
];
const ZOMBIE_PAL: Palette = { G: "#5f9a4a", D: "#3f6e30", K: "#111111", T: "#2aa2a8", L: "#3d3a9e" };
const SPIDER = [
  "L..........L",".L..BBBB..L.","..LBBBBBBL..","LLBRRBBRRBLL",
  "..BBBBBBBB..",".LBBBBBBBBL.","L..L....L..L","...L....L...",
];
const SPIDER_PAL: Palette = { B: "#3a302a", L: "#22201c", R: "#d21f1f" };
const ENDERMAN = [
  "..BBBBBB..", "..BBBBBB..", "..PEBBEP..", "..BBBBBB..", "..BBBBBB..",
  ".BBBBBBBB.", "B.BBBBBB.B", "B.BBBBBB.B", "B.BBBBBB.B", "B.BBBBBB.B",
  "B.BBBBBB.B", "B.BBBBBB.B", "B..BB.BB.B", "B..BB.BB.B", "B..BB.BB.B",
  "B..BB.BB.B", "B..BB.BB.B", "...BB.BB..", "...BB.BB..", "...BB.BB..", "...BB.BB..", "...BB.BB..",
];
const ENDERMAN_PAL: Palette = { B: "#171419", P: "#c56af4", E: "#f1c5ff" };
const BLOCK = (a: string, b: string, c: string) => ({ A: a, B: b, C: c });
const WOOD = ["AAAAAAAA","BBBCBBBB","AAAAAAAA","CBBBBBCB","AAAAAAAA","BBBBCBBB","AAAAAAAA","BCBBBBBB"];
const STONE = ["AABAACAA","ABAAAAAB","AAACAAAA","BAAAABAA","AAAAAAAC","ACABAAAA","AAAAAABA","BAAACAAA"];
const IRON = ["CCCCCCCC","CAABAAAC","CABAAABC","CAAAAAAC","CAAAABAC","CBAAAAAC","CAAABAAC","CCCCCCCC"];
const TNT = ["AAAAAAAA","ABAABAAB","AAAAAAAA","CCCCCCCC","CDCDDCDC","CCCCCCCC","AAAAAAAA","ABAABAAB"];
const SWORD = ["......WW",".....WGW","....WGW.","...WGW..","B.WGW...",".BBW....",".HB.....","H.B....."];
const SWORD_PAL: Palette = { W: "#eef2f4", G: "#b8c4ca", B: "#5a3a1e", H: "#3b2716" };

export type SpriteSet = ReturnType<typeof buildSprites>;

export function buildSprites() {
  return {
    steve: render(STEVE, STEVE_PAL, 4),
    skeleton: render(SKELETON, SKELETON_PAL, 4),
    creeper: render(CREEPER, CREEPER_PAL, 4),
    steak: render(STEAK, STEAK_PAL, 4),
    zombie: render(ZOMBIE, ZOMBIE_PAL, 4),
    spider: render(SPIDER, SPIDER_PAL, 4),
    enderman: render(ENDERMAN, ENDERMAN_PAL, 4),
    wood: render(WOOD, BLOCK("#b8894c", "#9a6f38", "#6e4c22"), 5),
    stone: render(STONE, BLOCK("#8d8d8d", "#6f6f6f", "#4f4f4f"), 5),
    tnt: render(TNT, { A: "#c8322a", B: "#8e1f1a", C: "#eeeeee", D: "#222222" }, 5),
    iron: render(IRON, BLOCK("#d8d8d8", "#bcbcbc", "#8a8a8a"), 5),
    sword: render(SWORD, SWORD_PAL, 4),
  };
}

export const SPRITE_SIZE = {
  steve: { w: 32, h: 64 },
  skeleton: { w: 32, h: 64 },
  creeper: { w: 32, h: 64 },
  steak: { w: 32, h: 32 },
  zombie: { w: 32, h: 64 },
  spider: { w: 48, h: 32 },
  enderman: { w: 40, h: 88 },
};
