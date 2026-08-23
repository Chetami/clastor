import type { UserInfo } from "@examify-tms/interfaces";
import { TutorProfileLayout } from "@/features/public-tutor/TutorProfileLayout";
import { buildPreviewProfile } from "./preview-utils";
import type { TutorProfileFormData } from "./tutor-profile-schema";

/**
 * Renders the real public page layout using live form data, so the editor
 * preview faithfully mirrors the published page without anything being live.
 */
export function ProfilePreview({
  values,
  user,
}: {
  values: TutorProfileFormData;
  user: UserInfo | null | undefined;
}) {
  const profile = buildPreviewProfile(values, user);
  return <TutorProfileLayout profile={profile} />;
}
