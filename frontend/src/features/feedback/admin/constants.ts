import { Bug, Lightbulb, MessageSquare } from "lucide-react";
import type { FeedbackResponse, FeedbackType } from "@examify-tms/interfaces";

export type StatusFilter = "all" | "open" | "resolved";
export type TypeFilter = "all" | FeedbackType;

export const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bug", label: "Bugs" },
  { value: "feedback", label: "Feedback" },
  { value: "feature_request", label: "Ideas" },
];

export const TYPE_META: Record<
  FeedbackType,
  { label: string; variant: "danger" | "secondary" | "warning"; icon: typeof Bug }
> = {
  bug: { label: "Bug", variant: "danger", icon: Bug },
  feedback: { label: "Feedback", variant: "secondary", icon: MessageSquare },
  feature_request: {
    label: "Feature Idea",
    variant: "warning",
    icon: Lightbulb,
  },
};

export const STATUS_META: Record<
  FeedbackResponse["status"],
  { label: string; variant: "warning" | "success" }
> = {
  open: { label: "Open", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
};
