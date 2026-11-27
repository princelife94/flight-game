// Skyline Run — tuning constants for the flight game.
// One place for every number the other modules share: speeds, the
// terrain layout, the ring course and the runway.
export const CFG = {
  maxSpeed: 95,        // m/s at full throttle
  minFlySpeed: 28,     // below this the wings stop flying and the jet sinks
  cruiseSpeed: 62,
  accel: 22,           // m/s^2 at full throttle
  drag: 0.12,          // proportional drag
  climbRate: 0.55,     // vertical speed per m/s of forward speed at full pitch
  turnRate: 0.55,      // rad/s of heading change at full bank
  rollRate: 2.2,       // rad/s the jet rolls toward the commanded bank
  maxBank: 1.1,        // rad, about 63 degrees
  maxPitch: 0.45,      // rad
  fuelMax: 100,
  fuelBurn: 0.55,      // per second at full throttle
  ringRadius: 20,
  ringScore: 100,
  landBonus: 250,
  startAlt: 55,
};

// The ring course: a loop out over the sea, round the mountain ridge and
// back down the valley to the runway. Each ring: [x, altitude, z].
export const RINGS = [
  [0, 70, -700],
  [420, 95, -1250],
  [950, 130, -800],
  [800, 90, 100],
  [250, 60, 750],
  [-450, 80, 500],
  [-800, 120, -350],
  [-350, 70, -950],
];

// Runway: a flat strip on the valley floor, pointing north (towards -z).
export const RUNWAY = {
  x: 0, z0: -520, z1: 120, width: 26, heading: 0,
};
