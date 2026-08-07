import { Link } from "react-router-dom";
import { EyeOff, Globe, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip, ViewToggle, type View } from "./components";

interface ProfileEditorToolbarProps {
  isPublished: boolean;
  isDirty: boolean;
  liveUrl: string | null;
  view: View;
  saving: boolean;
  publishing: boolean;
  busy: boolean;
  formError: string | null;
  onViewChange: (v: View) => void;
  onUnpublish: () => void;
  onSave: () => void;
  onPublish: () => void;
}

/** Top toolbar: title + status, editor/preview toggle, and all save/publish actions. */
export function ProfileEditorToolbar({
  isPublished,
  isDirty,
  liveUrl,
  view,
  saving,
  publishing,
  busy,
  formError,
  onViewChange,
  onUnpublish,
  onSave,
  onPublish,
}: ProfileEditorToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Public profile</h1>
          <StatusChip published={isPublished} />
        </div>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-9">
          {isPublished && (
            <Button
              type="button"
              variant="outline"
              onClick={onUnpublish}
              disabled={busy}
            >
              <EyeOff className="size-4" />
              Unpublish
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDirty && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          )}
          {isPublished && liveUrl && (
            <Button asChild variant="outline">
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <Globe className="size-4" />
                Go to website
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={!isDirty || saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isPublished ? "Save changes" : "Save draft"}
          </Button>
          {!isPublished && (
            <Button type="button" onClick={onPublish} disabled={busy}>
              {publishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      <p className="-mt-2 text-sm text-muted-foreground">
        Your name and photo come from{" "}
        <Link
          to="/settings"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Settings
        </Link>
        .
      </p>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </div>
  );
}
