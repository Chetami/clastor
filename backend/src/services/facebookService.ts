import axios from "axios";
import {
  graphBaseUrl,
  appsecretProof,
  requireFacebookConfig,
} from "../config/facebookOAuth";

/** A Facebook Page the user manages (subset of fields we care about). */
export interface FacebookPageAccount {
  id: string;
  name: string;
  access_token: string;
}

/** Shape of a published post result returned to the caller. */
export interface PublishedPost {
  postId: string;
  permalink: string;
}

/**
 * Normalise a Graph API error into a thrown Error with a useful message.
 * Graph errors nest the detail under `response.data.error`.
 */
function graphError(error: unknown, fallback: string): Error {
  const graphErr = (error as any)?.response?.data?.error;
  if (graphErr?.message) {
    const codePart = graphErr.code ? ` [code ${graphErr.code}]` : "";
    return new Error(`${graphErr.message}${codePart}`);
  }
  if (error instanceof Error) return new Error(`${fallback}: ${error.message}`);
  return new Error(fallback);
}

/**
 * Exchange the authorization code (from the OAuth redirect) for a short-lived
 * user access token.
 */
export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const { appId, appSecret, redirectUri } = requireFacebookConfig();
  try {
    const res = await axios.get(`${graphBaseUrl()}/oauth/access_token`, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });
    const token = res.data?.access_token;
    if (typeof token !== "string") {
      throw new Error("No access_token in response");
    }
    return token;
  } catch (error) {
    throw graphError(error, "Failed to exchange Facebook auth code");
  }
}

/**
 * Exchange a short-lived user token for a long-lived one (~60 days). A
 * long-lived user token is what yields long-lived Page tokens from
 * {@link listPages}.
 */
export async function exchangeLongLivedUserToken(
  shortToken: string,
): Promise<string> {
  const { appId, appSecret } = requireFacebookConfig();
  try {
    const res = await axios.get(`${graphBaseUrl()}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
    });
    const token = res.data?.access_token;
    if (typeof token !== "string") {
      throw new Error("No access_token in response");
    }
    return token;
  } catch (error) {
    throw graphError(error, "Failed to extend Facebook token");
  }
}

/**
 * List the Pages the user manages. Requires a long-lived user token to get
 * long-lived Page tokens back. Returns `{ id, name, access_token }` for each.
 */
export async function listPages(userToken: string): Promise<FacebookPageAccount[]> {
  try {
    const res = await axios.get(`${graphBaseUrl()}/me/accounts`, {
      params: {
        access_token: userToken,
        appsecret_proof: appsecretProof(userToken),
        fields: "id,name,access_token",
      },
    });
    const data = res.data?.data;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (p): p is FacebookPageAccount =>
        p && typeof p.id === "string" && typeof p.access_token === "string",
    );
  } catch (error) {
    throw graphError(error, "Failed to list Facebook Pages");
  }
}

/** Build the public permalink for a post on a given Page. */
function permalinkFor(pageId: string, postId: string): string {
  // Graph's feed call returns "<pageId>_<postId>"; the photo endpoint returns
  // just the photo id. Normalise to a usable public URL.
  const clean = postId.includes("_") ? postId : `${pageId}_${postId}`;
  return `https://www.facebook.com/${clean}`;
}

/**
 * Publish a text-only post to a Page.
 */
export async function publishTextPost(
  pageId: string,
  pageToken: string,
  message: string,
): Promise<PublishedPost> {
  try {
    const res = await axios.post(
      `${graphBaseUrl()}/${pageId}/feed`,
      {
        message,
        access_token: pageToken,
        appsecret_proof: appsecretProof(pageToken),
      },
    );
    const postId = res.data?.id;
    if (typeof postId !== "string") {
      throw new Error("No post id in response");
    }
    return { postId, permalink: permalinkFor(pageId, postId) };
  } catch (error) {
    throw graphError(error, "Failed to publish Facebook post");
  }
}

/**
 * Publish a single photo as a post to a Page. `imageUrl` must be publicly
 * reachable by Facebook's crawlers.
 */
export async function publishPhoto(
  pageId: string,
  pageToken: string,
  imageUrl: string,
  caption?: string,
): Promise<PublishedPost> {
  try {
    const res = await axios.post(
      `${graphBaseUrl()}/${pageId}/photos`,
      {
        url: imageUrl,
        caption,
        published: true,
        access_token: pageToken,
        appsecret_proof: appsecretProof(pageToken),
      },
    );
    const postId = res.data?.post_id ?? res.data?.id;
    if (typeof postId !== "string") {
      throw new Error("No post id in response");
    }
    return { postId, permalink: permalinkFor(pageId, postId) };
  } catch (error) {
    throw graphError(error, "Failed to publish Facebook photo");
  }
}

/**
 * Publish a multi-photo post: upload each image with `published:false` to get
 * media fids, then create a feed post referencing them via `attached_media`.
 */
export async function publishMultiPhotoPost(
  pageId: string,
  pageToken: string,
  imageUrls: string[],
  message?: string,
): Promise<PublishedPost> {
  try {
    const proof = appsecretProof(pageToken);
    // Upload each image unpublished to collect a media fid.
    const mediaFids: string[] = [];
    for (const url of imageUrls) {
      const upload = await axios.post(`${graphBaseUrl()}/${pageId}/photos`, {
        url,
        published: false,
        access_token: pageToken,
        appsecret_proof: proof,
      });
      const fid = upload.data?.id;
      if (typeof fid !== "string") {
        throw new Error("Failed to stage a photo for the multi-photo post");
      }
      mediaFids.push(fid);
    }

    const res = await axios.post(`${graphBaseUrl()}/${pageId}/feed`, {
      message,
      attached_media: mediaFids.map((fid) => ({ media_fbid: fid })),
      access_token: pageToken,
      appsecret_proof: proof,
    });
    const postId = res.data?.id;
    if (typeof postId !== "string") {
      throw new Error("No post id in response");
    }
    return { postId, permalink: permalinkFor(pageId, postId) };
  } catch (error) {
    throw graphError(error, "Failed to publish Facebook multi-photo post");
  }
}

/**
 * Route a publish request to the right Graph call based on the image input:
 * text-only, single photo, or multi-photo.
 */
export async function publishPost(
  pageId: string,
  pageToken: string,
  message: string,
  imageUrl?: string | string[],
): Promise<PublishedPost> {
  const urls = Array.isArray(imageUrl)
    ? imageUrl.filter(Boolean)
    : imageUrl
      ? [imageUrl]
      : [];

  if (urls.length === 0) {
    return publishTextPost(pageId, pageToken, message);
  }
  if (urls.length === 1) {
    return publishPhoto(pageId, pageToken, urls[0], message || undefined);
  }
  return publishMultiPhotoPost(pageId, pageToken, urls, message || undefined);
}
