import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { forgotPasswordRequest } from "@examify-tms/shared";
import { BrandMark } from "@/features/auth/BrandMark";

/**
 * Public "forgot password" page. Calls the backend endpoint, which sends a
 * branded reset email via the Admin SDK + SMTP. The response is identical
 * whether or not the account exists (no enumeration), so this page always
 * shows the same generic confirmation after submit.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const requestReset = useMutation({
    mutationFn: () => forgotPasswordRequest(email.trim()),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    requestReset.mutate();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background p-4">
      <div className="absolute top-4 left-4">
        <BrandMark size={40} />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>

        <CardContent>
          {requestReset.isSuccess ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium">{email.trim()}</span>, a reset
                  link is on its way. The link expires in 1 hour.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {requestReset.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {requestReset.error instanceof Error
                      ? requestReset.error.message
                      : "Something went wrong. Please try again."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={requestReset.isPending}
                className="w-full"
              >
                {requestReset.isPending ? "Sending..." : "Send reset link"}
              </Button>

              <Button variant="ghost" className="w-full" asChild>
                <Link to="/login">Back to sign in</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
