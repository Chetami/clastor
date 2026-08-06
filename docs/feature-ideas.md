# Frontend Feature Ideas

**Date:** 2026-08-07
**Status:** Brainstorm / backlog candidates
**Scope:** Web frontend (most apply to mobile too)

This document collects feature ideas for the Clastor Tutor Management System
frontend, based on a review of what is currently built. The existing surface
covers: auth & onboarding, dashboard (tutor + admin), students (list/detail),
schedule (calendar + working hours), lessons (list/detail/series), payments
(invoices — create/edit/detail + Stripe), templates, sent-emails, public
booking, public tutor profile, feedback, admin tutors, settings, and account.

Ideas are grouped by theme and tagged with rough effort (S/M/L) and impact.

---

## 1. Lesson Notes & Progress Tracking  [impact: high] [effort: M]

Tutors churn off spreadsheets for one reason: tracking learning progress. Right
now a lesson has attendance and a meet link but no structured record of what was
covered or how the student is doing.

- **Per-lesson notes** — freeform + structured fields (topics covered, strengths,
  areas to improve, homework set).
- **Learning objectives / goals per student** — set targets, mark progress.
- **Assessment scores** — record test/quiz results over time, plot a trend.
- **Progress reports** — auto-generate a term/period summary, export to PDF,
  optionally share with student or parent.

Touches: `lessons`, `students`, new `progress` feature. Backend needs new
collections (lessonNotes, goals, assessments).

---

## 2. Homework & Assignments  [impact: high] [effort: M]

Natural extension of lessons once notes exist.

- **Assign tasks** linked to a lesson or student (due date, description,
  attachments).
- **Submission & completion tracking** — student/parent marks done; tutor grades.
- **Reminders** for overdue homework.

