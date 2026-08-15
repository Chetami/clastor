import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { updateUserCurrencyRequest } from "@/features/settings/api/requests";
import { CURRENCY_OPTIONS } from "./currency-options";

/**
 * Currency selector bound to the authenticated user. Persists the chosen
 * currency immediately and pushes the updated UserInfo into the auth store.
 * Used by Settings and the onboarding wizard.
 */
export function CurrencySelect({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const current = user?.currency ?? "AUD";

  async function handleChange(code: string) {
    try {
      const updated = await updateUserCurrencyRequest(code);
      setUser(updated);
    } catch (err) {
      // The store keeps the previous value — tell the user it didn't save.
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save your currency preference.",
      );
    }
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCY_OPTIONS.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
