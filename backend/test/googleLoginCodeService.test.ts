import { describe, expect, it, beforeEach, vi } from "vitest";

// --- Fake Firestore ---------------------------------------------------------
// The service only touches collection().doc().{set,get,delete} inside
// runTransaction. A Map-backed fake reproduces those semantics (including
// atomicity-by-serialization) without initializing firebase-admin.

function createFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();
  const key = (col: string, id: string) => `${col}/${id}`;

  const makeRef = (col: string, id: string) => ({
    id,
    get: async () => ({
      exists: store.has(key(col, id)),
      data: () => store.get(key(col, id)),
    }),
    set: async (data: Record<string, unknown>) => {
      store.set(key(col, id), data);
    },
    delete: async () => {
      store.delete(key(col, id));
    },
  });

  return {
    store,
    collection: (col: string) => ({ doc: (id: string) => makeRef(col, id) }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn({
        get: async (ref: Awaited<ReturnType<typeof makeRef>>) => ref.get(),
        delete: (ref: ReturnType<typeof makeRef>) => {
          void ref.delete();
        },
      }),
  };
}

const firestore = createFakeFirestore();

vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => firestore,
}));

// Import AFTER the mock is registered.
import {
  createGoogleLoginCode,
  consumeGoogleLoginCode,
} from "../src/services/googleLoginCodeService";
import crypto from "crypto";

const sha256 = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex");

beforeEach(() => {
  firestore.store.clear();
  vi.useRealTimers();
});

describe("googleLoginCodeService", () => {
  describe("createGoogleLoginCode", () => {
    it("returns a URL-safe 256-bit code (43-char base64url)", async () => {
      const code = await createGoogleLoginCode({ uid: "u1", isNewUser: true });
      expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("produces unique codes", async () => {
      const a = await createGoogleLoginCode({ uid: "u1", isNewUser: false });
      const b = await createGoogleLoginCode({ uid: "u1", isNewUser: false });
      expect(a).not.toBe(b);
    });

    it("stores only a SHA-256 hash — never the raw code", async () => {
      const code = await createGoogleLoginCode({ uid: "u1", isNewUser: true });

      const keys = [...firestore.store.keys()];
      expect(keys).toEqual([`googleLoginCodes/${sha256(code)}`]);

      const doc = firestore.store.get(`googleLoginCodes/${sha256(code)}`)!;
      expect(JSON.stringify(doc)).not.toContain(code);
      expect(doc.uid).toBe("u1");
      expect(doc.isNewUser).toBe(true);
    });
  });

  describe("consumeGoogleLoginCode", () => {
    it("round-trips the bound identity exactly once", async () => {
      const code = await createGoogleLoginCode({ uid: "u1", isNewUser: true });

      await expect(consumeGoogleLoginCode(code)).resolves.toEqual({
        uid: "u1",
        isNewUser: true,
      });

      // Single-use: the doc was deleted with the read; a replay gets null.
      await expect(consumeGoogleLoginCode(code)).resolves.toBeNull();
    });

    it("deletes the document on redemption", async () => {
      const code = await createGoogleLoginCode({ uid: "u2", isNewUser: false });
      await consumeGoogleLoginCode(code);
      expect(firestore.store.size).toBe(0);
    });

    it("rejects an expired code (pruning the doc)", async () => {
      const code = await createGoogleLoginCode({ uid: "u1", isNewUser: false });

      // Simulate the passage of time by ageing the stored expiry.
      const docKey = `googleLoginCodes/${sha256(code)}`;
      const doc = firestore.store.get(docKey)!;
      doc.expiresAtMs = Date.now() - 1;

      await expect(consumeGoogleLoginCode(code)).resolves.toBeNull();
      expect(firestore.store.has(docKey)).toBe(false);
    });

    it("returns null for an unknown code", async () => {
      await expect(consumeGoogleLoginCode("nope")).resolves.toBeNull();
    });
  });
});
