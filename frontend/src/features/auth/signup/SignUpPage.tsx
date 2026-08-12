import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRegister } from "@/features/auth/api";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";
import { BrandMark } from "@/features/auth/BrandMark";
import { LEGAL_URLS } from "@/config";
import { track } from "@/lib/analytics";
import { loadSurvey, clearSurvey } from "./survey-storage";
import type { SignupSurvey } from "@examify-tms/interfaces";

/**
 * Strength levels indexed 0..4. Index 0 is the "too short" state shown when a
 * password exists but is below the create-account minimum (6 chars); 1..4 are
 * real strength bands. The scoring below is aligned with the submit gate so
 * the meter never contradicts the enforced minimum.
 */
const STRENGTH_LEVELS = [
  { label: "Too short", bar: "bg-red-500", text: "text-red-500" },
  { label: "Weak", bar: "bg-red-500", text: "text-red-500" },
  { label: "Fair", bar: "bg-orange-500", text: "text-orange-500" },
  { label: "Good", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

const PASSWORD_MIN = 6;

/** Returns -1 (empty), 0 (below min), or 1..4 (strength). */
function scorePassword(pw: string): number {
  if (!pw) return -1;
  if (pw.length < PASSWORD_MIN) return 0;
  let score = 1;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) =>
    r.test(pw),
  ).length;
  if (variety >= 3) score++;
  return Math.min(score, 4);
}

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [validationError, setValidationError] = useState("");
  const navigate = useNavigate();

  const register = useRegister();

  // Pre-signup survey answers captured on the qualifier flow (if any). Read
  // once on mount and forwarded to the register endpoint so they land on the
  // user document.
  const surveyRef = useRef<SignupSurvey | null>(loadSurvey());

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthLevel = strength >= 0 ? STRENGTH_LEVELS[strength] : null;
  const strengthBars = strength <= 0 ? 1 : strength;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError("");

    if (passwordsMismatch) {
      setValidationError("Passwords do not match");
      return;
    }

    if (password.length < PASSWORD_MIN) {
      setValidationError(`Password must be at least ${PASSWORD_MIN} characters`);
      return;
    }

    track("signup_submit", { method: "email" });
    try {
      const data = await register.mutateAsync({
        name,
        email,
        password,
        signupSurvey: surveyRef.current,
      });
      track("signup_success", { method: "email" });
      clearSurvey();
      navigate(data.user.onboardingComplete ? "/dashboard" : "/onboarding");
    } catch {
      // error is surfaced via mutation state
    }
  }

  const errorMessage = validationError || register.error?.message;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background p-4">
      <div className="absolute top-4 left-4">
        <BrandMark size={40} />
      </div>
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Enter your information to get started
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-xs leading-relaxed">
                I agree to the{" "}
                <a
                  href={LEGAL_URLS.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href={LEGAL_URLS.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </Label>
            </div>

            <GoogleSignInButton
              label="Sign up with Google"
              signupSurvey={surveyRef.current}
              disabled={!agreed}
              onSuccess={(data) => {
                track("signup_success", { method: "google" });
                clearSurvey();
                navigate(
                  data.user.onboardingComplete ? "/dashboard" : "/onboarding",
                );
              }}
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
              {errorMessage && (
                <Alert
                  variant="destructive"
                  className="flex items-start gap-2.5 [&>svg]:static [&>svg]:mt-0.5 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0"
                >
                  <CircleAlert className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {strengthLevel && (
                  <div className="pt-1">
                    <div className="flex gap-1">
                      {STRENGTH_LEVELS.map((level, i) => (
                        <div
                          key={level.label}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i < strengthBars ? strengthLevel.bar : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p
                      className={`mt-1 text-xs font-medium ${strengthLevel.text}`}
                    >
                      {strengthLevel.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {passwordsMismatch && (
                  <p className="text-xs text-destructive">
                    Passwords don&apos;t match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={
                  register.isPending || !agreed || passwordsMismatch
                }
                className="w-full"
              >
                {register.isPending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
