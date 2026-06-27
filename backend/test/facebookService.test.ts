import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock axios so no real Graph calls happen; record the endpoints + payloads.
const gets = vi.fn();
const posts = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...args: unknown[]) => gets(...args),
    post: (...args: unknown[]) => posts(...args),
  },
}));

// Mock the OAuth config so tests don't depend on env vars.
vi.mock("../src/config/facebookOAuth", () => ({
  graphBaseUrl: () => "https://graph.facebook.com/vTEST",
  appsecretProof: () => "proof",
  requireFacebookConfig: () => ({
    appId: "app",
    appSecret: "secret",
    redirectUri: "https://example/cb",
  }),
  FB_GRAPH_VERSION: "vTEST",
  FACEBOOK_SCOPES: ["pages_manage_posts"],
}));

import {
  publishPost,
  publishTextPost,
  publishPhoto,
  publishMultiPhotoPost,
} from "../src/services/facebookService";

const PAGE_ID = "123";
const TOKEN = "tok";

beforeEach(() => {
  gets.mockReset();
  posts.mockReset();
});

describe("publishPost routing", () => {
  it("routes a text-only post to /feed", async () => {
    posts.mockResolvedValueOnce({ data: { id: "123_999" } });

    const result = await publishPost(PAGE_ID, TOKEN, "hello");

    expect(posts).toHaveBeenCalledTimes(1);
    const [url, body] = posts.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/vTEST/123/feed");
    expect(body.message).toBe("hello");
    expect(body.access_token).toBe(TOKEN);
    expect(body.appsecret_proof).toBe("proof");
    expect(result).toEqual({
      postId: "123_999",
      permalink: "https://www.facebook.com/123_999",
    });
  });

  it("routes a single image to /photos as a published photo", async () => {
    posts.mockResolvedValueOnce({ data: { post_id: "123_555", id: "777" } });

    const result = await publishPost(PAGE_ID, TOKEN, "cap", "https://img/a.png");

    const [url, body] = posts.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/vTEST/123/photos");
    expect(body.url).toBe("https://img/a.png");
    expect(body.caption).toBe("cap");
    expect(body.published).toBe(true);
    // Prefers post_id over the photo id.
    expect(result.postId).toBe("123_555");
  });

  it("routes multiple images to staged uploads + one feed post", async () => {
    // Two unpublished photo uploads then the feed post.
    posts
      .mockResolvedValueOnce({ data: { id: "fid1" } })
      .mockResolvedValueOnce({ data: { id: "fid2" } })
      .mockResolvedValueOnce({ data: { id: "123_multi" } });

    const result = await publishPost(PAGE_ID, TOKEN, "multi", [
      "https://img/a.png",
      "https://img/b.png",
    ]);

    expect(posts).toHaveBeenCalledTimes(3);
    // First two are unpublished staging uploads.
    expect(posts.mock.calls[0][1].published).toBe(false);
    expect(posts.mock.calls[1][1].published).toBe(false);
    // Final feed post references both media fids.
    const feedBody = posts.mock.calls[2][1];
    expect(posts.mock.calls[2][0]).toBe(
      "https://graph.facebook.com/vTEST/123/feed",
    );
    expect(feedBody.attached_media).toEqual([
      { media_fbid: "fid1" },
      { media_fbid: "fid2" },
    ]);
    expect(result.postId).toBe("123_multi");
  });
});

describe("publishTextPost requires a post id", () => {
  it("throws when Graph omits the id", async () => {
    posts.mockResolvedValueOnce({ data: {} });
    await expect(
      publishTextPost(PAGE_ID, TOKEN, "hi"),
    ).rejects.toThrow(/Failed to publish Facebook post/);
  });
});

describe("permalink fallback", () => {
  it("prefixes a bare photo id with the page id", async () => {
    posts.mockResolvedValueOnce({ data: { id: "777" } });
    const result = await publishPhoto(PAGE_ID, TOKEN, "https://img/a.png");
    expect(result.permalink).toBe("https://www.facebook.com/123_777");
  });

  it("keeps a feed id that already contains the page id", async () => {
    posts.mockResolvedValueOnce({ data: { id: "123_456" } });
    const result = await publishTextPost(PAGE_ID, TOKEN, "hi");
    expect(result.permalink).toBe("https://www.facebook.com/123_456");
  });

  it("does not call axios.get for any publish path", async () => {
    posts.mockResolvedValueOnce({ data: { id: "123_1" } });
    await publishTextPost(PAGE_ID, TOKEN, "hi");
    expect(gets).not.toHaveBeenCalled();
  });

  it("builds a permalink from a multi-photo feed id", async () => {
    posts
      .mockResolvedValueOnce({ data: { id: "f1" } })
      .mockResolvedValueOnce({ data: { id: "f2" } })
      .mockResolvedValueOnce({ data: { id: "123_mult" } });
    const result = await publishMultiPhotoPost(
      PAGE_ID,
      TOKEN,
      ["https://a", "https://b"],
      "m",
    );
    expect(result.permalink).toBe("https://www.facebook.com/123_mult");
  });
});
