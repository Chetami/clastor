import { Link } from "react-router-dom";
import { Bell, ChevronRight, CreditCard } from "lucide-react";

import { ReminderLeadTimeSelect } from "@/components/account/ReminderLeadTimeSelect";
import { TimezoneSelect } from "@/components/account/TimezoneSelect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubjectsCard } from "@/features/subjects/SubjectsCard";
import { GoogleConnectionCard } from "./GoogleConnectionCard";
import { WorkingHoursCard } from "./WorkingHoursCard";
import { InvoiceSettingsForm } from "./InvoiceSettingsForm";
import { EmailReviewCard } from "./EmailReviewCard";

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <SubjectsCard />

      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
          <CardDescription>
            The timezone your lesson times are shown in. Used when emailing
            students and generating calendar invites so they see your local
            time. Detected from your browser when you signed up — change it
            here if it's wrong.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimezoneSelect className="w-full sm:w-72" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Notifications
          </CardTitle>
          <CardDescription>
            Automatically remind students before a lesson. Choose when to send,
            or turn it off.{" "}
            <span className="text-orange-600 dark:text-orange-500">
              This is a saved preference — automated sending isn't live yet.
            </span>{" "}
            Currently you can send manual reminders by pressing the remind
            button on a lesson.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Remind students before lessons
            </span>
            <ReminderLeadTimeSelect className="w-full sm:w-72" />
          </div>
        </CardContent>
      </Card>

      <WorkingHoursCard />
      <InvoiceSettingsForm />
      <EmailReviewCard />
      <GoogleConnectionCard />

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
          <CardDescription>
            Connect Stripe to accept card payments that settle straight to your
            bank.{" "}
            <span className="text-orange-600 dark:text-orange-500">
              Automated Stripe billing does not work in the demo period.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/settings/payments">
              <CreditCard className="size-4" />
              Manage payments
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Build identifier for debugging — which version (commit) is live. */}
      <p className="pt-1 text-center text-xs text-muted-foreground/60">
        v{__APP_VERSION__}
      </p>
    </div>
  );
}
