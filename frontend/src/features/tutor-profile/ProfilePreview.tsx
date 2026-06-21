import type { UserInfo } from "@examify-tms/interfaces";
import { getTemplate } from "@/features/public-tutor/templates/registry";
import { buildPreviewProfile } from "./preview-utils";
import type { TutorProfileFormData } from "./tutor-profile-schema";

/**
 * Renders the real public template (chosen via the registry) using live form
 * data. The template component itself is untouched — this just feeds it.
 */
export function ProfilePreview({
  values,
  user,
}: {
  values: TutorProfileFormData;
  user: UserInfo | null | undefined;
}) {
  const profile = buildPreviewProfile(values, user);
  const Template = getTemplate(profile.template);
  return <Template profile={profile} />;
}
