import { useMemo, useState } from "react";
import type { UpdateTutorProfileRequest } from "@examify-tms/interfaces";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
