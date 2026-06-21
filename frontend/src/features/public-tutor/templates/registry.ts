import type { ComponentType } from "react";
import type {
  PublicTutorProfileResponse,
  TutorTemplate,
} from "@examify-tms/interfaces";
import { ClassicTemplate } from "./ClassicTemplate";
import { ModernTemplate } from "./ModernTemplate";
import { ClassicThumb, ModernThumb } from "./thumbnails";

export interface TemplateDefinition {
  /** Human-readable name shown in the picker. */
  label: string;
  /** One-line blurb under the label in the picker. */
  description: string;
  /** Decorative layout sketch for the picker card. */
  Thumbnail: ComponentType;
  /** The full layout rendered on the live page + editor preview. */
  Component: ComponentType<{ profile: PublicTutorProfileResponse }>;
}

/**
 * Template registry — THE single source of truth.
 *
 * To add a template:
 *   1. Add its id to the `TutorTemplate` enum in
 *      `interfaces/src/schemas/tutors/TutorTemplate.yaml` and rebuild types.
 *   2. Create the layout component (+ a thumbnail sketch).
 *   3. Add one entry here.
 *
 * That's it — the zod schema, the picker, and the lookup all derive from this
 * object. The `satisfies Record<TutorTemplate, TemplateDefinition>` makes a
 * missing entry a compile error, so the type system keeps everything in sync.
 */
export const TEMPLATES = {
  classic: {
    label: "Classic",
    description: "Centered, traditional single-column layout.",
    Thumbnail: ClassicThumb,
    Component: ClassicTemplate,
  },
  modern: {
    label: "Modern",
    description: "Bold split hero with a colored side panel.",
    Thumbnail: ModernThumb,
    Component: ModernTemplate,
  },
} as const satisfies Record<TutorTemplate, TemplateDefinition>;

export type TemplateId = keyof typeof TEMPLATES;

/** Ordered list of template ids, for iterating in the picker. */
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/** The id used when a profile has no (or unknown) template. */
export const DEFAULT_TEMPLATE_ID: TemplateId = "classic";

/** Resolve a layout component by id, falling back to the default. */
export function getTemplate(
  id: string | undefined,
): TemplateDefinition["Component"] {
  if (id && id in TEMPLATES) {
    return TEMPLATES[id as TemplateId].Component;
  }
  return TEMPLATES[DEFAULT_TEMPLATE_ID].Component;
}
