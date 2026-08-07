import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DURATION_PRESETS } from "../event-schema";

/**
 * Shared duration control for one-off and recurring lessons: quick-pick chips
 * plus an "Other" toggle that reveals a custom number input.
 */
export function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [other, setOther] = useState(false);
  const isPreset = (DURATION_PRESETS as readonly number[]).includes(value);
  const showCustom = other || !isPreset;
  return (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        value={showCustom ? "other" : String(value)}
        onValueChange={(v) => {
          if (!v) return;
          if (v === "other") {
            setOther(true);
          } else {
            setOther(false);
            onChange(Number(v));
          }
        }}
        className="flex flex-wrap justify-start gap-2"
      >
        {DURATION_PRESETS.map((d) => (
          <ToggleGroupItem key={d} value={String(d)}>
            {d} min
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="other">Other</ToggleGroupItem>
      </ToggleGroup>
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={5}
            step={5}
            className="h-9 w-24"
            value={value || ""}
            placeholder="e.g. 50"
            onChange={(e) => onChange(Math.max(1, e.target.valueAsNumber || 0))}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      )}
    </>
  );
}
