import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUpdateInvoiceSettings } from "./api/use-update-invoice-settings";
import { useAuthStore } from "@/store/auth-store";
import type { InvoiceSettings } from "@examify-tms/interfaces";

interface FieldState {
  abn: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
}

function toFields(settings: InvoiceSettings): FieldState {
  return {
    abn: settings?.abn ?? "",
    accountName: settings?.bankDetails?.accountName ?? "",
    bsb: settings?.bankDetails?.bsb ?? "",
    accountNumber: settings?.bankDetails?.accountNumber ?? "",
  };
}

/**
 * Editor for the invoice customisation fields (ABN + bank details). Shown on
 * the Settings page. Pulls current values from the auth store and saves via
 * PATCH /api/users/me; the invoice template preview query is invalidated by
 * the mutation so the PDF re-renders if it's open elsewhere.
 */
export function InvoiceSettingsForm() {
  const user = useAuthStore((s) => s.user);
  const updateSettings = useUpdateInvoiceSettings();

  const [fields, setFields] = useState<FieldState>(() =>
    toFields(user?.invoiceSettings ?? null),
  );

  // Re-sync from the store if the user record changes externally (e.g. after a
  // successful save round-trip or a fresh auth fetch).
  useEffect(() => {
    setFields(toFields(user?.invoiceSettings ?? null));
  }, [user?.invoiceSettings]);

  function update<K extends keyof FieldState>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const settings: InvoiceSettings = {
      abn: fields.abn.trim() || null,
      bankDetails: {
        accountName: fields.accountName.trim() || null,
        bsb: fields.bsb.trim() || null,
        accountNumber: fields.accountNumber.trim() || null,
      },
    };
    updateSettings.mutate(settings, {
      onSuccess: () => toast.success("Invoice details saved."),
      onError: (err) => toast.error(err.message || "Couldn't save details."),
    });
  }

  const dirty =
    JSON.stringify(fields) !==
    JSON.stringify(toFields(user?.invoiceSettings ?? null));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice details</CardTitle>
        <CardDescription>
          Shown on every invoice you send. Add your ABN and where customers
          should send payment — your invoice template updates as soon as you
          save.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-abn">ABN</Label>
            <Input
              id="invoice-abn"
              value={fields.abn}
              onChange={(e) => update("abn", e.target.value)}
              placeholder="12 345 678 901"
              autoComplete="off"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Bank details</p>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-account-name">Account name</Label>
              <Input
                id="invoice-account-name"
                value={fields.accountName}
                onChange={(e) => update("accountName", e.target.value)}
                placeholder="Jordan Lee"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-bsb">BSB</Label>
                <Input
                  id="invoice-bsb"
                  value={fields.bsb}
                  onChange={(e) => update("bsb", e.target.value)}
                  placeholder="063-000"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-account-number">Account number</Label>
                <Input
                  id="invoice-account-number"
                  value={fields.accountNumber}
                  onChange={(e) => update("accountNumber", e.target.value)}
                  placeholder="12345678"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={updateSettings.isPending || !dirty}>
              {updateSettings.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save details
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                disabled={updateSettings.isPending}
                onClick={() =>
                  setFields(toFields(user?.invoiceSettings ?? null))
                }
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
