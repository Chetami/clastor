import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirestoreFake } from "./helpers/firestore";
import type { User } from "@examify-tms/interfaces";
import { NotFoundError, ServiceUnavailableError, UnauthorizedError } from "../src/utils/AppError";
import { generateToken, verifyRefreshToken, verifyToken } from "../src/utils/jwt";

const database = createFirestoreFake();
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), emailVerified: vi.fn(), lastActive: vi.fn() }));
vi.mock("../src/config/firebase", () => ({ getFirebaseFirestore: () => database }));
vi.mock("../src/services/authService", () => ({ getEmailVerified: mocks.emailVerified }));
vi.mock("../src/services/userService", () => ({
  getUserFromFirestore: mocks.getUser,
  updateLastActive: mocks.lastActive,
  toUserInfo: (user: User, emailVerified: boolean) => ({ uid: user.id, role: user.role, emailVerified }),
  generateJWTForUser: (user: User, authTime: number) => generateToken(user.id, user.email, user.role, authTime),
}));
import { issueNewTokenPair, rotateRefreshToken, revokeRefreshToken } from "../src/services/tokenService";
const user = { id: "uid-1", email: "tutor@example.com", role: "tutor" } as User;
const authTime = Math.floor(Date.now() / 1000) - 60;
const record = (token: string) => database.store.get(`refreshTokens/${verifyRefreshToken(token)!.jti}`)!;

beforeEach(() => {
  database.store.clear(); database.failNextCommit = false; vi.clearAllMocks();
  mocks.getUser.mockResolvedValue(user); mocks.emailVerified.mockResolvedValue(true); mocks.lastActive.mockResolvedValue(undefined);
});

describe("rotating sessions", () => {
  it("stores only token hashes and binds both tokens to the original authentication", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    expect(record(pair.refreshToken).tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify([...database.store.values()])).not.toContain(pair.refreshToken);
    expect(verifyToken(pair.jwtToken).auth_time).toBe(authTime);
    expect(verifyRefreshToken(pair.refreshToken)!.auth_time).toBe(authTime);
    expect(mocks.emailVerified).toHaveBeenCalledWith(user.id, authTime);
  });
  it("atomically consumes a token, replaces it and preserves authentication time", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    const next = await rotateRefreshToken(pair.refreshToken);
    expect(record(pair.refreshToken).revoked).toBe(true);
    expect(record(next.refreshToken).revoked).toBe(false);
    expect(verifyRefreshToken(next.refreshToken)!.auth_time).toBe(authTime);
    expect(next.user.emailVerified).toBe(true);
  });
  it("admits at most one concurrent rotation and revokes the family on replay", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    const results = await Promise.allSettled([rotateRefreshToken(pair.refreshToken), rotateRefreshToken(pair.refreshToken)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const winner = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof rotateRefreshToken>>>;
    await expect(rotateRefreshToken(winner.value.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("leaves the old token live when a dependency is unavailable", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    mocks.emailVerified.mockRejectedValueOnce(new ServiceUnavailableError("offline"));
    await expect(rotateRefreshToken(pair.refreshToken)).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(record(pair.refreshToken).revoked).toBe(false);
    await expect(rotateRefreshToken(pair.refreshToken)).resolves.toHaveProperty("jwtToken");
  });
  it("rolls back all rotation writes when commit fails", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    database.failNextCommit = true;
    await expect(rotateRefreshToken(pair.refreshToken)).rejects.toThrow("storage unavailable");
    expect(record(pair.refreshToken).revoked).toBe(false);
    expect(database.store.size).toBe(2);
    await expect(rotateRefreshToken(pair.refreshToken)).resolves.toHaveProperty("refreshToken");
  });
  it("revokes the family when logging out with a token already rotated", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    const next = await rotateRefreshToken(pair.refreshToken);
    await revokeRefreshToken(pair.refreshToken);
    await expect(rotateRefreshToken(next.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("logout and concurrent refresh cannot leave a refreshable family", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    await Promise.allSettled([rotateRefreshToken(pair.refreshToken), revokeRefreshToken(pair.refreshToken)]);
    const familyId = verifyRefreshToken(pair.refreshToken)!.familyId;
    expect(database.store.get(`refreshTokenFamilies/${familyId}`)!.revoked).toBe(true);
  });
  it("rejects disabled or revoked Firebase identities before issuing or consuming tokens", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    mocks.emailVerified.mockRejectedValue(new UnauthorizedError("revoked"));
    await expect(rotateRefreshToken(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(issueNewTokenPair(user, authTime)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(record(pair.refreshToken).revoked).toBe(false);
  });
  it("treats a deleted profile as an invalid session", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    mocks.getUser.mockRejectedValueOnce(new NotFoundError("gone"));
    await expect(rotateRefreshToken(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("requires an explicit authentication time", async () => {
    await expect(issueNewTokenPair(user, undefined as unknown as number)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(database.store.size).toBe(0);
  });
  it("requires reauthentication after a lost rotation response is replayed", async () => {
    const pair = await issueNewTokenPair(user, authTime);
    await rotateRefreshToken(pair.refreshToken); // response was lost
    await expect(rotateRefreshToken(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
