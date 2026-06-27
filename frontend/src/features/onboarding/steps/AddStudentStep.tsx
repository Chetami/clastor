import { useState } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import type { CreateStudentRequest } from "@examify-tms/interfaces";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubjects } from "@/lib/subjects";
import { useCreateStudent } from "@/features/students/api/use-create-student";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Slim "add your first student" form. Captures just enough to be useful
 * (name + email required) and creates a real student record immediately.
 * Optional subject is pre-fillable from the catalogue set in the previous
 * step. Skippable.
 */
export function AddStudentStep() {
  const subjects = useSubjects();
  const createStudent = useCreateStudent();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");

  const [createdName, setCreatedName] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function validate() {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const payload: CreateStudentRequest = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      parentEmail: null,
      billingEmail: null,
      subjectIds: subjectId ? [subjectId] : [],
      expectedAmount: 0,
      rateType: "hourly",
      frequencyPerWeek: 0,
      status: "active",
      timezone: null,
      notes: null,
    };
    try {
      await createStudent.mutateAsync(payload);
      setCreatedName(name.trim());
    } catch {
      // surfaced via mutation state
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setSubjectId("");
    setCreatedName(null);
  }

  if (createdName) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {createdName} is on board
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            You'll see them in your Students list. Next, let's schedule their
            first lesson.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetForm}>
          <UserPlus className="size-4" />
          Add another student
        </Button>
        {createStudent.isError && (
          <p className="text-xs text-destructive">
            {createStudent.error.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <UserPlus className="size-4" />
          Add your first student
        </h2>
        <p className="text-sm text-muted-foreground">
          Just a name and email to start — you can flesh out their details
          later.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-student-name">Full name</Label>
          <Input
            id="ob-student-name"
            value={name}
            placeholder="e.g. Alex Chen"
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && (
            <span className="text-xs text-destructive">{errors.name}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-student-email">Email</Label>
          <Input
            id="ob-student-email"
            type="email"
            value={email}
            placeholder="e.g. alex@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <span className="text-xs text-destructive">{errors.email}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-student-phone">Phone (optional)</Label>
          <Input
            id="ob-student-phone"
            value={phone}
            placeholder="e.g. +1 555 0100"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {subjects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={createStudent.isPending}
        >
          {createStudent.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          Add student
        </Button>
        {createStudent.isError && (
          <span className="text-xs text-destructive">
            {createStudent.error.message}
          </span>
        )}
      </div>
    </div>
  );
}
