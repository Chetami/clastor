import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CreditCard, Loader2, Palette, Upload } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { uploadAvatarRequest, updateUserCurrencyRequest } from "./api/requests";
import { COLOR_SCHEMES, useTheme } from "@/hooks/use-theme";

/** Currencies a tutor can charge in (mirrors the backend SUPPORTED_CURRENCIES). */
const CURRENCY_OPTIONS = [
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "AED", label: "AED — UAE Dirham" },
];

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement>(null);

  const { colorScheme, setColorScheme } = useTheme();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const currentCurrency = user?.currency ?? "AUD";
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  const displayName = user?.name ?? user?.email ?? "User";
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";
  const currentAvatar = previewUrl ?? user?.avatarUrl ?? null;

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Optimistic local preview before the upload resolves.
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setIsUploading(true);

    try {
      const updated = await uploadAvatarRequest(file);
      setUser(updated);
      setPreviewUrl(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload image",
      );
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset so selecting the same file again still fires onChange.
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleCurrencyChange(code: string) {
    setCurrencyError(null);
    setIsSavingCurrency(true);
    try {
      const updated = await updateUserCurrencyRequest(code);
      setUser(updated);
    } catch (err) {
      setCurrencyError(
        err instanceof Error ? err.message : "Failed to update currency",
      );
    } finally {
      setIsSavingCurrency(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="size-24 shrink-0 rounded-full">
            {currentAvatar && (
              <AvatarImage src={currentAvatar} alt={displayName} />
            )}
            <AvatarFallback className="rounded-full text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {isUploading ? "Uploading..." : "Change photo"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              PNG or JPG, up to 5 MB. Images are resized to a square thumbnail.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose a colour scheme. Each tints the background and pairs a primary
            with a complementary accent. Your light or dark preference still
            applies on top.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_SCHEMES.map((scheme) => {
            const selected = scheme.value === colorScheme;
            return (
              <button
                key={scheme.value}
                type="button"
                onClick={() => setColorScheme(scheme.value)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors hover:bg-accent ${
                  selected ? "border-primary" : "border-transparent bg-muted/40"
                }`}
              >
                <span className="flex -space-x-2">
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.swatch }}
                  />
                  {scheme.secondary && (
                    <span
                      className="size-7 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: scheme.secondary }}
                    />
                  )}
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.accent }}
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {scheme.label}
                  </span>
                  <span
                    className={`text-xs leading-tight ${
                      selected ? "text-muted-foreground" : "text-transparent"
                    }`}
                  >
                    Active
                  </span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            The currency you charge in. Used across your dashboard, invoices,
            emails and public profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Select
            value={currentCurrency}
            disabled={isSavingCurrency}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger className="w-full sm:w-72">
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
          {currencyError && (
            <p className="text-sm text-destructive">{currencyError}</p>
          )}
        </CardContent>
      </Card>

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
