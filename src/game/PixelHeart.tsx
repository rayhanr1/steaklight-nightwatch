import { cn } from "@/lib/utils";

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
  const full = Math.floor(hearts);
  const half = hearts - full >= 0.5;
  const items: ("full" | "half")[] = [...Array(full).fill("full"), ...(half ? ["half" as const] : [])];
  return (
    <div className="flex max-w-[18rem] flex-wrap gap-1">
      {items.length === 0 ? <PixelHeart fill="empty" /> : items.map((f, i) => <PixelHeart key={i} fill={f} />)}
    </div>
  );
}
