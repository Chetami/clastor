import { Megaphone } from "lucide-react";
import { FacebookConnectionCard } from "./FacebookConnectionCard";
import { FacebookComposer } from "./FacebookComposer";
import { useFacebookConnectionStatus } from "./api/use-facebook-connect";

/**
 * Marketing page: connect a Facebook Page and compose/publish posts to it.
 * The composer is only shown once a Page is connected.
 */
export default function Facebook() {
  const statusQuery = useFacebookConnectionStatus();
  const connected = statusQuery.data?.connected;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Megaphone className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Publish posts to your Facebook Page from Clastor.
          </p>
        </div>
      </div>

      <FacebookConnectionCard />
      {connected ? <FacebookComposer /> : null}
    </div>
  );
}
