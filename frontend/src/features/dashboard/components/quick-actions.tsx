import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, FilePlus2, CalendarPlus } from "lucide-react";

const EXTERNAL = [
  {
    label: "Desmos",
    href: "https://www.desmos.com/calculator",
    favicon: "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://desmos.com/calculator&size=64",
  },
  {
    label: "Excalidraw",
    href: "https://excalidraw.com",
    favicon: "https://www.google.com/s2/favicons?domain=excalidraw.com&sz=64",
  },
  {
    label: "ChatGPT",
    href: "https://chatgpt.com",
    favicon: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64",
  },
];

const INTERNAL = [
  { label: "New Lesson", href: "/schedule", icon: CalendarPlus },
  { label: "New Invoice", href: "/payments/new", icon: FilePlus2 },
  { label: "Add Student", href: "/students", icon: UserPlus },
];

export function QuickActions() {
  return (
    <Card data-tour="quick-actions">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="grid grid-cols-3 gap-2">
          {INTERNAL.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="outline"
              className="h-auto justify-start gap-1.5 py-2"
            >
              <Link to={action.href}>
                <action.icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {EXTERNAL.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="outline"
              title={action.label}
              className="h-auto w-full flex-col gap-1 py-2.5"
            >
              <a
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1"
              >
                <img
                  src={action.favicon}
                  alt={action.label}
                  className="h-6 w-6 shrink-0 rounded-sm"
                />
                <span className="text-[10px]">{action.label}</span>
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
