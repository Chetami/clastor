# Lesson Notes & Progress — Idea Exploration

**Date:** 2026-08-07
**Status:** Brainstorm (pre-spec)
**Feature ref:** `docs/feature-ideas.md` §1

## What exists today

Before adding anything, here's the relevant existing model (so we extend, not
duplicate):

- **`Lesson.notes`** — a single freeform nullable string. No structure, no
  history, no rich text.
- **`Lesson.todos[]`** — `LessonTodo { id, text, done }`. A flat checklist per
  lesson. Already used in the lesson detail UI.
- **`Lesson.attendanceStatus`** — rich enum (`present`, `present_late`,
  `absent_makeup_issued`, …). This is already rich progress-adjacent signal.
- **`Lesson.subject`** — freeform string per lesson.
- **`Student.notes`** — a single freeform nullable string. No progress, goals, or
  history.
- **`Student.subjectIds`** — links to the tutor's subject catalogue.
- **`LessonSeries.notes`** — shared freeform notes across occurrences.

Gap: notes are unstructured and ephemeral; there is zero longitudinal progress
data (goals, assessments, skill mastery, trends).

---

## Part A — Lesson Notes ideas

### A1. Structured note fields (beyond freeform)

Replace the single `notes` blob with a small set of optional structured fields
that tutors actually fill in after a session. Each stays optional so it's never
a chore:

| Field | Purpose |
|-------|---------|
| `topicsCovered` | What was taught this session |
| `strengths` | What the student did well |
| `areasToImprove` | Weak spots / misconceptions |
| `homeworkSet` | Tasks assigned for next time |
| `planForNext` | What to cover next lesson |

Plus keep the existing freeform `notes` for anything that doesn't fit. This
makes notes queryable and enables auto-summarizing progress (Part B).

### A2. Rich text / markdown editor

Upgrade the freeform note from a plain `<textarea>` to a lightweight markdown
editor (bold, lists, headings, code for STEM tutors). Consider:
- `react-quill` or a Tiptap-based editor.
- Keep the stored value as markdown so it exports cleanly and is portable.

### A3. Note carry-forward ("continue from last lesson")

When opening a new lesson for a student, offer "Carry forward" — pre-populate
`planForNext` from the previous lesson, and surface any unfinished `todos` as
suggested items. This is the single biggest time-saver and the thing tutors do
manually today.

### A4. Note templates

Reuse the existing **templates** feature to define lesson-note templates
("Initial assessment", "Exam prep review", "Weekly catch-up"). Selecting a
template pre-fills the structured fields with prompts. Keeps consistency across
students.

### A5. Shareable vs private notes

Split each note into:
- **Tutor-private notes** (default) — never leaves the tutor's view.
- **Student/parent-visible summary** — a curated blurb that can be emailed
  (reuses the notify-student / email infra) or shown in a future portal.

This matters for honesty: tutors want a private "struggling, may need to
repeat" note they won't put in front of a parent.

### A6. Attachments

Attach files to a lesson note — worksheets used, photos of the student's work,
scanned solutions. Uses Cloud Storage for Firebase with signed URLs. Pairs with
the future Resource Library idea.

### A7. Lesson log / history

Right now editing `notes` overwrites silently. Add lightweight version history
(keep last N revisions with timestamp + author) so a tutor can see what they
wrote last week vs. what they amended.

### A8. Tags on lessons/notes

Free tagging (e.g. "exam", "revision", "parent concern") to filter the lessons
list and to slice progress reports later.

---

## Part B — Progress Tracking ideas (the bigger prize)

This is the sticky, defensible feature. Ideas ordered roughly foundational →
aspirational.

### B1. Learning goals per student

A `goals` collection (or subcollection under the student):
```
Goal { id, studentId, subjectId, title, description,
       status: not_started | in_progress | achieved | paused,
       targetDate?, createdAt, updatedAt, achievedAt? }
```
Surfaced on the student detail page as a kanban-ish list. Achieved goals
become a record of accomplishments for progress reports.

### B2. Skill / topic mastery rubric

The highest-value progress artifact. Define a per-subject set of skills/topics
(e.g. "Algebra → simultaneous equations"). Track a mastery level per
(student, skill):
```
SkillMastery { studentId, subjectId, skillId,
               level: not_started | developing | proficient | mastered,
               lastAssessedAt, note? }
```
Render as a color-coded grid (skills down the side, mastery as a heatmap) on
the student detail page. Tutors update levels right after a lesson. This grid
is the thing parents instantly "get."

Open question: who defines the skill list? Options:
- Tutor-defined per subject (flexible, more setup).
- Pre-built curricula per subject/level (default-on, less flexible). Suggest
  starting tutor-defined, add curated libraries later.

