import { MorphIcon } from "morphicons/react";
import { Moon, Sun } from "lucide";
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
      <MorphIcon
        icon={appearance === "dark" ? Sun : Moon}
        size={16}
        spring="snappy"
      />
    </Button>
  );
}
