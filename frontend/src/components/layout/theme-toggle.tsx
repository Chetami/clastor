import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { appearance, toggleAppearance } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleAppearance}
      title="Toggle theme"
      data-tour="theme-toggle"
    >
      {appearance === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
