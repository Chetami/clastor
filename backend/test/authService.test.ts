import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableError, UnauthorizedError } from "../src/utils/AppError";
const firebase = vi.hoisted(() => ({ verifyIdToken: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/config/firebase", () => ({ getFirebaseAuth: () => firebase }));
import { getEmailVerified, verifyFirebaseToken } from "../src/services/authService";
const now = Math.floor(Date.now() / 1000);
beforeEach(() => { vi.resetAllMocks(); });
describe("Firebase account status", () => {
  it("checks revocation when exchanging Firebase ID tokens", async () => {
    firebase.verifyIdToken.mockResolvedValue({ uid: "u1", auth_time: now });
    await verifyFirebaseToken("test-credential");
    expect(firebase.verifyIdToken).toHaveBeenCalledWith("test-credential", true);
  });
  it.each(["auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found", "auth/id-token-expired"])("returns 401 for %s", async (code) => {
    firebase.verifyIdToken.mockRejectedValue({ code });
    await expect(verifyFirebaseToken("test-credential")).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("distinguishes SDK outages from bad credentials", async () => {
    firebase.verifyIdToken.mockRejectedValue({ code: "app/network-error", message: "sensitive internals" });
    await expect(verifyFirebaseToken("test-credential")).rejects.toBeInstanceOf(ServiceUnavailableError);
    firebase.getUser.mockRejectedValue(new Error("network unavailable"));
    await expect(getEmailVerified("u1", now)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
  it("rejects a disabled account even if its email is verified", async () => {
    firebase.getUser.mockResolvedValue({ disabled: true, emailVerified: true });
    await expect(getEmailVerified("u1", now)).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("rejects an authentication predating reset/revocation", async () => {
    firebase.getUser.mockResolvedValue({ emailVerified: true, tokensValidAfterTime: new Date(now * 1000).toISOString() });
    await expect(getEmailVerified("u1", now - 1)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getEmailVerified("u1", now)).resolves.toBe(true);
  });
});
