// Skyline Run — keyboard and mouse controls.
// Arrows (or A/D + W/S) fly the jet; the mouse steers by position too.
// The module only reports intent; physics.js decides what it means.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { active: false, x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.active = true;
    mouse.x = (e.clientX - r.left) / r.width * 2 - 1;
    mouse.y = (e.clientY - r.top) / r.height * 2 - 1;
  });
  canvas.addEventListener('mouseleave', () => { mouse.active = false; });
  window.addEventListener('blur', () => keys.clear());

  return {
    // -1..1 pitch (up is positive stick pull) and roll, throttle -1..1.
    read() {
      let pitch = 0, roll = 0, throttle = 0;
      if (keys.has('arrowup')) pitch += 1;
      if (keys.has('arrowdown')) pitch -= 1;
      if (keys.has('w')) throttle += 1;
      if (keys.has('s')) throttle -= 1;
      if (keys.has('arrowleft') || keys.has('a')) roll -= 1;
      if (keys.has('arrowright') || keys.has('d')) roll += 1;
      if (mouse.active) {
        // Mouse: left/right banks, up/down pitches (gentle, half authority).
        roll += mouse.x * 0.7;
        pitch += -mouse.y * 0.6;
      }
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
        throttle: Math.max(-1, Math.min(1, throttle)),
      };
    },
    pressed(key) { return keys.has(key); },
    consume(key) { const had = keys.has(key); keys.delete(key); return had; },
  };
}
