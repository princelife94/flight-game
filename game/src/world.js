// Skyline Run — the island the game flies over.
// Procedural heightfield: sea to the west, farmland in the valley, a
// mountain ridge to the north and east, and a flattened runway strip.
// Colouring is by height and by field patch, so the ground reads as
// sea, beach, fields, forest, rock and snow from the air.
import { RUNWAY } from './config.js';

function smooth(t) { return t * t * (3 - 2 * t); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// Rolling hills: a few sines layered so no two valleys look alike.
function hills(x, z) {
  return Math.sin(x * 0.004 + 1.3) * Math.cos(z * 0.0032) * 16
    + Math.sin(x * 0.011 + 0.4) * Math.cos(z * 0.009 + 2.1) * 7
    + Math.sin((x + z) * 0.0016) * 10;
}

// Mountain ridge: strong where the mask is 1 (north and east), absent
// in the valley where the runway sits.
function ridgeMask(x, z) {
  const north = smooth(clamp((-z - 700) / 600, 0, 1));
  const east = smooth(clamp((x - 700) / 500, 0, 1));
  const west = smooth(clamp((-x - 1100) / 400, 0, 1));
  return Math.max(north, east, west * 0.8);
}

function ridge(x, z) {
  const m = ridgeMask(x, z);
  if (m <= 0) return 0;
  const peak = Math.sin(x * 0.006 + 2.0) * Math.cos(z * 0.005) * 55
    + Math.sin(x * 0.017) * Math.cos(z * 0.013 + 1.0) * 22;
  return m * Math.max(0, 40 + peak);
}

export function terrainHeight(x, z) {
  // Sea to the west of x = -650.
  if (x < -650) return -8;
  let h = hills(x, z) + ridge(x, z);
  if (x < -550) h = h * smooth(clamp((x + 650) / 100, 0, 1)) - 8 * (1 - smooth(clamp((x + 650) / 100, 0, 1)));
  // Inland ground never dips below sea level: valleys stay fields.
  if (x >= -550) h = Math.max(h, 2);
  // Flatten the runway strip so landings are possible.
  const dx = Math.abs(x - RUNWAY.x);
  const inZ = z > RUNWAY.z0 - 60 && z < RUNWAY.z1 + 60;
  if (inZ && dx < 90) {
    const f = smooth(clamp(1 - (dx - RUNWAY.width / 2) / 60, 0, 1));
    h = h * (1 - f);
  }
  return h;
}

// Patchwork fields: two cheap hashes so neighbouring field squares differ
// in both crop type and brightness.
function hash2(x, z, a, b) {
  const n = Math.sin(x * a + z * b) * 43758.5453;
  return n - Math.floor(n);
}

function fieldShade(x, z) {
  const fx = Math.floor(x / 90), fz = Math.floor(z / 90);
  return hash2(fx, fz, 127.1, 311.7);
}

// Sun dappling: slow brightness variation across the ground, so the
// terrain reads as lit hillsides and soft shadow rather than flat colour.
export function dapple(x, z) {
  return 0.90 + hash2(Math.floor(x / 260), Math.floor(z / 260), 71.3, 193.7) * 0.16;
}

export function terrainColor(x, z, h) {
  const s = fieldShade(x, z);
  const s2 = hash2(Math.floor(x / 90), Math.floor(z / 90), 269.5, 183.3);
  if (h < -2) return s2 < 0.5 ? '#2e6da8' : '#357ab6';   // sea
  if (h < 1.5) return '#d9c48a';                        // beach
  if (h > 95) return s2 < 0.5 ? '#eef2f5' : '#dfe9f0';   // snow
  if (h > 62) return s2 < 0.5 ? '#7d7468' : '#8d8578';   // rock
  if (h > 34) return s2 < 0.5 ? '#4d7a3d' : '#3f6b31';   // forest
  // Farmland: wheat, meadow, ploughed earth and dark crop, by patch.
  if (s < 0.14) return '#c2a95e';
  if (s < 0.30) return '#8fae4e';
  if (s < 0.46) return '#9a7b4a';
  if (s < 0.62) return '#6f9e46';
  if (s < 0.80) return '#5d8f3e';
  return '#a8b45a';
}

export function groundAt(x, z) { return terrainHeight(x, z); }
