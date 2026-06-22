import { Link } from "react-router-dom";
import { ChevronRight, CreditCard, Palette } from "lucide-react";

import { CurrencySelect } from "@/components/account/CurrencySelect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COLOR_SCHEMES, useTheme } from "@/hooks/use-theme";
import { GoogleConnectionCard } from "./GoogleConnectionCard";

export default function Settings() {
  const { colorScheme, setColorScheme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
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
        <CardContent>
          <CurrencySelect className="w-full sm:w-72" />
        </CardContent>
      </Card>

      <GoogleConnectionCard />

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
