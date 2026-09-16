import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirestoreFake } from "./helpers/firestore";
import { ServiceUnavailableError } from "../src/utils/AppError";
const database = createFirestoreFake();
vi.mock("../src/config/firebase", () => ({ getFirebaseFirestore: () => database }));
import { createUserInFirestore, findUserInFirestore } from "../src/services/userService";
beforeEach(() => { database.store.clear(); database.failNextCommit = false; });
describe("retry-safe account provisioning", () => {
  it("does not overwrite an existing administrator on a signup retry", async () => {
    await createUserInFirestore("u1", "admin@example.com", "Existing", "system_admin");
    const record = database.store.get("users/u1")!;
    record.subjects = [{ id: "math", name: "Math", color: "blue" }];
    const retried = await createUserInFirestore("u1", "admin@example.com", "Replacement", "tutor");
    expect(retried.role).toBe("system_admin");
    expect(retried.name).toBe("Existing");
    expect(retried.subjects).toHaveLength(1);
  });
  it("concurrent creates converge on one unchanged profile", async () => {
    const results = await Promise.all([
      createUserInFirestore("u1", "tutor@example.com", "First"),
      createUserInFirestore("u1", "tutor@example.com", "Second"),
    ]);
    expect(database.store.size).toBe(1);
    expect(results[0].name).toBe(results[1].name);
  });
  it("distinguishes an absent user from a storage failure", async () => {
    await expect(findUserInFirestore("missing")).resolves.toBeNull();
    const spy = vi.spyOn(database, "collection").mockImplementationOnce(() => { throw new Error("offline"); });
    await expect(findUserInFirestore("missing")).rejects.toBeInstanceOf(ServiceUnavailableError);
    spy.mockRestore();
  });
});
