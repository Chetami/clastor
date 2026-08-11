import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, Lightbulb, MessageSquare, X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCreateFeedback } from "./api";
import type { FeedbackType } from "@examify-tms/interfaces";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_OPTIONS: {
  value: FeedbackType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "bug", label: "Bug", icon: <Bug className="mr-1.5 h-4 w-4" /> },
  {
    value: "feedback",
    label: "Feedback",
    icon: <MessageSquare className="mr-1.5 h-4 w-4" />,
  },
  {
    value: "feature_request",
    label: "Feature Idea",
    icon: <Lightbulb className="mr-1.5 h-4 w-4" />,
  },
];

const MAX_IMAGES = 2;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const location = useLocation();
  const createFeedback = useCreateFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  function reset() {
    setType("bug");
    setMessage("");
    setImages([]);
    previews.forEach(URL.revokeObjectURL);
    setPreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, remaining);

    if (toAdd.length < files.length) {
      toast.message(`Max ${MAX_IMAGES} images allowed.`);
    }

    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previews[index]);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await createFeedback.mutateAsync({
        type,
        message: message.trim(),
        pageUrl: location.pathname,
        images,
      });
      toast.success("Thanks! Your feedback was sent.");
      handleClose(false);
    } catch {
      toast.error("Failed to send feedback. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Found a bug, have an idea, or want to share thoughts? Let us know.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={type}
            onValueChange={(v) => v && setType(v as FeedbackType)}
            className="justify-start"
          >
            {TYPE_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value}>
                {opt.icon}
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Tell us what's on your mind…"
              autoFocus
            />
          </div>

          {previews.length > 0 && (
            <div className="flex gap-2">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="group relative h-16 w-16 overflow-hidden rounded-md border"
                >
                  <img
                    src={src}
                    alt={`Attachment ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length < MAX_IMAGES && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4" />
                Add screenshot
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={createFeedback.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!message.trim() || createFeedback.isPending}
            >
              {createFeedback.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {createFeedback.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
