import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const eventFormSchema = z
  .object({
    studentId: z.string().min(1, "Select a student"),
    studentName: z.string().min(1),
    subject: z.string().min(1, "Subject is required").trim(),
    date: z.string().regex(dateRegex, "Enter a valid date"),
    startTime: z.string().regex(timeRegex, "Enter a valid start time"),
    endTime: z.string().regex(timeRegex, "Enter a valid end time"),
    location: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
  });

export type EventFormData = z.infer<typeof eventFormSchema>;
