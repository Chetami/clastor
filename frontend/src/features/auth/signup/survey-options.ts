import { Building2, Compass, GraduationCap, type LucideIcon } from "lucide-react";
import type {
  SurveyCurrentTool,
  SurveyIntent,
  SurveyTutorCountBucket,
  SurveyTutoringFormat,
} from "@examify-tms/shared";

export type IntentOption = {
  value: SurveyIntent;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

export const INTENT_OPTIONS: IntentOption[] = [
  {
    value: "independent_tutor",
    title: "I'm an independent tutor",
    subtitle: "Teaching my own students, one-on-one or in groups.",
    icon: GraduationCap,
  },
  {
    value: "small_business",
    title: "I run a tutoring organisation",
    subtitle: "Managing tutors, students, and the books.",
    icon: Building2,
  },
  {
    value: "exploring",
    title: "Just looking around",
    subtitle: "Curious whether Clastor fits my workflow.",
    icon: Compass,
  },
];

export const FORMAT_OPTIONS: { value: SurveyTutoringFormat; label: string }[] = [
  { value: "one_on_one", label: "One-on-one" },
  { value: "group", label: "Group classes" },
  { value: "both", label: "Both" },
];

export const TUTOR_COUNT_OPTIONS: {
  value: SurveyTutorCountBucket;
  label: string;
}[] = [
  { value: "1-5", label: "1–5" },
  { value: "6-10", label: "6–10" },
  { value: "11-20", label: "11–20" },
  { value: "21-50", label: "21–50" },
  { value: "50+", label: "50+" },
];

export const TOOL_OPTIONS: { value: SurveyCurrentTool; label: string }[] = [
  { value: "spreadsheets", label: "Spreadsheets" },
  { value: "paper", label: "Paper notebook" },
  { value: "google_calendar", label: "Google Calendar" },
  { value: "stripe", label: "Stripe" },
  { value: "another_app", label: "Another app" },
  { value: "nothing", label: "Nothing yet" },
];

export const STEPS = ["intent", "details", "reveal"] as const;
