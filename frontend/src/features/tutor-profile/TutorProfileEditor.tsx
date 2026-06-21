import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Rocket,
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useGetTutorProfile } from "./api/use-get-tutor-profile";
import { useUpdateTutorProfile } from "./api/use-update-tutor-profile";
import {
  usePublishTutorProfile,
  useUnpublishTutorProfile,
} from "./api/use-publish-tutor-profile";
import { useCheckSlug } from "./api/use-check-slug";
import { ProfilePreview } from "./ProfilePreview";
import { TemplatePicker } from "./TemplatePicker";
import { profileResponseToValues } from "./preview-utils";
import {
  EMPTY_TUTOR_PROFILE_FORM,
  tutorProfileFormSchema,
  type TutorProfileFormData,
} from "./tutor-profile-schema";

type FieldErrors = Partial<Record<keyof TutorProfileFormData, string>>;
type View = "editor" | "preview";

const serialize = (v: TutorProfileFormData): string => JSON.stringify(v);

/**
 * Draft persistence. Unsaved edits are written to localStorage keyed per user,
 * so a refresh or accidental navigation doesn't lose work. The draft is
 * restored on first load (taking priority over the saved profile), and cleared
 * automatically once the form is no longer dirty (i.e. after a save/publish).
 */
function draftKey(uid: string | undefined): string | null {
  return uid ? `examify-tms:profile-draft:${uid}` : null;
}

function loadDraft(key: string | null): TutorProfileFormData | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Merge over the empty form so unknown/missing keys fall back to defaults
    // and a stale draft from an older schema can't break the editor.
    return { ...EMPTY_TUTOR_PROFILE_FORM, ...parsed };
  } catch {
    return null;
  }
}

function writeDraft(key: string | null, values: TutorProfileFormData) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Quota or private-mode errors are non-fatal — just skip persisting.
  }
}

function clearDraft(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export default function TutorProfileEditor() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useGetTutorProfile();
  const updateMutation = useUpdateTutorProfile();
  const publishMutation = usePublishTutorProfile();
  const unpublishMutation = useUnpublishTutorProfile();

  const storageKey = draftKey(user?.uid);
  const [values, setValues] = useState<TutorProfileFormData>(
    EMPTY_TUTOR_PROFILE_FORM,
  );
  const [view, setView] = useState<View>("editor");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Seed once: a stored draft wins over the saved profile so resumed edits come
  // back, otherwise fall back to whatever is on the server. After this one-time
  // seed we never overwrite `values` from the profile again — background
  // refetches must not clobber in-flight edits.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || isLoading) return;
    hydratedRef.current = true;
    setValues(loadDraft(storageKey) ?? profileResponseToValues(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, profile, storageKey]);

  const baseline = useMemo(
    () => profileResponseToValues(profile),
    [profile],
  );
  const isDirty = serialize(values) !== serialize(baseline);

  // Persist while there are unsaved changes; clear once we're back in sync with
  // the server (after save/publish/unpublish), so no stale draft lingers.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isDirty) writeDraft(storageKey, values);
    else clearDraft(storageKey);
  }, [values, isDirty, storageKey]);

  const slugCheck = useCheckSlug(values.slug, profile?.slug);
  const isPublished = profile?.status === "published";

  const previewUrl = useMemo(
    () =>
      `${window.location.origin}/t/${
        values.slug.trim().toLowerCase() || "your-slug"
      }`,
    [values.slug],
  );
  const liveUrl = profile?.slug
    ? `${window.location.origin}/t/${profile.slug}`
    : null;

  function update<K extends keyof TutorProfileFormData>(
    key: K,
    value: TutorProfileFormData[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError(null);
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

  function validate(): boolean {
    const result = tutorProfileFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TutorProfileFormData;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    return true;
  }

  function slugIsBlocked() {
    return Boolean(slugCheck.data && !slugCheck.data.available);
  }

  async function handleSave() {
    setFormError(null);
    if (!validate()) return;
    if (slugIsBlocked()) {
      setErrors({ slug: "That slug is already taken." });
      return;
    }
    try {
      const saved = await updateMutation.mutateAsync(buildPayload());
      setValues(profileResponseToValues(saved));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  // Publish always pushes current edits first, then flips live — no need to
  // save-then-publish or unpublish-then-republish.
  async function handlePublish() {
    setFormError(null);
    if (!validate()) return;
    if (slugIsBlocked()) {
      setErrors({ slug: "That slug is already taken." });
      return;
    }
    try {
      const saved = await updateMutation.mutateAsync(buildPayload());
      setValues(profileResponseToValues(saved));
      await publishMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to publish.");
    }
  }

  async function handleUnpublish() {
    setFormError(null);
    try {
      const updated = await unpublishMutation.mutateAsync();
      setValues(profileResponseToValues(updated));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to unpublish.",
      );
    }
  }

  const saving = updateMutation.isPending;
  const publishing = publishMutation.isPending;
  const busy = saving || publishing || unpublishMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top toolbar: title, editor/preview toggle, all actions. */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Public profile
            </h1>
            <StatusChip published={isPublished} />
          </div>

          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-9">
            {isPublished && (
              <Button
                type="button"
                variant="outline"
                onClick={handleUnpublish}
                disabled={busy}
              >
                <EyeOff className="size-4" />
                Unpublish
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDirty && (
              <span className="text-xs font-medium text-amber-600">
                Unsaved changes
              </span>
            )}
            {isPublished && liveUrl && (
              <Button asChild variant="outline">
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <Globe className="size-4" />
                  Go to website
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isPublished ? "Save changes" : "Save draft"}
            </Button>
            {!isPublished && (
              <Button
                type="button"
                onClick={handlePublish}
                disabled={busy}
              >
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Publish
              </Button>
            )}
          </div>
        </div>

        <p className="-mt-2 text-sm text-muted-foreground">
          Your name and photo come from{" "}
          <Link
            to="/settings"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Settings
          </Link>
          .
        </p>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>

      {/* Body: editor or preview, with a light fade between them. */}
      {view === "editor" ? (
        <div key="editor" className="animate-view-in space-y-4">
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
              <CardTitle>Template</CardTitle>
              <CardDescription>
                Choose how your public page looks. Switch any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker
                value={values.template}
                onChange={(v) => update("template", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subjects &amp; qualifications</CardTitle>
              <CardDescription>
                Lists shown on your public page. Leave blank to hide a section.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
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

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div
          key="preview"
          className="animate-view-in mx-auto max-w-4xl overflow-hidden rounded-xl border bg-muted/30 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2">
            <span className="size-2.5 rounded-full bg-destructive/40" />
            <span className="size-2.5 rounded-full bg-amber-500/50" />
            <span className="size-2.5 rounded-full bg-emerald-500/50" />
            <div className="ml-2 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
              {previewUrl}
            </div>
          </div>
          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto bg-background">
            <ProfilePreview values={values} user={user} />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const options: { value: View; label: string; icon: typeof Pencil }[] = [
    { value: "editor", label: "Editor", icon: Pencil },
    { value: "preview", label: "Preview", icon: Eye },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      {options.map((opt) => {
        const active = view === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusChip({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Draft
    </span>
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
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-4" />
        Add {label.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}
