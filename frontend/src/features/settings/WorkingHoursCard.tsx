import { Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkingHoursEditor } from "@/components/account/WorkingHoursEditor";

export function WorkingHoursCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" />
          Working hours
        </CardTitle>
        <CardDescription>
          Set the hours you usually work. They're shown as shaded bands on your
          calendar, and you'll be warned when booking a lesson outside them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WorkingHoursEditor />
      </CardContent>
    </Card>
  );
}
