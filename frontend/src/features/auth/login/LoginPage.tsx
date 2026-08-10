import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLogin } from "@/features/auth/api";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";
import { BrandMark } from "@/features/auth/BrandMark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = useLogin();

  const authError = googleError ?? login.error?.message;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGoogleError(null);

    try {
      const data = await login.mutateAsync({ email, password });
      navigate(data.user.onboardingComplete ? "/dashboard" : "/onboarding");
    } catch {
      // error is surfaced via mutation state
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <BrandMark className="mb-2" />
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <GoogleSignInButton
              label="Continue with Google"
              onSuccess={(data) =>
                navigate(
                  data.user.onboardingComplete ? "/dashboard" : "/onboarding",
                )
              }
              onError={(error) =>
                setGoogleError(
                  error instanceof Error
                    ? error.message
                    : "Google sign-in failed. Please try again.",
                )
              }
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authError && (
                <Alert
                  variant="destructive"
                  className="flex items-start gap-2.5 [&>svg]:static [&>svg]:mt-0.5 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0"
                >
                  <CircleAlert className="h-4 w-4" />
                  <AlertDescription>{authError}</AlertDescription>
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

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={login.isPending} className="w-full">
                {login.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
