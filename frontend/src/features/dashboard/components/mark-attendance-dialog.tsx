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
import { FileText, Loader2 } from "lucide-react";
import type { LessonResponse, AttendanceStatus } from "@examify-tms/interfaces";

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
  onConfirm: (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
  ) => Promise<void>;
  isPending: boolean;
};

export function MarkAttendanceDialog({
  open,
  onOpenChange,
  lesson,
  studentName,
  onConfirm,
  isPending,
}: Props) {
  const [selected, setSelected] = useState<AttendanceStatus | null>(null);
  const [sendInvoice, setSendInvoice] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    try {
      await onConfirm(lesson.id, selected, sendInvoice);
      setSelected(null);
      setSendInvoice(false);
      onOpenChange(false);
    } catch {
      // handled by caller
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSelected(null);
          setSendInvoice(false);
        }
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
