import { WorkingHoursEditor } from "@/components/account/WorkingHoursEditor";

/**
 * Working-hours step. Preloads the tutor's saved hours (or the default
 * window) and persists on save. Reuses the same editor as Settings so the two
 * stay in sync.
 */
export function WorkingHoursStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-lg font-semibold tracking-tight">Working hours</h2>
        <p className="text-sm text-muted-foreground">
          Set the hours you usually work. They appear as shaded bands on your
          calendar, and you'll be warned when booking a lesson outside them.
        </p>
      </div>
      <WorkingHoursEditor />
    </div>
  );
}
