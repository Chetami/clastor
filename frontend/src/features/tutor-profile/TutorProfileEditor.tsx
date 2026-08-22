import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, X } from "lucide-react";
import { formatWorkingHours } from "@examify-tms/shared";
import type { UpdateTutorProfileRequest } from "@examify-tms/interfaces";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/skeletons";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { publicSiteUrl } from "@/config/site";
import { SubjectMultiSelect } from "@/components/subjects/SubjectMultiSelect";
import { useGetTutorProfile } from "./api/use-get-tutor-profile";
import { useUpdateTutorProfile } from "./api/use-update-tutor-profile";
import {
  usePublishTutorProfile,
  useUnpublishTutorProfile,
} from "./api/use-publish-tutor-profile";
import { useCheckSlug } from "./api/use-check-slug";
import { ProfilePreview } from "./ProfilePreview";
import { TemplatePicker } from "./TemplatePicker";
import { ReviewsModerationCard } from "./ReviewsModerationCard";
import { profileResponseToValues } from "./preview-utils";
import {
  tutorProfileFormSchema,
  type TutorProfileFormData,
} from "./tutor-profile-schema";
import { useProfileDraft } from "./editor/useProfileDraft";
import { ProfileEditorToolbar } from "./editor/ProfileEditorToolbar";
import { ListEditor, SlugStatus, type View } from "./editor/components";

type FieldErrors = Partial<Record<keyof TutorProfileFormData, string>>;

/**
 * Public-profile editor. The localStorage draft persistence lives in
 * {@link useProfileDraft}; the toolbar and small UI helpers are extracted into
 * `./editor/`. This component owns the form state mutations + validation +
 * save/publish/unpublish.
 */
export default function TutorProfileEditor() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useGetTutorProfile();
  const updateMutation = useUpdateTutorProfile();
  const publishMutation = usePublishTutorProfile();
  const unpublishMutation = useUnpublishTutorProfile();

  const baseline = useMemo(
    () => profileResponseToValues(profile),
    [profile],
  );
  const { values, setValues, isDirty } = useProfileDraft(
    user?.uid,
    baseline,
    isLoading,
  );

  const [view, setView] = useState<View>("editor");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const slugCheck = useCheckSlug(values.slug, profile?.slug);
  const isPublished = profile?.status === "published";
  const availabilityLines = formatWorkingHours(user?.workingHours);

  const catalogueIds = useMemo(
    () => new Set((user?.subjects ?? []).map((s) => s.id)),
    [user?.subjects],
  );
  const legacyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of profile?.subjects ?? []) {
      if (subject.id.startsWith("legacy:")) map.set(subject.id, subject.name);
    }
    return map;
  }, [profile?.subjects]);
  const legacySelected = values.subjectIds.filter(
    (id) => !catalogueIds.has(id),
  );

  // Shareable URL points at the public site (root domain) in production;
  // falls back to this origin in local dev.
  const previewUrl = useMemo(
    () =>
      publicSiteUrl(
        `/t/${values.slug.trim().toLowerCase() || "your-slug"}`,
      ),
    [values.slug],
  );
  const liveUrl = profile?.slug
    ? publicSiteUrl(`/t/${profile.slug}`)
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
    key: "qualifications",
    index: number,
    value: string,
  ) {
    setValues((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }

  function addListItem(key: "qualifications") {
    setValues((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  }

  function removeListItem(key: "qualifications", index: number) {
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
      subjectIds: values.subjectIds,
      qualifications: clean(values.qualifications),
      hourlyRate: values.hourlyRate,
      location: values.location?.trim() || null,
      teachesOnline: values.teachesOnline,
      yearsExperience: values.yearsExperience,
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
    // While a new check is in flight `slugCheck.data` still holds the
    // previous slug's (likely "available") result — block on it too.
    if (slugCheck.isFetching) return true;
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

  // Publish always pushes current edits first, then flips live.
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
      setFormError(err instanceof Error ? err.message : "Failed to unpublish.");
    }
  }

  const saving = updateMutation.isPending;
  const publishing = publishMutation.isPending;
  const busy = saving || publishing || unpublishMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="space-y-4">
          <SkeletonCard titleWidth="w-28" lines={4} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonCard titleWidth="w-24" lines={3} />
            <SkeletonCard titleWidth="w-32" lines={3} />
          </div>
          <SkeletonCard titleWidth="w-24" lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileEditorToolbar
        isPublished={isPublished}
        isDirty={isDirty}
        liveUrl={liveUrl}
        view={view}
        saving={saving}
        publishing={publishing}
        busy={busy}
        formError={formError}
        onViewChange={setView}
        onUnpublish={handleUnpublish}
        onSave={handleSave}
        onPublish={handlePublish}
      />

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
                <Textarea
                  id="bio"
                  rows={5}
                  placeholder="Tell students and parents about your teaching style and experience..."
                  value={values.bio}
                  onChange={(e) => update("bio", e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">
                    Location{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="location"
                    placeholder="Sydney, NSW"
                    maxLength={80}
                    value={values.location}
                    onChange={(e) => update("location", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Where you teach in person.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">
                    Years of experience{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    max="60"
                    placeholder="8"
                    value={values.yearsExperience ?? ""}
                    onChange={(e) =>
                      update(
                        "yearsExperience",
                        e.target.value === "" ? null : e.target.valueAsNumber,
                      )
                    }
                    aria-invalid={!!errors.yearsExperience}
                  />
                  {errors.yearsExperience && (
                    <p className="text-xs text-destructive">
                      {errors.yearsExperience}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <Label
                      htmlFor="teachesOnline"
                      className="text-sm font-medium"
                    >
                      Teaches online
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show an "online lessons" badge on your page and in the
                      tutor directory.
                    </p>
                  </div>
                </div>
                <Switch
                  id="teachesOnline"
                  checked={values.teachesOnline}
                  onCheckedChange={(v) => update("teachesOnline", v)}
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
                Subjects come straight from your subject catalogue — pick the
                ones to showcase. Leave blank to hide a section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Subjects you teach</Label>
                <SubjectMultiSelect
                  value={values.subjectIds}
                  onChange={(ids) => update("subjectIds", ids)}
                />
                {legacySelected.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Also shown on your page (added before the catalogue):
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {legacySelected.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() =>
                              update(
                                "subjectIds",
                                values.subjectIds.filter((v) => v !== id),
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted/40 px-3 py-1 text-sm hover:bg-muted"
                          >
                            {legacyNameById.get(id) ?? id.replace(/^legacy:/, "")}
                            <X className="size-3.5 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Renaming or recolouring a subject in{" "}
                  <Link
                    to="/settings"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Settings
                  </Link>{" "}
                  updates your public page automatically.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Availability</Label>
                {availabilityLines.length > 0 ? (
                  <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {availabilityLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No weekly availability yet.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Pulled from your{" "}
                  <Link
                    to="/settings"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    working hours in Settings
                  </Link>
                  .
                </p>
              </div>

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
              <CardTitle>Reviews</CardTitle>
              <CardDescription>
                Reviews submitted from your public page appear here first.
                Approve the ones you want shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewsModerationCard />
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
                <p className="text-xs text-muted-foreground">
                  Shown in your currency, which you can change in Settings.
                </p>
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
