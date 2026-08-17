import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Import AFTER test env bootstrap (setup-env.ts sets the secrets the JWT
// module requires at import time; the rate-limit module itself is env-light).
import {
  googleLoginStartLimiter,
  googleLoginExchangeLimiter,
} from "../src/middleware/rateLimit";

/**
 * The limiters are exercised as raw middleware: invoke with a fake req/res
 * and count. Each test uses a unique client IP so the shared module-level
 * buckets don't bleed between tests.
 */

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

function fakeReq(ip: string): Request {
  return { ip, headers: {} } as unknown as Request;
}

function fakeRes(): Response & { statusCode: number; body: unknown; redirectedTo?: string } {
  const res = {
    statusCode: 200,
    redirectedTo: undefined as string | undefined,
    body: undefined as unknown,
    setHeader: vi.fn(),
    getHeader: vi.fn(() => undefined),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    // express-rate-limit's default 429 handler uses res.send, while the
    // custom start-limiter handler uses res.redirect — stub both.
    send(data: unknown) {
      this.body = data;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    redirect(url: string) {
      this.redirectedTo = url;
      this.statusCode = 302;
      return this;
    },
  };
  return res as unknown as ReturnType<typeof fakeRes>;
}

/** Drive the limiter `count` times for one IP; return the last result. */
async function hit(
  limiter: (req: Request, res: Response, next: NextFunction) => void,
  ip: string,
  count: number,
) {
  let nextCalls = 0;
  let lastRes = fakeRes();
  for (let i = 0; i < count; i++) {
    lastRes = fakeRes();
    const next = vi.fn(() => {
      nextCalls += 1;
    }) as unknown as NextFunction;
    // The limiter is sync for in-store hits (MemoryStore), but treat it as
    // async so the test stays correct if the store changes.
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve(limiter(fakeReq(ip), lastRes, next));
  }
  return { res: lastRes, nextCalls };
}

describe("googleLoginStartLimiter", () => {
  it("lets requests under the limit through (calls next)", async () => {
    const { nextCalls } = await hit(googleLoginStartLimiter, nextIp(), 30);
    expect(nextCalls).toBe(30);
  });

  it("redirects to the frontend error page on the (limit+1)th hit", async () => {
    const ip = nextIp();
    await hit(googleLoginStartLimiter, ip, 30);

    const { res, nextCalls } = await hit(googleLoginStartLimiter, ip, 1);

    // Navigation endpoint: a JSON 429 would render as raw JSON in the
    // browser — the handler must redirect to a friendly page instead.
    expect(res.redirectedTo).toMatch(
      /^https?:\/\/[^/]+\/auth\/google\/callback\?error=rate_limited$/,
    );
    expect(nextCalls).toBe(0);
  });

  it("keys buckets per IP — one abusive IP doesn't block others", async () => {
    const abuser = nextIp();
    const normal = nextIp();
    await hit(googleLoginStartLimiter, abuser, 31);

    const { nextCalls } = await hit(googleLoginStartLimiter, normal, 5);
    expect(nextCalls).toBe(5);
  });
});

describe("googleLoginExchangeLimiter", () => {
  it("lets requests under the limit through (calls next)", async () => {
    const { nextCalls } = await hit(googleLoginExchangeLimiter, nextIp(), 30);
    expect(nextCalls).toBe(30);
  });

  it("returns a 429 JSON ApiError on the (limit+1)th hit", async () => {
    const ip = nextIp();
    await hit(googleLoginExchangeLimiter, ip, 30);

    const { res, nextCalls } = await hit(googleLoginExchangeLimiter, ip, 1);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      message: expect.stringContaining("Too many sign-in attempts"),
    });
    expect(nextCalls).toBe(0);
  });

  it("keys buckets per IP — one abusive IP doesn't block others", async () => {
    const abuser = nextIp();
    const normal = nextIp();
    await hit(googleLoginExchangeLimiter, abuser, 31);

    const { nextCalls } = await hit(googleLoginExchangeLimiter, normal, 5);
    expect(nextCalls).toBe(5);
  });
});
