/**
 * A minimal synchronous key/value store. The web app implements this with
 * `localStorage`; the mobile app implements it with `expo-secure-store`'s
 * synchronous accessors (JSI-backed). Both are synchronous so the axios
 * request interceptor and the Zustand store can read the token inline,
 * mirroring the original `localStorage`-based behaviour.
 *
 * Implementations MUST be synchronous. If a target platform only offers
 * async storage, hydrate tokens into a synchronous cache at bootstrap.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
