import type { ComponentType } from "react";
import type {
  PublicTutorProfileResponse,
  TutorTemplate,
} from "@examify-tms/interfaces";
import { ClassicTemplate } from "./ClassicTemplate";

/**
 * Template registry — the seam for future templates.
 * Add a new key here and ship its component to make a template selectable.
 */
export const templateRegistry: Record<
  TutorTemplate,
  ComponentType<{ profile: PublicTutorProfileResponse }>
> = {
  classic: ClassicTemplate,
};

export function getTemplate(template: TutorTemplate | undefined) {
  if (template && templateRegistry[template]) {
    return templateRegistry[template];
  }
  return templateRegistry.classic;
}
