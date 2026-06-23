import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkingHours } from "@examify-tms/interfaces";

// In-memory Firestore store, hoisted so the mocked module factory can see it.
const { store } = vi.hoisted(() => ({ store: new Map<string, any>() }));

vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        const path = `${name}/${id}`;
        return {
          get: async () => ({
            exists: store.has(path),
            data: () => store.get(path) ?? {},
          }),
          update: async (patch: Record<string, unknown>) => {
            const prev = store.get(path) ?? {};
            const next = { ...prev };
            for (const [k, v] of Object.entries(patch)) {
              // Recognize the real firebase-admin FieldValue.delete() sentinel.
              if (
                v &&
                typeof v === "object" &&
                (v as { _methodName?: string })._methodName === "FieldValue.delete"
              ) {
                delete next[k];
              } else {
                next[k] = v;
              }
            }
            store.set(path, next);
          },
          set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            if (opts?.merge) {
              store.set(path, { ...(store.get(path) ?? {}), ...data });
            } else {
              store.set(path, data);
            }
          },
        };
      },
    }),
  }),
}));

// Import after the mock is registered.
import {
  updateUserWorkingHours,
  normalizeWorkingHours,
  toUserInfo,
} from "../src/services/userService";

const UID = "user-123";

// Timestamps need a .toDate() to satisfy getUserFromFirestore on read-back.
function ts() {
  return { toDate: () => new Date("2024-01-01T00:00:00Z") };
}

beforeEach(() => {
  store.clear();
  store.set(`users/${UID}`, {
    name: "Test Tutor",
    email: "t@t.com",
    role: "tutor",
    avatarUrl: null,
    currency: "AUD",
    reminderLeadTime: null,
    onboardingComplete: true,
    tourSeen: true,
    createdAt: ts(),
    updatedAt: ts(),
    lastActive: ts(),
  });
});

describe("updateUserWorkingHours round-trip", () => {
  // The reported symptom: PATCH /api/users/me with working hours did not
  // return the changed working hours. This exercises the full save -> read
  // -> map-to-UserInfo path with a mocked Firestore.
  it("returns the saved working hours (regression)", async () => {
    const input = {
      monday: { start: "09:00", end: "17:00" },
      tuesday: null,
      wednesday: { start: "10:00", end: "18:00" },
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    } as WorkingHours;

    const updated = await updateUserWorkingHours(UID, normalizeWorkingHours(input));
    const info = toUserInfo(updated);

    expect(info.workingHours).not.toBeNull();
    expect(info.workingHours?.monday).toEqual({ start: "09:00", end: "17:00" });
    expect(info.workingHours?.wednesday).toEqual({ start: "10:00", end: "18:00" });
    expect(info.workingHours?.tuesday).toBeNull();
  });

  it("persists exactly one weekday when only monday is set", async () => {
    const updated = await updateUserWorkingHours(UID, {
      monday: { start: "09:00", end: "17:00" },
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    });
    expect(updated.workingHours?.monday).toEqual({ start: "09:00", end: "17:00" });
    expect(Object.values(updated.workingHours ?? {}).filter(Boolean)).toHaveLength(1);
  });

  it("clears working hours when passed null", async () => {
    // First set, then clear.
    await updateUserWorkingHours(UID, {
      monday: { start: "09:00", end: "17:00" },
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    });
    const cleared = await updateUserWorkingHours(UID, null);
    expect(toUserInfo(cleared).workingHours).toBeNull();
  });
});
