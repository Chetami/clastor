import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  PenLine,
  UserPlus,
  FilePlus2,
  CalendarPlus,
} from "lucide-react";

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
        <div className="grid grid-cols-2 gap-2">
          {EXTERNAL.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="secondary"
              className="h-auto items-start gap-1 py-2"
            >
              <a href={action.href} target="_blank" rel="noopener noreferrer">
                <span className="flex items-center gap-1.5">
                  <action.icon className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">
                    {action.label}
                  </span>
                </span>
                <span className="text-[10px] font-normal ">
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
