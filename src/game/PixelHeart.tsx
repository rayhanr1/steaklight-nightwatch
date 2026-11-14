import { cn } from "@/lib/utils";
import { clampHearts, HEARTS_PER_ROW } from "./rules";

// 7x6 pixel heart. O = outline, R = red, W = shine.
const MAP = [".OO.OO.", "OWRORRO", "ORRRRRO", ".ORRRO.", "..ORO..", "...O..."];

export function PixelHeart({ fill, className }: { fill: "full" | "half" | "empty"; className?: string }) {
  return (
    <svg viewBox="0 0 7 6" className={cn("pixelated h-6 w-7", className)} shapeRendering="crispEdges" aria-hidden>
      {MAP.flatMap((row, y) =>
        [...row].map((ch, x) => {
          if (ch === ".") return null;
          const empty = fill === "empty" || (fill === "half" && x > 3);
          const cls =
            ch === "O"
              ? "fill-heart-outline"
              : empty
                ? "fill-heart-empty"
                : ch === "W"
                  ? "fill-heart-shine"
                  : "fill-heart";
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} className={cls} />;
        }),
      )}
    </svg>
  );
}

export function HeartsRow({ hearts }: { hearts: number }) {
  const life = clampHearts(hearts);
  const full = Math.floor(life);
  const half = life - full >= 0.5;
  const items: ("full" | "half")[] = [...Array(full).fill("full"), ...(half ? ["half" as const] : [])];
  return (
    <div className="flex flex-col gap-1" aria-label={`${life} hearts`}>
      {items.length === 0 ? <PixelHeart fill="empty" /> : Array.from({ length: Math.ceil(items.length / HEARTS_PER_ROW) }, (_, row) => (
        <div key={row} className="flex gap-1">
          {items.slice(row * HEARTS_PER_ROW, (row + 1) * HEARTS_PER_ROW).map((f, i) => <PixelHeart key={i} fill={f} />)}
        </div>
      ))}
    </div>
  );
}
