function thresholdAt(x, y) {
  const quadrant = [0, 2, 3, 1];
  let rank = 0;
  for (let bit = 0; bit < 3; bit++) {
    rank = rank * 4 + quadrant[(((y >> bit) & 1) << 1) | ((x >> bit) & 1)];
  }
  return (rank + 0.5) / 64;
}

function latticeValue(x, y) {
  let seed = (x * 374761393 + y * 668265263) | 0;
  seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function noiseAt(x, y) {
  const column = Math.floor(x), row = Math.floor(y);
  const dx = x - column, dy = y - row;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const a = latticeValue(column, row), b = latticeValue(column + 1, row);
  const c = latticeValue(column, row + 1), d = latticeValue(column + 1, row + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function createPageField(canvas) {
  const context = canvas.getContext('2d');
  let disposed = false;
  let frame = 0;
  function draw() {
    frame = 0;
    if (!context || disposed) return;
    const width = Math.max(1, Math.floor(innerWidth));
    const height = Math.max(1, Math.floor(innerHeight));
    canvas.width = width;
    canvas.height = height;
    const cell = 5, radius = cell * 0.24, opacity = 0.55;
    const columns = Math.ceil(width / cell), rows = Math.ceil(height / cell);
    const scale = 5.5 / columns;
    // Ordered 8x8 dithering keeps the noise texture stationary between sections.
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const coarse = noiseAt(column * scale * 8, row * scale * 8);
        const fine = noiseAt(column * scale * 22 + 40, row * scale * 22 + 40);
        const density = (coarse * 0.65 + fine * 0.35) * 0.85;
        const threshold = thresholdAt(column, row);
        if (density < threshold) continue;
        const alpha = (0.05 + Math.min(1, (density - threshold) * 2.2) * 0.22) * opacity;
        context.fillStyle = `rgba(0, 255, 65, ${alpha.toFixed(3)})`;
        context.beginPath();
        context.arc(column * cell + cell / 2, row * cell + cell / 2, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    canvas.dataset.ready = 'true';
  }
  function request() {
    if (!frame && !disposed && context) frame = requestAnimationFrame(draw);
  }
  window.addEventListener('resize', request, { passive: true });
  request();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', request);
    },
  };
}
