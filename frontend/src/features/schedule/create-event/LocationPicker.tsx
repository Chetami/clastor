import { Globe, MapPin, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type LocationMode = "zoom" | "meet" | "inperson" | "other" | "";

interface LocationPickerProps {
  locationMode: LocationMode;
  locationValue: string;
  onModeChange: (mode: LocationMode) => void;
  onLocationChange: (value: string) => void;
}

/** Location toggle (Zoom / Meet / In Person / Other) with an "Other" text field. */
export function LocationPicker({
  locationMode,
  locationValue,
  onModeChange,
  onLocationChange,
}: LocationPickerProps) {
  return (
    <div className="space-y-2">
      <Label>
        Location{" "}
        <span className="text-xs font-normal text-muted-foreground">
          (optional)
        </span>
      </Label>
      <ToggleGroup
        type="single"
        variant="outline"
        value={locationMode}
        onValueChange={(v) => onModeChange(v as LocationMode)}
        className="flex-wrap justify-start gap-2"
      >
        <ToggleGroupItem
          value="zoom"
          aria-label="Zoom"
          disabled
          title="Zoom integration is not available yet"
        >
          <Video className="mr-1.5 h-4 w-4" />
          Zoom
        </ToggleGroupItem>
        <ToggleGroupItem value="meet" aria-label="Google Meet">
          <Video className="mr-1.5 h-4 w-4" />
          Meet
        </ToggleGroupItem>
        <ToggleGroupItem value="inperson" aria-label="In Person">
          <MapPin className="mr-1.5 h-4 w-4" />
          In Person
        </ToggleGroupItem>
        <ToggleGroupItem value="other" aria-label="Other">
          <Globe className="mr-1.5 h-4 w-4" />
          Other
        </ToggleGroupItem>
      </ToggleGroup>
      {locationMode === "other" && (
        <Input
          id="location"
          placeholder="e.g. Microsoft Teams, Skype…"
          value={locationValue}
          onChange={(e) => onLocationChange(e.target.value)}
        />
      )}
    </div>
  );
}
