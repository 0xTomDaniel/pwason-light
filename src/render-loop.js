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
    const drew = lastDrawAt === null || now - lastDrawAt >= frameInterval;
    if (drew) {
      lastDrawAt = now;
      draw(now);
    }
    if (isActive() || !drew) wake();
  }

  return Object.freeze({ wake });
}
