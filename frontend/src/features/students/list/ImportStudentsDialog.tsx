import { useState } from "react";
import { toast } from "sonner";
import type { StudentImportSummary } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useImportStudents } from "../api";
import { downloadCsv, STUDENT_CSV_TEMPLATE } from "../student-utils";

interface ImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CSV import dialog. Owns its file/result state and the import mutation. Shows
 * a created/skipped/error summary after the upload resolves.
 */
export function ImportStudentsDialog({
  open,
  onOpenChange,
}: ImportStudentsDialogProps) {
  const importStudents = useImportStudents();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] =
    useState<StudentImportSummary | null>(null);

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setImportFile(null);
      setImportResult(null);
    }
  }

  function downloadTemplate() {
    downloadCsv("students-template.csv", STUDENT_CSV_TEMPLATE);
  }

  async function handleImport() {
    if (!importFile) return;
    try {
      const summary = await importStudents.mutateAsync(importFile);
      setImportResult(summary);
      if (summary.created > 0) {
        toast.success(
          `Imported ${summary.created} student${summary.created === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import students.",
      );
    }
  }

  function done() {
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import students from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with a header row. Subject names must match your
            subject catalogue and are separated by semicolons (e.g.
            <span className="font-medium"> Mathematics; Physics</span>).
            Existing emails are skipped.
          </DialogDescription>
        </DialogHeader>

        {importResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold">{importResult.total}</p>
                <p className="text-xs text-muted-foreground">Rows</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {importResult.created}
                </p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold text-destructive">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <ul className="divide-y text-sm">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 px-3 py-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 text-xs text-muted-foreground">
                        row {e.row}
                      </span>
                      <span className="text-muted-foreground">{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Download a CSV template
            </button>
          </div>
        )}

        <DialogFooter>
          {importResult ? (
            <Button type="button" onClick={done}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" type="button" onClick={done}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!importFile || importStudents.isPending}
                onClick={handleImport}
              >
                {importStudents.isPending ? "Importing…" : "Import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
