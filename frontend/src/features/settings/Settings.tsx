import { Link } from "react-router-dom";
import { Bell, ChevronRight, CreditCard } from "lucide-react";

import { CurrencySelect } from "@/components/account/CurrencySelect";
import { ReminderLeadTimeSelect } from "@/components/account/ReminderLeadTimeSelect";
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

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <SubjectsCard />

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            The currency you charge in. Used across your dashboard, invoices,
            emails and public profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencySelect className="w-full sm:w-72" />
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
            or turn it off. This is a saved preference — sending isn't live yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Remind students before lessons</span>
            <ReminderLeadTimeSelect className="w-full sm:w-72" />
          </div>
        </CardContent>
      </Card>

      <GoogleConnectionCard />

      <WorkingHoursCard />

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
          <CardDescription>
            Connect Stripe to accept card payments that settle straight to your
            bank.
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
    </div>
  );
}
