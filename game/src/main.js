// Skyline Run — game boot and the main loop.
// States: title → flying → crashed / landed → flying again (R).
// ?scene=title|cruise|ring|final picks a starting view (used for the
// screenshots); without it the game opens on the title screen.
import { newFlight, stepFlight } from './physics.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { SoundEngine } from './audio.js';
import { CFG } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = createInput(canvas);
const sound = new SoundEngine();

function fit() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(location.search);
const sceneParam = params.get('scene') || 'title';

let flight = newFlight();
let scene = 'title';
let paused = false;
let last = performance.now();
let wasLanded = false, wasCrashed = false;

function applyScene(name) {
  flight = newFlight();
  scene = 'flying';
  if (name === 'cruise') {
    flight.x = 150; flight.y = 95; flight.z = -450;
    flight.heading = 0.15; flight.speed = CFG.cruiseSpeed;
  } else if (name === 'ring') {
    flight.x = -5; flight.y = 74; flight.z = -630;
    flight.heading = 0.02; flight.speed = CFG.cruiseSpeed;
  } else if (name === 'final') {
    // On final approach, low throttle: the jet sinks gently onto the strip.
    flight.x = 0; flight.y = 22; flight.z = 260;
    flight.heading = 0; flight.speed = 40; flight.throttle = 0.25;
  } else {
    scene = 'title';
  }
}
applyScene(sceneParam);

function startFlying() {
  sound.ensure();
  if (scene === 'title' || flight.crashed || flight.landed) {
    flight = newFlight();
    scene = 'flying';
    wasLanded = false; wasCrashed = false;
  }
}

canvas.addEventListener('click', startFlying);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'enter' || k === ' ') startFlying();
  if (k === 'r') { flight = newFlight(); scene = 'flying'; wasLanded = false; wasCrashed = false; sound.ensure(); }
  if (k === 'p') paused = !paused;
  if (k === 'm') sound.setMuted(!sound.muted);
});

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && scene === 'flying') {
    const ctl = input.read();
    stepFlight(flight, ctl, dt);
    sound.update(flight.throttle, flight.speed);
    if (flight.ringJustPassed) sound.chime();
    if (flight.landed && !wasLanded) { sound.land(); wasLanded = true; }
    if (flight.crashed && !wasCrashed) { sound.crash(); wasCrashed = true; }
  }
  render(ctx, flight, scene, canvas.width, canvas.height);
  const hdg = ((Math.round(-flight.heading * 180 / Math.PI) % 360) + 360) % 360;
  status.textContent = scene === 'title'
    ? 'Skyline Run. Press Enter to fly.'
    : `Altitude ${Math.round(flight.y)} metres, speed ${Math.round(flight.speed * 3.6)} km/h, heading ${hdg} degrees, score ${flight.score}.`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
