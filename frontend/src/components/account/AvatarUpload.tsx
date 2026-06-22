import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { uploadAvatarRequest } from "@/features/settings/api/requests";

/**
 * Profile-picture picker used by both Settings and the onboarding wizard.
 * Shows the current avatar (or an optimistic local preview during upload),
 * a "Change photo" button, and a hidden file input. On success the freshly
 * returned UserInfo is pushed into the auth store so every surface stays in
 * sync.
 */
export function AvatarUpload() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayName = user?.name ?? user?.email ?? "User";
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "?");
  const currentAvatar = previewUrl ?? user?.avatarUrl ?? null;

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Optimistic local preview before the upload resolves.
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setIsUploading(true);

    try {
      const updated = await uploadAvatarRequest(file);
      setUser(updated);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset so selecting the same file again still fires onChange.
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <Avatar className="size-24 shrink-0 rounded-full">
        {currentAvatar && <AvatarImage src={currentAvatar} alt={displayName} />}
        <AvatarFallback className="rounded-full text-2xl">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {isUploading ? "Uploading..." : "Change photo"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          PNG or JPG, up to 5 MB. Images are resized to a square thumbnail.
        </p>
      </div>
    </div>
  );
}
