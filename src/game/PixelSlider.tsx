import * as SliderPrimitive from "@radix-ui/react-slider";

export function PixelSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: [string, string];
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-display text-sm text-accent">{format(value)}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-label={label}
        className="relative flex h-8 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-4 w-full grow border-4 border-border bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-8 w-5 cursor-grab border-4 border-border bg-accent outline-none focus-visible:ring-4 focus-visible:ring-ring active:cursor-grabbing" />
      </SliderPrimitive.Root>
      {hint && (
        <div className="flex justify-between text-lg leading-none text-muted-foreground">
          <span>{hint[0]}</span>
          <span>{hint[1]}</span>
        </div>
      )}
    </div>
  );
}
