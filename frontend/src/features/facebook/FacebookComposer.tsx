import { useState } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePublishFacebookPost } from "./api/use-facebook-posts";

const MAX_MESSAGE = 5000;

/**
 * Compose and publish a post (text + optional public image URL) to the tutor's
 * connected Facebook Page. Phase 1 only supports image URLs (no file upload).
 */
export function FacebookComposer() {
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const publish = usePublishFacebookPost();
  const [published, setPublished] = useState<{
    permalink: string;
  } | null>(null);

  const trimmedMessage = message.trim();
  const trimmedImage = imageUrl.trim();
  const canPublish =
    !publish.isPending && (trimmedMessage.length > 0 || trimmedImage.length > 0);

  function handlePublish() {
    setPublished(null);
    publish.mutate(
      {
        message: trimmedMessage,
        imageUrl: trimmedImage || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Posted to your Facebook Page.");
          setPublished({ permalink: data.permalink });
          setMessage("");
          setImageUrl("");
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to publish post.",
          ),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a post</CardTitle>
        <CardDescription>
          Write a post and publish it to your connected Facebook Page. Images
          must be public URLs Facebook can reach.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fb-message">Message</Label>
          <textarea
            id="fb-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            rows={5}
            placeholder="Announce new slots, a promotion, or a subject you teach…"
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <p className="text-right text-xs text-muted-foreground">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fb-image">Image URL (optional)</Label>
          <Input
            id="fb-image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/poster.png"
            type="url"
          />
        </div>

        {published && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Your post is live.{" "}
            <a
              href={published.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium underline"
            >
              View on Facebook <ExternalLink className="size-3" />
            </a>
          </p>
        )}

        <div>
          <Button onClick={handlePublish} disabled={!canPublish}>
            {publish.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Publish post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
