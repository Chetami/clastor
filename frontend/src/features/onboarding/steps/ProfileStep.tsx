import { AvatarUpload } from "@/components/account/AvatarUpload";
import { CurrencySelect } from "@/components/account/CurrencySelect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Profile step: pick an avatar and the currency the tutor charges in. Both
 * controls persist immediately via their own API calls, so navigating away
 * mid-step still keeps whatever the user selected.
 */
export function ProfileStep() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile picture</CardTitle>
          <CardDescription>
            Add a photo so students recognise you. You can change it anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            The currency you charge in. Used across invoices, emails and your
            dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencySelect className="w-full sm:w-72" />
        </CardContent>
      </Card>
    </div>
  );
}
