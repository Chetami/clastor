import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { UpdateTutorProfileRequest } from "@examify-tms/interfaces";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useGetTutorProfile } from "./api/use-get-tutor-profile";
import { useUpdateTutorProfile } from "./api/use-update-tutor-profile";
import {
  usePublishTutorProfile,
  useUnpublishTutorProfile,
} from "./api/use-publish-tutor-profile";
import { useCheckSlug } from "./api/use-check-slug";
import {
  EMPTY_TUTOR_PROFILE_FORM,
  tutorProfileFormSchema,
  type TutorProfileFormData,
} from "./tutor-profile-schema";

type FieldErrors = Partial<Record<keyof TutorProfileFormData, string>>;

export default function TutorProfileEditor() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useGetTutorProfile();
  const updateMutation = useUpdateTutorProfile();
  const publishMutation = usePublishTutorProfile();
  const unpublishMutation = useUnpublishTutorProfile();

  const [values, setValues] = useState<TutorProfileFormData>(
    EMPTY_TUTOR_PROFILE_FORM,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate the form once the existing profile loads.
  useEffect(() => {
    if (profile) {
      setValues({
        slug: profile.slug ?? "",
        template: profile.template ?? "classic",
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
        subjects: profile.subjects ?? [],
        qualifications: profile.qualifications ?? [],
        hourlyRate: profile.hourlyRate ?? null,
        currency: profile.currency ?? "USD",
        contactEmail: profile.contactEmail ?? "",
        ctaText: profile.ctaText ?? "",
      });
    }
  }, [profile]);

  const slugCheck = useCheckSlug(values.slug, profile?.slug);
  const isPublished = profile?.status === "published";

  const publicUrl = useMemo(
    () =>
      profile?.slug
        ? `${window.location.origin}/t/${profile.slug}`
        : null,
    [profile?.slug],
  );

  function update<K extends keyof TutorProfileFormData>(
    key: K,
    value: TutorProfileFormData[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError(null);
    setSavedMessage(null);
  }

  function updateListItem(
    key: "subjects" | "qualifications",
    index: number,
    value: string,
  ) {
    setValues((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }

  function addListItem(key: "subjects" | "qualifications") {
    setValues((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  }

  function removeListItem(key: "subjects" | "qualifications", index: number) {
    setValues((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  }

  function buildPayload(): UpdateTutorProfileRequest {
    const clean = (arr: string[]) =>
      arr.map((s) => s.trim()).filter((s) => s.length > 0);

    return {
      slug: values.slug.trim().toLowerCase(),
      template: values.template,
      headline: values.headline?.trim() || null,
      bio: values.bio?.trim() || null,
      subjects: clean(values.subjects),
      qualifications: clean(values.qualifications),
      hourlyRate: values.hourlyRate,
      currency: values.currency.trim() || "USD",
      contactEmail: values.contactEmail?.trim() || null,
      ctaText: values.ctaText?.trim() || null,
    };
  }

  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSavedMessage(null);

    const result = tutorProfileFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TutorProfileFormData;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    // Block save if the chosen slug belongs to someone else.
    if (slugCheck.data && !slugCheck.data.available) {
      setErrors({ slug: "That slug is already taken." });
      return;
    }

    try {
      await updateMutation.mutateAsync(buildPayload());
      setSavedMessage("Draft saved.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  async function handleTogglePublish() {
    setFormError(null);
    try {
      if (isPublished) {
        await unpublishMutation.mutateAsync();
      } else {
        await publishMutation.mutateAsync();
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to change status.",
      );
    }
  }

  async function copyUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Public profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Build your public-facing page, then publish it to get a shareable
          link. Your name and profile photo come from{" "}
          <Link
            to="/settings"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Settings
          </Link>
          .
        </p>
      </div>

      {isPublished && publicUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Your page is live</p>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {publicUrl}
                </a>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyUrl}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSaveDraft} className="space-y-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Page details</CardTitle>
            <CardDescription>
              The basics shown at the top of your public page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Page URL</Label>
              <div className="flex items-center rounded-md border border-input pr-3 focus-within:ring-1 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">
                  {window.location.origin}/t/
                </span>
                <Input
                  id="slug"
                  className="border-0 shadow-none focus-visible:ring-0"
                  placeholder="jane-math"
                  value={values.slug}
                  onChange={(e) => update("slug", e.target.value)}
                  aria-invalid={!!errors.slug}
                />
              </div>
              <SlugStatus slug={values.slug} slugCheck={slugCheck} />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="headline">
                Headline{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="headline"
                placeholder="Certified Math Tutor for Grades 6-12"
                value={values.headline}
                onChange={(e) => update("headline", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">
                About{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <textarea
                id="bio"
                rows={5}
                placeholder="Tell students and parents about your teaching style and experience..."
                value={values.bio}
                onChange={(e) => update("bio", e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subjects &amp; qualifications</CardTitle>
            <CardDescription>
              Lists shown on your public page. Leave blank to hide a section.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ListEditor
              label="Subjects"
              placeholder="e.g. Algebra"
              items={values.subjects}
              onAdd={() => addListItem("subjects")}
              onChange={(i, v) => updateListItem("subjects", i, v)}
              onRemove={(i) => removeListItem("subjects", i)}
            />
            <ListEditor
              label="Qualifications"
              placeholder="e.g. BSc Mathematics"
              items={values.qualifications}
              onAdd={() => addListItem("qualifications")}
              onChange={(i, v) => updateListItem("qualifications", i, v)}
              onRemove={(i) => removeListItem("qualifications", i)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing &amp; contact</CardTitle>
            <CardDescription>
              Optional. A contact button appears when you set an email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">
                  Hourly rate{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="45"
                  value={values.hourlyRate ?? ""}
                  onChange={(e) =>
                    update(
                      "hourlyRate",
                      e.target.value === "" ? null : e.target.valueAsNumber,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  placeholder="USD"
                  value={values.currency}
                  onChange={(e) => update("currency", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                Contact email{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder={user?.email ?? "you@example.com"}
                value={values.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                aria-invalid={!!errors.contactEmail}
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive">
                  {errors.contactEmail}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">
                Button text{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="ctaText"
                placeholder="Get in touch"
                value={values.ctaText}
                onChange={(e) => update("ctaText", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>
              More templates coming soon. For now there's one to choose from.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="template">Layout</Label>
              <select
                id="template"
                value={values.template}
                onChange={(e) =>
                  update("template", e.target.value as "classic")
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="classic">Classic</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {formError && (
          <p className="text-sm text-destructive">{formError}</p>
        )}
        {savedMessage && (
          <p className="text-sm text-primary">{savedMessage}</p>
        )}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant={isPublished ? "destructive" : "default"}
            disabled={
              publishMutation.isPending ||
              unpublishMutation.isPending ||
              !profile
            }
            onClick={handleTogglePublish}
          >
            {(publishMutation.isPending || unpublishMutation.isPending) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {isPublished ? "Unpublish" : "Publish"}
          </Button>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save draft
          </Button>
        </div>
      </form>
    </div>
  );
}

function SlugStatus({
  slug,
  slugCheck,
}: {
  slug: string;
  slugCheck: ReturnType<typeof useCheckSlug>;
}) {
  if (slug.trim().length === 0) return null;

  if (slugCheck.isFetching) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking…
      </p>
    );
  }
  if (slugCheck.data?.available) {
    return (
      <p className="flex items-center gap-1 text-xs text-primary">
        <Check className="size-3" /> Available
      </p>
    );
  }
  if (slugCheck.data && !slugCheck.data.available) {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <X className="size-3" /> That slug is taken or reserved.
      </p>
    );
  }
  return null;
}

function ListEditor({
  label,
  placeholder,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={placeholder}
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
      >
        <Plus className="size-4" />
        Add {label.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}
