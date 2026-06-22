/**
 * Resolve once `selector` matches an element in the DOM, or after `timeout`
 * ms (resolves null on timeout). Used to wait for the next route's tour
 * anchor to render before driver.js highlights it.
 */
export function waitForSelector(
  selector: string,
  timeout = 2000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const start = Date.now();
    const id = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el || Date.now() - start >= timeout) {
        window.clearInterval(id);
        resolve(el);
      }
    }, 50);
  });
}
