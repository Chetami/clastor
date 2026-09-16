/** Small transactional store for service tests: staged writes commit atomically. */
export function createFirestoreFake() {
  const store = new Map<string, Record<string, any>>();
  let queue = Promise.resolve();
  const database = {
    store,
    failNextCommit: false,
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    batch: () => writes(),
    runTransaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      const prior = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await prior;
      const pending = writes();
      try {
        const result = await callback({
          ...pending,
          get: async (document: ReturnType<typeof ref>) => {
            if (pending.count()) throw new Error("Firestore reads must precede writes");
            return document.get();
          },
        });
        await pending.commit();
        return result;
      } finally { release(); }
    },
  };
  function ref(path: string) {
    return {
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      create: async (data: Record<string, any>) => {
        const pending = writes(); pending.create({ path }, data); await pending.commit();
      },
      set: async (data: Record<string, any>) => { store.set(path, data); },
      update: async (data: Record<string, any>) => {
        const pending = writes(); pending.update({ path }, data); await pending.commit();
      },
    };
  }
  function writes() {
    const operations: Array<{ path: string; kind: "create" | "update"; data: Record<string, any> }> = [];
    return {
      count: () => operations.length,
      create: (document: { path: string }, data: Record<string, any>) => { operations.push({ path: document.path, kind: "create", data }); },
      update: (document: { path: string }, data: Record<string, any>) => { operations.push({ path: document.path, kind: "update", data }); },
      commit: async () => {
        if (database.failNextCommit) { database.failNextCommit = false; throw new Error("storage unavailable"); }
        const next = new Map(store);
        for (const op of operations) {
          if (op.kind === "create" && next.has(op.path)) throw Object.assign(new Error("already exists"), { code: 6 });
          if (op.kind === "update" && !next.has(op.path)) throw new Error("not found");
          next.set(op.path, op.kind === "create" ? op.data : { ...next.get(op.path), ...op.data });
        }
        store.clear();
        for (const [key, value] of next) store.set(key, value);
      },
    };
  }
  return database;
}
