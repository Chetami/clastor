import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory Firestore mock supporting the query shapes the org services use:
 * doc().get/update/set/delete, collection().add(), chained where().limit().get(),
 * and getAll(...refs). Hoisted so the mocked factory can close over the store.
 */
const { store, idCounter } = vi.hoisted(() => ({
  store: new Map<string, any>(),
  idCounter: { n: 0 },
}));

function matchDoc(data: Record<string, any>, filters: { field: string; op: string; value: any }[]): boolean {
  return filters.every(({ field, op, value }) => {
    if (op === "==") return data[field] === value;
    if (op === "array-contains") return Array.isArray(data[field]) && data[field].includes(value);
    return true;
  });
}

vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => {
    const collection = (name: string) => {
      const docRef = (id: string) => {
        const path = `${name}/${id}`;
        const ref = {
          _path: path,
          get: async () => ({
            exists: store.has(path),
            data: () => store.get(path) ?? {},
            id,
          }),
          update: async (patch: Record<string, unknown>) => {
            const prev = store.get(path) ?? {};
            store.set(path, { ...prev, ...patch });
          },
          set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            if (opts?.merge) store.set(path, { ...(store.get(path) ?? {}), ...data });
            else store.set(path, data);
          },
          delete: async () => {
            store.delete(path);
          },
        };
        return ref;
      };

      return {
        doc: docRef,
        add: async (data: Record<string, unknown>) => {
          idCounter.n += 1;
          const id = `auto-${name}-${idCounter.n}`;
          store.set(`${name}/${id}`, data);
          return { id };
        },
        where: (field: string, op: string, value: any) => {
          const filters: { field: string; op: string; value: any }[] = [{ field, op, value }];
          const chain = {
            where: (f: string, o: string, v: any) => {
              filters.push({ field: f, op: o, value: v });
              return chain;
            },
            limit: (_n: number) => chain,
            get: async () => {
              const prefix = `${name}/`;
              const matched: any[] = [];
              for (const [path, data] of store.entries()) {
                if (!path.startsWith(prefix)) continue;
                if (matchDoc(data, filters)) {
                  matched.push({
                    id: path.slice(prefix.length),
                    data: () => data,
                    ref: docRef(path.slice(prefix.length)),
                    exists: true,
                  });
                }
              }
              return {
                empty: matched.length === 0,
                size: matched.length,
                docs: matched,
                forEach: (cb: (d: any) => void) => matched.forEach(cb),
              };
            },
          };
          return chain;
        },
      };
    };
    return {
      collection,
      getAll: async (...refs: any[]) =>
        refs.map((r) => {
          const data = store.get(r._path) ?? {};
          return {
            exists: store.has(r._path),
            id: r._path.split("/")[1],
            data: () => data,
          };
        }),
    };
  },
}));

import {
  createOrganisation,
  listOrganisationsForUser,
  joinOrganisationByCode,
  regenerateJoinCode,
  softDeleteOrganisation,
  findActiveOrgByJoinCode,
  updateOrganisation,
} from "../src/services/organisationService";
import {
  addMember,
  getMembership,
  getMembershipRole,
  joinAsMember,
  updateMemberRole,
  removeMember,
  countOrgAdmins,
  requireOrgAdmin,
} from "../src/services/orgMemberService";
import { resolveScope } from "../src/services/orgScope";
import { NotFoundError, ForbiddenError, ConflictError } from "../src/utils/httpError";

const OWNER = "owner-1";
const TUTOR = "tutor-1";

