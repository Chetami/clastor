import { useState } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { EMOJI_GROUPS } from "./composer-data";

/**
 * A compact, categorized emoji picker that pops over a toolbar button. Emits
 * the chosen emoji via {@link onPick}; the parent is responsible for splicing
 * it into the textarea at the caret so selection state stays in one place.
 */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(EMOJI_GROUPS[0].label);
  const active = EMOJI_GROUPS.find((g) => g.label === group) ?? EMOJI_GROUPS[0];

  function handleSelect(emoji: string) {
    onPick(emoji);
    // Keep the picker open so users can tap several emojis in a row; closing
    // after each tap is annoying when building a message.
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="gap-1.5 text-muted-foreground"
          aria-label="Insert emoji"
        >
          <Smile className="size-4" />
          Emoji
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        // Prevent the textarea from losing focus / the draft blur while picking.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ToggleGroup
          type="single"
          value={group}
          onValueChange={(v) => v && setGroup(v)}
          className="w-full justify-start gap-1 rounded-none border-b px-2 py-1.5"
        >
          {EMOJI_GROUPS.map((g) => (
            <ToggleGroupItem
              key={g.label}
              value={g.label}
              size="sm"
              className="h-7 px-2 text-xs"
              aria-label={g.label}
            >
              {g.label === "Frequently used"
                ? "😀"
                : g.label === "School"
                  ? "📚"
                  : g.label === "Celebrate"
                    ? "🎉"
                    : g.label === "Love & thanks"
                      ? "❤️"
                      : "➡️"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ScrollArea className="h-48">
          <div className="p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {active.label}
            </p>
            <div className="grid grid-cols-6 gap-1">
              {active.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md text-xl",
                    "transition-colors hover:bg-accent",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
