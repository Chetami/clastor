import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, FileText, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonResponse, AttendanceStatus } from "@examify-tms/interfaces";
import type { InvoiceLessonEdits } from "@/features/payments/api";

type AttendanceOption = {
  value: AttendanceStatus;
  label: string;
};

const OPTIONS: AttendanceOption[] = [
  { value: "present", label: "Present" },
  { value: "present_late", label: "Late" },
  { value: "absent_no_makeup", label: "Absent" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonResponse;
  studentName: string;
  /** Allowed subject names for this student (from the tutor's catalogue). */
  subjectOptions: string[];
  onConfirm: (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => Promise<void>;
  isPending: boolean;
};

export function MarkAttendanceDialog({
  open,
  onOpenChange,
  lesson,
  studentName,
  subjectOptions,
  onConfirm,
  isPending,
}: Props) {
  const [selected, setSelected] = useState<AttendanceStatus | null>(null);
  const [sendInvoice, setSendInvoice] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subject, setSubject] = useState(lesson.subject ?? "");
  const [duration, setDuration] = useState(String(lesson.durationMinutes));

  const subjectChanged = subject !== (lesson.subject ?? "");
  const durationNum = Number(duration);
  const durationChanged =
    Number.isFinite(durationNum) &&
    durationNum >= 1 &&
    durationNum !== lesson.durationMinutes;
  const hasEdits = subjectChanged || durationChanged;

  const subjectChoices =
    lesson.subject && !subjectOptions.includes(lesson.subject)
      ? [lesson.subject, ...subjectOptions]
      : subjectOptions;

  const reset = () => {
    setSelected(null);
    setSendInvoice(false);
    setDetailsOpen(false);
    setSubject(lesson.subject ?? "");
    setDuration(String(lesson.durationMinutes));
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const edits: InvoiceLessonEdits = {};
    if (subjectChanged) edits.subject = subject || null;
    if (durationChanged) edits.durationMinutes = durationNum;
    try {
      await onConfirm(
        lesson.id,
        selected,
        sendInvoice,
        hasEdits ? edits : undefined,
      );
      reset();
      onOpenChange(false);
    } catch {
      // handled by caller
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            {studentName} ·{" "}
            {new Date(lesson.startDateTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        <ToggleGroup
          type="single"
          value={selected ?? ""}
          onValueChange={(v) => v && setSelected(v as AttendanceStatus)}
          variant="outline"
          className="grid w-full grid-cols-3 gap-2"
        >
          {OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className="h-12 text-sm"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit details
                {hasEdits && (
                  <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    edited
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  detailsOpen && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-subject" className="text-xs">
                Subject
              </Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="invoice-subject" className="h-8">
                  <SelectValue
                    placeholder={
                      subjectOptions.length > 0
                        ? "Select a subject"
                        : "No subjects assigned"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No subject</SelectItem>
                  {subjectChoices.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-duration" className="text-xs">
                Duration (minutes)
              </Label>
              <Input
                id="invoice-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-8"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <label
          htmlFor="send-invoice"
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 hover:bg-accent transition-colors"
        >
          <Checkbox
            id="send-invoice"
            checked={sendInvoice}
            onChange={(e) => setSendInvoice(e.target.checked)}
          />
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Create and send invoice</span>
        </label>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!selected || isPending}
            className="w-full"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
