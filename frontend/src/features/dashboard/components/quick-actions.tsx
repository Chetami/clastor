import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, FilePlus2, CalendarPlus } from "lucide-react";

const INTERNAL = [
  { label: "New Lesson", href: "/schedule", icon: CalendarPlus },
  { label: "New Invoice", href: "/payments/new", icon: FilePlus2 },
  { label: "Add Student", href: "/students", icon: UserPlus },
];

export function QuickActions() {
  return (
    <Card data-tour="quick-actions">
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