function seedOrg(id: string, over: Record<string, any> = {}) {
  store.set(`organisations/${id}`, {
    name: id,
    logoUrl: null,
    joinCode: id.toUpperCase(),
    createdBy: OWNER,
    deletedAt: null,
    createdAt: { toDate: () => new Date("2024-01-01T00:00:00Z") },
    updatedAt: { toDate: () => new Date("2024-01-01T00:00:00Z") },
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  idCounter.n = 0;
});

describe("createOrganisation", () => {
  it("creates the org and makes the creator the first org_admin", async () => {
    const org = await createOrganisation(OWNER, { name: "Acme" });
    expect(org.name).toBe("Acme");
    expect(org.joinCode).not.toBeNull();
    expect(org.deletedAt).toBeNull();

    const role = await getMembershipRole(OWNER, org.id);
    expect(role).toBe("org_admin");
  });

  it("rejects an empty name", async () => {
    await expect(createOrganisation(OWNER, { name: "   " })).rejects.toThrow();
  });
});

describe("listOrganisationsForUser", () => {
  it("returns only active orgs the user belongs to", async () => {
    seedOrg("org-a");
    seedOrg("org-b");
    seedOrg("org-deleted", { deletedAt: { toDate: () => new Date() } });
    await addMember("org-a", TUTOR, "member");
    await addMember("org-deleted", TUTOR, "member");

    const orgs = await listOrganisationsForUser(TUTOR);
    expect(orgs.map((o) => o.id)).toEqual(["org-a"]);
  });

  it("never reveals join codes in the list", async () => {
    seedOrg("org-a");
    await addMember("org-a", TUTOR, "member");
    const orgs = await listOrganisationsForUser(TUTOR);
    expect(orgs[0].joinCode).toBeNull();
  });
});

describe("joinOrganisationByCode", () => {
  it("joins an active org by code as a member", async () => {
    seedOrg("org-a");
    const { organisation, created } = await joinOrganisationByCode("ORG-A", TUTOR);
    expect(created).toBe(true);
    expect(organisation.id).toBe("org-a");
    expect(await getMembershipRole(TUTOR, "org-a")).toBe("member");
  });

  it("is idempotent (re-join returns created=false)", async () => {
    seedOrg("org-a");
    await joinOrganisationByCode("ORG-A", TUTOR);
    const { created } = await joinOrganisationByCode("ORG-A", TUTOR);
    expect(created).toBe(false);
  });

  it("throws NotFoundError for an unknown code", async () => {
    await expect(joinOrganisationByCode("NOPE", TUTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects joining a soft-deleted org", async () => {
    seedOrg("org-dead", { deletedAt: { toDate: () => new Date() } });
    await expect(joinOrganisationByCode("ORG-DEAD", TUTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("regenerateJoinCode", () => {
  it("replaces the join code", async () => {
    seedOrg("org-a", { joinCode: "OLDCODE1" });
    const next = await regenerateJoinCode("org-a");
    expect(next).not.toBe("OLDCODE1");
    expect((await findActiveOrgByJoinCode("OLDCODE1"))).toBeNull();
    expect((await findActiveOrgByJoinCode(next))?.id).toBe("org-a");
  });
});

describe("updateOrganisation", () => {
  it("updates name and logoUrl", async () => {
    seedOrg("org-a");
    const updated = await updateOrganisation("org-a", {
      name: "Acme 2",
      logoUrl: "https://example.com/logo.png",
    });
    expect(updated.name).toBe("Acme 2");
    expect(updated.logoUrl).toBe("https://example.com/logo.png");
  });
});

describe("softDeleteOrganisation", () => {
  it("archives the org (hidden from lists and joins)", async () => {
    seedOrg("org-a");
    await addMember("org-a", TUTOR, "member");
    await softDeleteOrganisation("org-a");

    expect(await listOrganisationsForUser(TUTOR)).toEqual([]);
    await expect(joinOrganisationByCode("ORG-A", OWNER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("membership role + lockout guards", () => {
  beforeEach(async () => {
    seedOrg("org-a");
  });

  it("requireOrgAdmin passes for org_admin, forbids members, 404s non-members", async () => {
    await addMember("org-a", OWNER, "org_admin");
    await addMember("org-a", TUTOR, "member");

    await expect(requireOrgAdmin(OWNER, "org-a")).resolves.toBeUndefined();
    await expect(requireOrgAdmin(TUTOR, "org-a")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(requireOrgAdmin("stranger", "org-a")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("promotes a member to org_admin", async () => {
    await addMember("org-a", OWNER, "org_admin");
    await addMember("org-a", TUTOR, "member");
    await updateMemberRole("org-a", TUTOR, "org_admin");
    expect(await getMembershipRole(TUTOR, "org-a")).toBe("org_admin");
    expect(await countOrgAdmins("org-a")).toBe(2);
  });

  it("forbids demoting the last org_admin", async () => {
    await addMember("org-a", OWNER, "org_admin");
    await expect(updateMemberRole("org-a", OWNER, "member")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await getMembershipRole(OWNER, "org-a")).toBe("org_admin");
  });

  it("forbids removing the last org_admin", async () => {
    await addMember("org-a", OWNER, "org_admin");
    await expect(removeMember("org-a", OWNER)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await getMembership(OWNER, "org-a")).not.toBeNull();
  });

  it("removes a non-last admin when another admin remains", async () => {
    await addMember("org-a", OWNER, "org_admin");
    await addMember("org-a", TUTOR, "org_admin");
    await removeMember("org-a", TUTOR);
    expect(await getMembership(TUTOR, "org-a")).toBeNull();
  });
});

describe("joinAsMember", () => {
  it("returns created=true on first join, false after", async () => {
    seedOrg("org-a");
    const first = await joinAsMember("org-a", TUTOR);
    const second = await joinAsMember("org-a", TUTOR);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.member.role).toBe("member");
  });
});

describe("resolveScope", () => {
  beforeEach(async () => {
    seedOrg("org-a");
  });

  it("personal mode when no currentOrgId", async () => {
    expect(await resolveScope({ uid: TUTOR, currentOrgId: null })).toEqual({
      mode: "personal",
    });
  });

  it("org-admin scope when the user is an org_admin", async () => {
    await addMember("org-a", OWNER, "org_admin");
    const scope = await resolveScope({ uid: OWNER, currentOrgId: "org-a" });
    expect(scope).toEqual({ mode: "org-admin", orgId: "org-a", role: "org_admin" });
  });

  it("org-member scope when the user is a plain member", async () => {
    await addMember("org-a", TUTOR, "member");
    const scope = await resolveScope({ uid: TUTOR, currentOrgId: "org-a" });
    expect(scope.mode).toBe("org-member");
    if (scope.mode === "org-member") expect(scope.userId).toBe(TUTOR);
  });

  it("degrades to personal when the user is no longer a member (stale JWT)", async () => {
    const scope = await resolveScope({ uid: "stranger", currentOrgId: "org-a" });
    expect(scope.mode).toBe("personal");
  });

  it("degrades to personal when the org was soft-deleted", async () => {
    await softDeleteOrganisation("org-a");
    await addMember("org-a", TUTOR, "member");
    const scope = await resolveScope({ uid: TUTOR, currentOrgId: "org-a" });
    expect(scope.mode).toBe("personal");
  });
});
