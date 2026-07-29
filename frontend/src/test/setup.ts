import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";
import { configureShared } from "@examify-tms/shared";

// ---------------------------------------------------------------------------
// 1. Shared data layer bootstrap
//
// The shared axios client resolves its base URL lazily from the runtime
// config, so configureShared() must run before any hook fires. We point it at
// a throwaway URL — MSW intercepts every request regardless of host, so the
// base URL never matters in tests. jsdom ships a working localStorage, which
// the auth store reads/writes through the storage adapter.
// ---------------------------------------------------------------------------
configureShared({
  storage: localStorage,
  apiBaseUrl: "http://localhost:3001",
  onSessionExpired: undefined,
});

// ---------------------------------------------------------------------------
// 2. MSW — start the request interceptor once for the whole suite, reset
// handler overrides (per-test `server.use(...)`) after each test, and tear
// down on exit so lingering handlers never leak between files.
// ---------------------------------------------------------------------------
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// 3. Browser-API polyfills that jsdom doesn't ship but Radix UI / recharts /
//    sonner / ResponsiveContainer rely on at module-evaluation or render time.
// ---------------------------------------------------------------------------

// `matchMedia` — used by next-themes and the use-mobile hook.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

// `ResizeObserver` — Radix popovers/dialogs + recharts containers.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// `IntersectionObserver` — Radix scrolling primitives, tooltips, lazy lists.
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

// jsdom has no layout engine — scrolling APIs are no-ops.
window.scrollTo = vi.fn();
window.scroll = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// `URL.createObjectURL` — used by the CSV download helper (file-export tests).
URL.createObjectURL = vi.fn(() => "blob:mock");
URL.revokeObjectURL = vi.fn();

// `HTMLDialogElement.showModal/close` — Radix Dialog falls back to the native
// <dialog> element; jsdom throws on these without a polyfill.
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();
