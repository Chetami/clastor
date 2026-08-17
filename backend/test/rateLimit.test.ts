import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Import AFTER test env bootstrap (setup-env.ts sets the secrets the JWT
// module requires at import time).
import {
  loginLimiter,
  registerLimiter,
  firebaseGoogleLoginLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  waitlistLimiter,
  refreshLimiter,
  googleLoginStartLimiter,
  googleCallbackLimiter,
  googleLoginExchangeLimiter,
  rsvpLimiter,
  stripePayLimiter,
  publicProfileLimiter,
  globalApiLimiter,
} from "../src/middleware/rateLimit";

/**
 * The limiters are exercised as raw middleware: invoke with a fake req/res
 * and count. Each test uses a unique client IP (or uid) so the shared
 * module-level buckets don't bleed between tests.
 */

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function fakeReq(overrides: Partial<Request> = {}): Request {
  return { ip: nextIp(), headers: {}, ...overrides } as unknown as Request;
}

function fakeRes(): Response & {
  statusCode: number;
  body: unknown;
  redirectedTo?: string;
} {
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
    // custom redirect handlers use res.redirect — stub both.
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

type Limiter = (req: Request, res: Response, next: NextFunction) => void;

/** Drive the limiter `count` times for one client; return the last result. */
async function hit(
  limiter: Limiter,
  req: Request,
  count: number,
): Promise<{ res: ReturnType<typeof fakeRes>; passed: number }> {
  let passed = 0;
  let lastRes = fakeRes();
  for (let i = 0; i < count; i++) {
    lastRes = fakeRes();
    const next = vi.fn(() => {
      passed += 1;
    }) as unknown as NextFunction;
    // The limiter is sync for in-store hits (MemoryStore), but treat it as
    // async so the test stays correct if the store changes.
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve(limiter(req, lastRes, next));
  }
  return { res: lastRes, passed };
}

/** Assert a limiter passes exactly `limit` requests then blocks the next. */
async function expectLimit(
  limiter: Limiter,
  limit: number,
  style: "json" | "redirect",
  req: Request = fakeReq(),
) {
  const under = await hit(limiter, req, limit);
  expect(under.passed).toBe(limit);

  const over = await hit(limiter, req, 1);
  expect(over.passed).toBe(0);
  if (style === "json") {
    expect(over.res.statusCode).toBe(429);
    expect(over.res.body).toEqual({ message: expect.any(String) });
  } else {
    expect(over.res.redirectedTo).toMatch(/error=rate_limited$/);
  }
}

// --- Tier 1: strictest public auth surface -----------------------------------

describe("public auth limiters", () => {
  it("loginLimiter: 20/15min then JSON 429", async () => {
    await expectLimit(loginLimiter, 20, "json");
  });

  it("registerLimiter: 10/15min then JSON 429", async () => {
    await expectLimit(registerLimiter, 10, "json");
  });

  it("firebaseGoogleLoginLimiter: 30/15min then JSON 429", async () => {
    await expectLimit(firebaseGoogleLoginLimiter, 30, "json");
  });

  it("forgotPasswordLimiter: 5/15min then JSON 429 (email-bombing guard)", async () => {
    await expectLimit(forgotPasswordLimiter, 5, "json");
  });

  it("resendVerificationLimiter: 5/15min keyed by uid, not IP", async () => {
    const uid = `uid-${nextIp()}`;
    const reqFor = (ip: string) =>
      fakeReq({ ip, user: { uid } } as Partial<Request>);

    // Burn the whole bucket from one IP…
    await hit(resendVerificationLimiter, reqFor("10.9.9.1"), 5);

    // …a different IP with the SAME uid is still blocked (uid-keyed)…
    const sameUid = await hit(resendVerificationLimiter, reqFor("10.9.9.2"), 1);
    expect(sameUid.passed).toBe(0);

    // …and a different uid on the original IP is unaffected.
    const otherUid = await hit(
      resendVerificationLimiter,
      fakeReq({ ip: "10.9.9.1", user: { uid: "uid-someone-else" } } as Partial<Request>),
      1,
    );
    expect(otherUid.passed).toBe(1);
  });

  it("waitlistLimiter: 5/15min then JSON 429", async () => {
    await expectLimit(waitlistLimiter, 5, "json");
  });

  it("refreshLimiter: 60/15min then JSON 429", async () => {
    await expectLimit(refreshLimiter, 60, "json");
  });
});

// --- Tier 1: Google merged-login flow ----------------------------------------

describe("Google merged-login limiters", () => {
  it("googleLoginStartLimiter: 30/15min then redirects (navigation)", async () => {
    await expectLimit(googleLoginStartLimiter, 30, "redirect");
  });

  it("googleCallbackLimiter: 30/15min then redirects (navigation)", async () => {
    await expectLimit(googleCallbackLimiter, 30, "redirect");
  });

  it("googleLoginExchangeLimiter: 30/15min then JSON 429", async () => {
    await expectLimit(googleLoginExchangeLimiter, 30, "json");
  });
});

// --- Tier 2: public link/read endpoints --------------------------------------

describe("public link/read limiters", () => {
  it("rsvpLimiter: 60/15min then JSON 429", async () => {
    await expectLimit(rsvpLimiter, 60, "json");
  });

  it("stripePayLimiter: 30/15min then JSON 429", async () => {
    await expectLimit(stripePayLimiter, 30, "json");
  });

  it("publicProfileLimiter: 60/15min then JSON 429", async () => {
    await expectLimit(publicProfileLimiter, 60, "json");
  });
});

// --- Tier 3: global /api ceiling ----------------------------------------------

describe("globalApiLimiter", () => {
  it("is generous: 2000/5min pass before the JSON 429", async () => {
    await expectLimit(globalApiLimiter, 2000, "json");
  }, 20_000);

  it("skips the Stripe webhook path (Stripe signs and retries legitimately)", async () => {
    const { passed } = await hit(
      globalApiLimiter,
      fakeReq({ path: "/stripe/webhook" } as Partial<Request>),
      2050,
    );
    // Every request passes regardless of volume — the path is excluded.
    expect(passed).toBe(2050);
  }, 20_000);
});

// --- Cross-cutting: per-client buckets ----------------------------------------

describe("bucket isolation", () => {
  it("one abusive IP doesn't exhaust another client's bucket", async () => {
    const abuser = fakeReq();
    await hit(loginLimiter, abuser, 21);

    const { passed } = await hit(loginLimiter, fakeReq(), 5);
    expect(passed).toBe(5);
  });
});
