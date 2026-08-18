export function createRenderLoop({
  draw,
  isActive,
  requestFrame,
  framesPerSecond = 30,
}) {
  let framePending = false;
  let lastDrawAt = null;
  const frameInterval = 1000 / Math.max(1, framesPerSecond);

  function wake() {
    if (framePending) return;
    framePending = true;
    requestFrame(render);
  }

  function render(now) {
    framePending = false;
    if (lastDrawAt === null || now - lastDrawAt >= frameInterval) {
      lastDrawAt = now;
      draw(now);
    }
    if (isActive()) wake();
  }

  return Object.freeze({ wake });
}
