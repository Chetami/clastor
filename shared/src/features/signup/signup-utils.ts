import type { SignupSurvey } from "@examify-tms/interfaces";

/**
 * Pre-signup qualifier survey — pure helpers shared by the web + mobile
 * clients. The survey is captured on the landing flow (before account
 * creation) so the app can personalise onboarding and show a time-saved
 * estimate. Answers are forwarded to /api/auth/register and persisted on the
 * user document.
 */

export const SURVEY_INTENTS = [
  "independent_tutor",
  "small_business",
  "exploring",
] as const;

export const SURVEY_STUDENT_COUNT_BUCKETS = [
  "1-5",
  "6-15",
  "16-30",
  "30+",
  "1-15",
  "16-50",
  "51-100",
  "101-250",
  "250-500",
  "500+",
] as const;

export const SURVEY_TUTORING_FORMATS = [
  "one_on_one",
  "group",
  "both",
] as const;

export const SURVEY_TUTOR_COUNT_BUCKETS = [
  "1-5",
  "6-10",
  "11-20",
  "21-50",
  "50+",
] as const;

export const SURVEY_CURRENT_TOOLS = [
  "spreadsheets",
  "paper",
  "google_calendar",
  "stripe",
  "another_app",
  "nothing",
] as const;

export type SurveyIntent = (typeof SURVEY_INTENTS)[number];
export type SurveyStudentCountBucket =
  (typeof SURVEY_STUDENT_COUNT_BUCKETS)[number];
export type SurveyTutoringFormat = (typeof SURVEY_TUTORING_FORMATS)[number];
export type SurveyTutorCountBucket = (typeof SURVEY_TUTOR_COUNT_BUCKETS)[number];
export type SurveyCurrentTool = (typeof SURVEY_CURRENT_TOOLS)[number];

/**
 * Buckets shown for a given intent. Independent tutors (and explorers) see the
 * fine-grained 1–5 … 30+ set; organisations see the wider 1–15 … 500+ set
 * since they tend to have far more students.
 */
export const BUCKETS_BY_INTENT: Record<
  SurveyIntent,
  SurveyStudentCountBucket[]
> = {
  independent_tutor: ["1-5", "6-15", "16-30", "30+"],
  small_business: [
    "1-15",
    "16-50",
    "51-100",
    "101-250",
    "250-500",
    "500+",
  ],
  exploring: ["1-5", "6-15", "16-30", "30+"],
};

/**
 * Whether the given intent should be treated as an organisation in survey
 * copy (uses "organisation" instead of "tutor", wider student buckets, etc).
 */
export function isOrgIntent(intent: SurveyIntent | null): boolean {
  return intent === "small_business";
}

/** The survey answers as gathered by the qualifier flow. */
export type SurveyAnswers = {
  intent: SurveyIntent | null;
  studentCountBucket: SurveyStudentCountBucket | null;
  tutoringFormat: SurveyTutoringFormat | null;
  tutorCountBucket: SurveyTutorCountBucket | null;
  currentTools: SurveyCurrentTool[];
};

export const EMPTY_SURVEY: SurveyAnswers = {
  intent: null,
  studentCountBucket: null,
  tutoringFormat: null,
  tutorCountBucket: null,
  currentTools: [],
};

/** True when at least one survey field has been answered. */
export function hasSurveyAnswers(a: SurveyAnswers): boolean {
  return (
    a.intent !== null ||
    a.studentCountBucket !== null ||
    a.tutoringFormat !== null ||
    a.tutorCountBucket !== null ||
    a.currentTools.length > 0
  );
}

/** Coerce SurveyAnswers into the nullable SignupSurvey shape stored on the user. */
export function toSignupSurvey(a: SurveyAnswers): SignupSurvey {
  if (!hasSurveyAnswers(a)) return null;
  return {
    intent: a.intent,
    studentCountBucket: a.studentCountBucket,
    tutoringFormat: a.tutoringFormat,
    tutorCountBucket: a.tutorCountBucket,
    currentTools: a.currentTools,
  };
}

/**
 * Rough midpoint of each student-count bucket. Used to turn a coarse bucket
 * into a single representative number for the time-saved estimate.
 */
const BUCKET_MIDPOINT: Record<SurveyStudentCountBucket, number> = {
  "1-5": 3,
  "6-15": 10,
  "16-30": 23,
  "30+": 40,
  "1-15": 8,
  "16-50": 33,
  "51-100": 75,
  "101-250": 175,
  "250-500": 375,
  "500+": 600,
};

/**
 * Minutes of admin work Clastor removes per student per week — broken down so
 * the reveal screen can itemise the saving. These are conservative estimates
 * (scheduling back-and-forth, manual invoicing, reminder chasing) drawn from
 * typical independent-tutor workloads. Group tutors with more students scale
 * these up a touch.
 */
const MINUTES_PER_STUDENT = {
  scheduling: 4,
  invoicing: 5,
  reminders: 3,
};

/**
 * Estimate weekly hours saved by switching to Clastor, given a student-count
 * bucket and (optionally) the tutoring format. Returns hours rounded to one
 * decimal plus a per-category minute breakdown so the UI can itemise it.
 *
 * The estimate is intentionally simple and transparent — it's a marketing
 * signal, not a promise. Group/both tutors get a 1.3x multiplier since
 * coordinating multiple students per session adds scheduling overhead.
 */
export function estimateTimeSaved(
  bucket: SurveyStudentCountBucket | null,
  format: SurveyTutoringFormat | null = null,
): {
  hoursPerWeek: number;
  minutesPerWeek: number;
  breakdown: { scheduling: number; invoicing: number; reminders: number };
} {
  const students = bucket ? BUCKET_MIDPOINT[bucket] : 3;
  const multiplier = format === "group" || format === "both" ? 1.3 : 1;

  const scheduling = Math.round(
    MINUTES_PER_STUDENT.scheduling * students * multiplier,
  );
  const invoicing = Math.round(
    MINUTES_PER_STUDENT.invoicing * students * multiplier,
  );
  const reminders = Math.round(
    MINUTES_PER_STUDENT.reminders * students * multiplier,
  );

  const minutesPerWeek = scheduling + invoicing + reminders;
  const hoursPerWeek = Math.round((minutesPerWeek / 60) * 10) / 10;

  return {
    hoursPerWeek,
    minutesPerWeek,
    breakdown: { scheduling, invoicing, reminders },
  };
}
