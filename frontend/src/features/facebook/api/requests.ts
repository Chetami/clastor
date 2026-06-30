import { api } from "@/lib/api";
import type {
  FacebookConnectionStatus,
  FacebookPage,
  PublishFacebookPostRequest,
  PublishFacebookPostResponse,
} from "@examify-tms/interfaces";

/**
 * Whether the authenticated tutor has connected a Facebook Page. The access
 * token itself is never exposed.
 */
export async function getFacebookStatusRequest(): Promise<FacebookConnectionStatus> {
  const response = await api.get<FacebookConnectionStatus>(
    "/api/auth/facebook/status",
  );
  return response.data;
}

/**
 * Start the Facebook OAuth consent flow bound to the authenticated user.
 * Returns a single-use consent URL the browser should be redirected to.
 * `returnTo` (a same-origin path) controls where the browser lands after
 * consent; defaults to /marketing on the backend.
 */
export async function connectFacebookRequest(
  returnTo?: string,
): Promise<{ authUrl: string }> {
  const response = await api.get<{ authUrl: string }>(
    "/api/auth/facebook/url",
    {
      params: returnTo ? { returnTo } : undefined,
    },
  );
  return response.data;
}

/**
 * Disconnect the tutor's Facebook account (clears stored tokens).
 */
export async function disconnectFacebookRequest(): Promise<void> {
  await api.delete("/api/auth/facebook");
}

/**
 * Pages available to select during a multi-Page connection. Only populated
 * right after the OAuth callback (when the user manages several Pages).
 */
export async function listFacebookPagesRequest(): Promise<FacebookPage[]> {
  const response = await api.get<{ pages: FacebookPage[] }>(
    "/api/auth/facebook/pages",
  );
  return response.data.pages;
}

/**
 * Finalize a multi-Page connection by selecting which Page to post to.
 */
export async function selectFacebookPageRequest(
  pageId: string,
): Promise<{ connected: boolean }> {
  const response = await api.post<{ connected: boolean }>(
    "/api/auth/facebook/page",
    { pageId },
  );
  return response.data;
}

/**
 * Publish payload: a message, optional public image URL(s), and/or uploaded
 * image files. When files are present the request is sent as multipart
 * form-data so the backend can forward the bytes straight to Facebook.
 */
export interface PublishPostPayload {
  message: string;
  imageUrl?: string | string[];
  files?: File[];
}

/**
 * Publish a post (text + optional images) to the tutor's connected Facebook
 * Page. Image URLs go as repeated `imageUrl` fields; uploaded files as `images`
 * multipart parts. Pure-URL/text posts still send as JSON.
 */
export async function publishFacebookPostRequest(
  data: PublishPostPayload,
): Promise<PublishFacebookPostResponse> {
  const urls = Array.isArray(data.imageUrl)
    ? data.imageUrl
    : data.imageUrl
      ? [data.imageUrl]
      : [];

  if (data.files && data.files.length > 0) {
    const form = new FormData();
    form.append("message", data.message);
    for (const url of urls) form.append("imageUrl", url);
    for (const file of data.files) form.append("images", file);
    const response = await api.post<PublishFacebookPostResponse>(
      "/api/facebook/posts",
      form,
    );
    return response.data;
  }

  const body: PublishFacebookPostRequest = { message: data.message };
  if (data.imageUrl) body.imageUrl = data.imageUrl;
  const response = await api.post<PublishFacebookPostResponse>(
    "/api/facebook/posts",
    body,
  );
  return response.data;
}
