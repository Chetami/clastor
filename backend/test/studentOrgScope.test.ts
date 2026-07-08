import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgScope } from "../src/services/orgScope";

// In-memory Firestore mock (same shape as organisationService.test.ts).
const { store } = vi.hoisted(() => ({ store: new Map<string, any>() }));

function matchDoc(data: any, filters: { field: string; op: string; value: any }[]): boolean {
  return filters.every(({ field, op, value }) => {
    if (op === "==") return data[field] === value;
    if (op === "array-contains") return Array.isArray(data[field]) && data[field].includes(value);
    return true;
  });
}

vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => ({
    collection: (name: string) => ({
      get: async () => {
        const prefix = `${name}/`;
        const matched: any[] = [];
        for (const [path, data] of store.entries()) {
          if (!path.startsWith(prefix)) continue;
          matched.push({ id: path.slice(prefix.length), data: () => data });
        }
        return { empty: matched.length === 0, size: matched.length, docs: matched, forEach: (cb: any) => matched.forEach(cb) };
      },
      where: (field: string, op: string, value: any) => {
        const filters: any[] = [{ field, op, value }];
        const chain = {
          where: (f: string, o: string, v: any) => {
            filters.push({ field: f, op: o, value: v });
            return chain;
          },
          get: async () => {
            const prefix = `${name}/`;
            const matched: any[] = [];
            for (const [path, data] of store.entries()) {
              if (!path.startsWith(prefix)) continue;
              if (matchDoc(data, filters)) matched.push({ id: path.slice(prefix.length), data: () => data });
            }
            return { empty: matched.length === 0, size: matched.length, docs: matched, forEach: (cb: any) => matched.forEach(cb) };
          },
        };
        return chain;
      },
    }),
  }),
}));

import { listStudentsFromFirestore } from "../src/services/studentService";

const TUTOR = "tutor-1";
const OTHER_TUTOR = "tutor-2";
const ORG = "org-a";
const ts = () => ({ toDate: () => new Date("2024-01-01T00:00:00Z") });

function seedStudent(id: string, over: Record<string, any> = {}) {
  store.set(`students/${id}`, {
    tutorId: null,
    organisationId: null,
    tutorIds: [],
    name: id,
    email: `${id}@x.com`,
    subjectIds: [],
    expectedAmount: 10,
    rateType: "hourly",
    frequencyPerWeek: 1,
    status: "active",
    amountOwed: 0,
    createdAt: ts(),
    updatedAt: ts(),
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  // Personal (legacy) student owned by TUTOR.
  seedStudent("personal-mine", { tutorId: TUTOR, subjectIds: ["subj-math"] });
  // Personal student owned by another tutor — should never appear for TUTOR.
  seedStudent("personal-other", { tutorId: OTHER_TUTOR });

  // Org students.
  seedStudent("org-mine", { organisationId: ORG, tutorIds: [TUTOR], subjectIds: ["subj-math", "subj-phys"] });
  seedStudent("org-other", { organisationId: ORG, tutorIds: [OTHER_TUTOR], subjectIds: ["subj-math"] });
  seedStudent("org-unassigned", { organisationId: ORG, tutorIds: [] });
  // A different org's student.
  seedStudent("org-b-student", { organisationId: "org-b", tutorIds: [TUTOR] });
});

describe("listStudentsFromFirestore — org scope", () => {
  it("personal mode: only the tutor's own legacy students", async () => {
    const scope: OrgScope = { mode: "personal" };
    const students = await listStudentsFromFirestore(TUTOR, "tutor", undefined, scope);
    expect(students.map((s) => s.id)).toEqual(["personal-mine"]);
  });

  it("org-admin: sees every student in the org", async () => {
    const scope: OrgScope = { mode: "org-admin", orgId: ORG, role: "org_admin" };
    const students = await listStudentsFromFirestore(TUTOR, "tutor", undefined, scope);
    expect(students.map((s) => s.id).sort()).toEqual(["org-mine", "org-other", "org-unassigned"]);
  });

  it("org-member: sees only org students they teach", async () => {
    const scope: OrgScope = { mode: "org-member", orgId: ORG, role: "member", userId: TUTOR };
    const students = await listStudentsFromFirestore(TUTOR, "tutor", undefined, scope);
    expect(students.map((s) => s.id)).toEqual(["org-mine"]);
  });

  it("org-admin subject filter applies in-query", async () => {
    const scope: OrgScope = { mode: "org-admin", orgId: ORG, role: "org_admin" };
    const students = await listStudentsFromFirestore(TUTOR, "tutor", "subj-phys", scope);
    expect(students.map((s) => s.id)).toEqual(["org-mine"]);
  });

  it("org-member subject filter applies in-memory (double array-contains avoided)", async () => {
    const scope: OrgScope = { mode: "org-member", orgId: ORG, role: "member", userId: TUTOR };
    const withMath = await listStudentsFromFirestore(TUTOR, "tutor", "subj-math", scope);
    const withPhys = await listStudentsFromFirestore(TUTOR, "tutor", "subj-phys", scope);
    expect(withMath.map((s) => s.id)).toEqual(["org-mine"]); // org-mine is TUTOR's and has subj-math
    expect(withPhys.map((s) => s.id)).toEqual(["org-mine"]);
  });

  it("system_admin ignores scope and sees everything", async () => {
    const scope: OrgScope = { mode: "org-admin", orgId: ORG, role: "org_admin" };
    const students = await listStudentsFromFirestore("", "system_admin", undefined, scope);
    expect(students.length).toBe(6);
  });

  it("mapped students expose organisationId + tutorIds", async () => {
    const scope: OrgScope = { mode: "org-admin", orgId: ORG, role: "org_admin" };
    const [orgMine] = await listStudentsFromFirestore(TUTOR, "tutor", undefined, scope).then((s) =>
      s.filter((x) => x.id === "org-mine"),
    );
    expect(orgMine.organisationId).toBe(ORG);
    expect(orgMine.tutorIds).toEqual([TUTOR]);
  });
});
