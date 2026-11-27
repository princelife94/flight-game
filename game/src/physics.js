// Skyline Run — the flight model.
// A forgiving arcade model: throttle sets speed, pitch sets climb,
// bank turns the jet, and slow flight sinks. Fuel burns with throttle.
// Landing, crashing and ring passes are decided here.
import { CFG, RINGS, RUNWAY } from './config.js';
import { terrainHeight } from './world.js';

export function newFlight() {
  return {
    x: 0, y: CFG.startAlt, z: 60,
    heading: 0, pitch: 0, roll: 0,
    speed: CFG.cruiseSpeed, throttle: 0.6,
    fuel: CFG.fuelMax, score: 0, rings: 0,
    ringIndex: 0, crashed: false, landed: false, crashReason: '',
    message: '', messageT: 0, time: 0,
  };
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function stepFlight(f, input, dt) {
  if (f.crashed || f.landed) return;
  f.time += dt;

  // Throttle: W / Up arrow raises it, S / Down lowers it.
  f.throttle = clamp(f.throttle + input.throttle * dt * 0.7, 0, 1);
  const target = f.throttle * CFG.maxSpeed;
  f.speed += ((target - f.speed) * (1 - Math.exp(-dt * 0.9))
    - f.speed * CFG.drag * dt * 0.25);
  f.speed = clamp(f.speed, 0, CFG.maxSpeed);

  // Pitch and bank follow the stick; bank turns the heading.
  const wantPitch = clamp(-input.pitch * CFG.maxPitch, -CFG.maxPitch, CFG.maxPitch);
  const wantRoll = clamp(input.roll * CFG.maxBank, -CFG.maxBank, CFG.maxBank);
  f.pitch += (wantPitch - f.pitch) * (1 - Math.exp(-dt * 3.5));
  f.roll += (wantRoll - f.roll) * (1 - Math.exp(-dt * CFG.rollRate));
  f.heading += -Math.sin(f.roll) * CFG.turnRate * (f.speed / CFG.cruiseSpeed) * dt;

  // Forward motion, climb from pitch, sink when too slow to fly.
  const vy = Math.sin(f.pitch) * f.speed * CFG.climbRate
    - (f.speed < CFG.minFlySpeed ? (CFG.minFlySpeed - f.speed) * 0.9 : 0);
  f.y += vy * dt;
  f.x += Math.sin(f.heading) * Math.cos(f.pitch) * f.speed * dt;
  f.z -= Math.cos(f.heading) * Math.cos(f.pitch) * f.speed * dt;

  f.fuel = Math.max(0, f.fuel - f.throttle * CFG.fuelBurn * dt);
  if (f.fuel <= 0 && f.throttle > 0.15) f.throttle = 0.15;

  // Ring pass: crossing within the ring's radius scores.
  const ring = RINGS[f.ringIndex];
  const dx = f.x - ring[0], dy = f.y - ring[1], dz = f.z - ring[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < CFG.ringRadius) {
    f.score += CFG.ringScore;
    f.rings += 1;
    f.ringIndex = (f.ringIndex + 1) % RINGS.length;
    f.message = `RING! +${CFG.ringScore}`;
    f.messageT = 1.6;
    f.ringJustPassed = true;
  } else {
    f.ringJustPassed = false;
  }

  // Landing: over the runway, slow and gentle, close to the ground.
  const overRunway = Math.abs(f.x - RUNWAY.x) < RUNWAY.width / 2 + 4
    && f.z > RUNWAY.z0 && f.z < RUNWAY.z1;
  const ground = terrainHeight(f.x, f.z);
  if (overRunway && f.y - ground < 3 && f.speed < 45 && Math.abs(f.pitch) < 0.2) {
    f.landed = true;
    f.score += CFG.landBonus;
    f.message = `LANDED! +${CFG.landBonus} — fuel refilled`;
    f.messageT = 3;
    f.fuel = CFG.fuelMax;
    return;
  }

  // Crash: into the ground, or into the sea, or stalled into terrain.
  if (f.y <= ground + 1.5) {
    f.crashed = true;
    f.y = ground + 1.5;
    f.crashReason = ground < -2 ? 'Ditched in the sea' : 'Hit the terrain';
  }
  if (f.messageT > 0) f.messageT -= dt;
}
