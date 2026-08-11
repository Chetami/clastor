import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentForm } from "../StudentForm";
import type { StudentFormData } from "../student-schema";

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: (values: StudentFormData) => void | Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
  /** When provided, the form seeds from this student (edit mode). */
  defaultValues?: Partial<StudentFormData>;
  /** Forces a fresh form mount per student so seed values reset correctly. */
  formKey?: string;
}

/**
 * Wraps {@link StudentForm} in a dialog. Used for both the "Add" and "Edit"
 * student flows so the dialog chrome lives in one place.
 */
export function StudentFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  onCancel,
  disabled,
  defaultValues,
  formKey,
}: StudentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <StudentForm
          key={formKey}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onCancel={onCancel}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      </DialogContent>
    </Dialog>
  );
}
