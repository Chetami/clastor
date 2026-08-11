import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLOR_SCHEMES, useTheme } from "@/hooks/use-theme";

export function AppearanceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { colorScheme, setColorScheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            Choose a colour scheme. Each pairs a neutral base with a primary
            accent. Your light or dark preference still applies on top.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {COLOR_SCHEMES.map((scheme) => {
            const selected = scheme.value === colorScheme;
            return (
              <button
                key={scheme.value}
                type="button"
                onClick={() => setColorScheme(scheme.value)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors hover:bg-accent ${
                  selected ? "border-primary" : "border-transparent bg-muted/40"
                }`}
              >
                <span className="flex -space-y-2">
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.base }}
                  />
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.swatch }}
                  />
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.darkSwatch }}
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {scheme.label}
                  </span>
                  <span
                    className={`text-xs leading-tight ${
                      selected ? "text-muted-foreground" : "text-transparent"
                    }`}
                  >
                    Active
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
