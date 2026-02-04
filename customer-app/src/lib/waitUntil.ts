/**
 * Wait for an element's position to stabilize after scrolling.
 * Returns when the rect hasn't changed for `stableFrames` consecutive frames,
 * or after `maxWaitMs` has elapsed.
 */
export async function waitForScrollAndLayout({
  getRect,
  maxWaitMs = 1200,
  stableFrames = 6,
}: {
  getRect: () => DOMRect | null;
  maxWaitMs?: number;
  stableFrames?: number;
}) {
  const start = performance.now();
  let last = getRect();
  let stableCount = 0;

  return new Promise<void>((resolve) => {
    const tick = () => {
      const now = performance.now();
      const rect = getRect();

      if (!rect) return resolve();

      // If rect barely changes across frames, consider layout stable
      if (
        last &&
        Math.abs(rect.top - last.top) < 0.5 &&
        Math.abs(rect.left - last.left) < 0.5 &&
        Math.abs(rect.width - last.width) < 0.5 &&
        Math.abs(rect.height - last.height) < 0.5
      ) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }

      last = rect;

      const timedOut = now - start > maxWaitMs;
      const stable = stableCount >= stableFrames;

      if (stable || timedOut) return resolve();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

export function isRectInViewport(rect: DOMRect, padding = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    rect.bottom >= padding &&
    rect.right >= padding &&
    rect.top <= vh - padding &&
    rect.left <= vw - padding
  );
}
