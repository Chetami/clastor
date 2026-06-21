import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, PenLine, UserPlus, FilePlus2, CalendarPlus } from "lucide-react";

const EXTERNAL = [
  {
    label: "Desmos",
    href: "https://www.desmos.com/calculator",
    icon: Calculator,
    description: "Graphing calculator",
  },
  {
    label: "Excalidraw",
    href: "https://excalidraw.com",
    icon: PenLine,
    description: "Whiteboard",
  },
];

const INTERNAL = [
  { label: "New Lesson", href: "/schedule", icon: CalendarPlus },
  { label: "New Invoice", href: "/payments/new", icon: FilePlus2 },
  { label: "Add Student", href: "/students", icon: UserPlus },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTERNAL.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="outline"
              className="h-auto justify-start gap-2 py-3"
            >
              <Link to={action.href}>
                <action.icon className="h-4 w-4" />
                <span className="text-xs">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {EXTERNAL.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="secondary"
              className="h-auto flex-col items-start gap-1 py-3"
            >
              <a href={action.href} target="_blank" rel="noopener noreferrer">
                <span className="flex items-center gap-2">
                  <action.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{action.label}</span>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {action.description}
                </span>
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