### B3. Assessment scores over time

Record test/quiz/exam results:
```
Assessment { id, studentId, subjectId, title, date, score, maxScore,
             weight?, notes? }
```
Plot a trend line on the student detail page (score % over time). Compare
against a target grade line. This is the most familiar "progress chart" for
parents and students.

### B4. Auto-derived progress from existing data

Before building anything new, derive metrics from data we already collect:
- **Attendance rate** — from `attendanceStatus` (present vs absent), already
  tracked. Show as a per-student and per-period stat.
- **Lessons completed count** — derived from attendance.
- **Punctuality** — `present_late` ratio.
- **Consistency** — lessons/week vs. the student's `frequencyPerWeek` target.

These cost zero new input from the tutor and immediately populate an empty
progress page. Ship this first to make the page non-empty on day one.

### B5. Progress timeline / activity feed

A reverse-chronological feed per student stitching together: lessons completed,
attendance events, assessments logged, goals achieved, notes added. Gives a
"story" of the student's journey and doubles as a recap for the tutor before
each session.

### B6. Progress reports (the monetizable output)

Generate a term/period summary PDF for a student:
- Period range, total lessons, attendance %, punctuality.
- Assessments in the period with trend.
- Goals achieved / in progress.
- Mastery grid snapshot.
- Freeform tutor summary (pulled from note `strengths`/`areasToImprove`).

Options: email to parent (reuses email infra), download PDF, or show in a
future parent portal. This is what justifies the product to a paying parent.

### B7. Baselines & targets

Let the tutor set a starting baseline and a target (e.g. "Grade 4 → target
Grade 6 by June"). Plot current assessment trend between the two lines.
Powerful visual; light data cost.

### B8. Student self-assessment

Optional confidence self-rating per skill (RAG: red/amber/green) submitted by
the student. Compare tutor-assessed mastery vs. student confidence — a great
conversation starter and engagement hook (ties into a future student/parent
portal).

---

## Part C — UX / surface ideas

### C1. Where it lives
- **Lesson notes** → inside the existing `LessonDetail` page (extend the current
  notes + todos section). No new route.
- **Progress** → a new **"Progress" tab** on `StudentDetail`. New route
  `/students/:studentId/progress` (or a tab within the existing detail page).

### C2. "End of lesson" flow
After marking attendance (`useMarkLessonDone` exists today), prompt a quick
"lesson recap" modal: topics covered, mastery bump for relevant skills, set
homework as todos. Capture notes at the moment they're freshest.

### C3. Dashboard widget
Add a "Recent progress" / "Goals achieved this month" card to the tutor
dashboard alongside the existing summary.

### C4. Cross-student progress overview
A reporting view across all a tutor's students: who's stagnating (no mastery
movement), who has upcoming goal deadlines, who's attendance is slipping. This
is the seed of the Reporting feature (#14 in feature-ideas).

---

## Suggested build sequencing

To avoid a long gestation, sequence so each slice ships value on its own:

1. **Slice 0 — Derive from existing data (B4).** Attendance rate, lessons
   completed, punctuality on a new Student "Progress" tab. Zero new input,
   new UI only. Fast win, makes the tab non-empty.
2. **Slice 1 — Structured lesson notes (A1, A3).** Add the structured fields +
   carry-forward. Replaces the bare `notes` textarea. Immediate time-saver.
3. **Slice 2 — Goals (B1).** Small collection, big perceived value. CRUD +
   kanban on student detail.
4. **Slice 3 — Assessments + trend chart (B3, B7).** The classic progress chart.
5. **Slice 4 — Skill mastery grid (B2).** The differentiator. Heavier (skill
   definition UX), so comes once the lighter slices prove adoption.
6. **Slice 5 — Progress reports / PDF (B6).** The shareable, monetizable output.

Slices 0–1 are the MVP. Everything after compounds on the data they create.

---

## Open questions to resolve before spec'ing

- **Data shape:** separate collections (`goals`, `assessments`, `skillMastery`)
  vs. embedded arrays on the student doc? Separate collections scale better and
  match the existing `lessons`/`students` top-level pattern.
- **Structured notes:** add fields directly to `Lesson` (breaking-ish change to
  the schema) vs. a sibling `lessonNotes` collection keeping history? The
  carry-forward + history (A3, A7) lean toward a separate collection.
- **Skill catalog:** tutor-managed now, or invest in curated curriculum
  libraries up front?
- **Sharing model:** do we need shareable/private split (A5) in v1, or defer
  until the parent portal exists?
- **Rich text:** plain markdown now (simple, portable) or a WYSIWYG editor
  (friendlier, more deps)?