Pairs with a resource library (see #3).

---

## 3. Resource / Materials Library  [impact: medium] [effort: M]

Central place to store and share teaching materials.

- **Document storage** — PDFs, worksheets, images, links (Cloud Storage for
  Firebase).
- **Per-student or per-subject organization.**
- **Shareable links** given to student/parent (time-limited, signed URLs).

---

## 4. Parent / Guardian Portal  [impact: high] [effort: L]

Most tutors teach minors; parents are the paying decision-makers.

- **Read-only view** of their child's upcoming lessons, progress, attendance.
- **Invoice payment** — parents pay invoices directly (reuses Stripe + `pay/*`).
- **Booking** — request/reschedule sessions (reuses public-booking flow).
- **Messaging** with the tutor (see #6).

This is the biggest market expansion (K-12 tutoring) and reuses a lot of existing
infra: auth, payments, and student data already exist. Main new work is a
distinct role + portal surface.

---

## 5. Group Lessons / Classes  [impact: high] [effort: L]

Current data model is 1-on-1. Cohort sessions unlock test-prep, music, and
language markets.

- **Class event type** with multiple enrolled students.
- **Roster / enrollment management.**
- **Per-seat pricing** and capacity limits.
- **Attendance** for all enrollees at once.

Significant schema change (event ↔ student becomes many-to-many) — schedule,
payments, and students all need updates.

---

## 6. In-App Messaging  [impact: medium] [effort: M]

Current communication is one-way (emails). Two-way chat between tutor and
student/parent reduces context-switching.

- **Threads per student/parent.**
- **Real-time** (Firestore onSnapshot) or polling.
- **Message templates** integration (reuse existing templates feature).

---

## 7. SMS / Push Reminders  [impact: high] [effort: S]

Email reminders exist; SMS cuts no-shows further. Push for the mobile app.

- **SMS via Twilio** for lesson reminders, invoice due dates.
- **Configurable lead times** in account settings.
- **Mobile push notifications** (Expo notifications) for new messages, bookings,
  payments.

---

## 8. Automated Reviews / Testimonials  [impact: medium] [effort: S]

Drives the `publicProfile` acquisition funnel.

- After N completed lessons, prompt the student/parent to leave a public review.
- **Reviews displayed on the public tutor page** (`/t/:slug`).
- **Moderation** by the tutor before publishing.

---

## 9. Calendar Sync (Google / Outlook / iCal)  [impact: high] [effort: M]

Most-requested integration. Tutors want lessons in their personal calendar.

- **iCal feed** (read-only, cheapest) — subscribe URL per tutor.
- **Google Calendar two-way sync** — OAuth, create/update/delete events.
- **Outlook** via Microsoft Graph.
- Sync availability back (free/busy) to prevent double-booking.

Builds on existing `schedule` + `working-hours`.

---

## 10. Scheduling Rules: Buffers, Blackouts, Waitlists  [impact: medium] [effort: M]

Working hours exist, but real scheduling needs more control.

- **Buffer times** between lessons (travel, prep).
- **Blackout dates** (holidays, vacation).
- **Waitlists** for full slots — auto-notify on cancellation.
- **Booking lead time** (min notice) and **cancellation policy windows** with
  optional fees.

---

## 11. Recurring Billing / Subscriptions  [impact: high] [effort: M]

Auto-charge monthly packages instead of per-invoice manual work.

- **Package plans** (e.g., 4 lessons/month).
- **Stripe billing subscriptions** (Stripe integration already exists).
- **Proration** when plans change mid-cycle.
- **Auto-renewal + cancellation flows.**

---

## 12. Coupons, Discounts & Payment Plans  [impact: medium] [effort: S]

Invoicing flexibility.

- **Discount codes / percent-off** on invoices.
- **Multi-line discounts.**
- **Installment plans** — split an invoice into scheduled partial payments.

---

## 13. Expense Tracking & Tax Reports  [impact: medium] [effort: M]

Tutors are solopreneurs who need bookkeeping.

- **Log expenses** (category, amount, date, receipt upload).
- **Mileage tracking** (mobile-friendly).
- **Year-end tax summary** — revenue vs. expenses, exportable.
- **CSV/Excel export** for accountants.

---

## 14. Reporting & Analytics Dashboard  [impact: high] [effort: M]

Current dashboard is summary-only. Deeper insights drive retention.

- **Revenue trends** over time (weekly/monthly/yearly).
- **Hours taught, attendance rate, utilization** of available slots.
- **Student retention / churn** metrics.
- **Top subjects, best-performing times.**
- **Export** to CSV/PDF.

---

## 15. Referral Program  [impact: low] [effort: S]

Growth lever.

- **Referral codes** per tutor.
- **Credit rewards** for successful referrals (discount on subscription).
- **Tracking dashboard** for referred signups.

---

## 16. Multi-Tutor / Agency Mode  [impact: medium] [effort: L]

For a solo tutor who grows into a small agency.

- **Manage multiple tutors** under one account.
- **Revenue sharing / commission splits.**
- **Shared student pool** or per-tutor assignment.
- **Agency-level reporting.**

This is a large undertaking and may warrant a separate product tier.

---

## 17. Platform & Polish  [impact: varies] [effort: S]

- **Dark mode** — the design system conceptually supports it; wire up the theme
  toggle across components.
- **Data export & GDPR tooling** — export all student/invoice data; delete
  account / right-to-be-forgotten flow.
- **Keyboard shortcuts** — power-user navigation in schedule and lessons.
- **Offline support (mobile)** — cache schedule/student data for viewing without
  a connection.

---

## Recommended Build Order

Prioritized by impact-to-effort ratio and how much existing infrastructure they
reuse:

| # | Feature                          | Why now                                                                |
|---|----------------------------------|------------------------------------------------------------------------|
| 1 | **Lesson notes + progress** (#1) | Highest stickiness; directly extends `lessons` + `students`.           |
| 2 | **Calendar sync** (#9)           | Most-requested integration; `schedule` foundation is ready.            |
| 3 | **Parent portal** (#4)           | Biggest market expansion; reuses auth, payments, student data.         |
| 4 | **SMS / push reminders** (#7)    | Cheap, high ROI on no-show reduction; email infra exists.              |
| 5 | **Reporting dashboard** (#14)    | Data already flows in; surfacing trends is low-risk, high-perceived value. |

Features like group lessons (#5) and agency mode (#16) are strategic but large —
they belong on a later roadmap once the core 1-on-1 workflow is deeply
differentiated.

---

## Open Questions

- Is the Firestore data model ready for parent/guardian as a distinct role, or
  should they share the student document?
- Does Stripe billing need to move from one-off PaymentIntents to the
  Subscriptions API for #11?
- Should messaging (#6) be Firestore-native or a third-party service
  (e.g., Sendbird)?
