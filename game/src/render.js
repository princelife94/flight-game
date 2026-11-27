// Skyline Run — everything the player sees (v2 visuals).
// A chase view: the camera sits behind and above the jet, looking along
// its heading. Layered ridge silhouettes and haze give the terrain depth,
// the jet is a detailed focal point low-centre, and the HUD is one
// consistent aviation panel set: ALT / SPD / HDG, score, rings, throttle
// and fuel gauges, and an attitude indicator.
import { CFG, RINGS, RUNWAY } from './config.js';
import { terrainHeight, terrainColor, dapple } from './world.js';

const FOCAL = 620; // px, perspective strength

// Project a world point into screen space from the camera.
// Returns null when behind the camera.
function project(px, py, pz, cam, w, h) {
  const dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z;
  const sin = Math.sin(cam.heading), cos = Math.cos(cam.heading);
  // Camera space: right = (cos, sin), forward = (sin, -cos) in (x, z).
  const rx = dx * cos + dz * sin;
  const ry = dy;
  const rz = dx * sin - dz * cos;
  // Apply pitch: rotate around the camera's x axis.
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const ry2 = ry * cp - rz * sp;
  const rz2 = ry * sp + rz * cp;
  if (rz2 < 8) return null;
  const s = FOCAL / rz2;
  return { x: w / 2 + rx * s, y: h * 0.42 - ry2 * s, d: rz2 };
}

// --- colour helpers -------------------------------------------------------
function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mixRgb(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function shadeHex(hex, f) {
  const c = hexRgb(hex);
  return `rgb(${Math.min(255, Math.round(c[0] * f))},${Math.min(255, Math.round(c[1] * f))},${Math.min(255, Math.round(c[2] * f))})`;
}
const HAZE = [198, 216, 226]; // atmospheric haze toward the horizon

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- sky ------------------------------------------------------------------
// Deterministic puffy clouds: each is a cluster of shaded ellipses.
const CLOUDS = [
  { u: 0.06, v: 0.10, s: 1.15, a: 0.92 }, { u: 0.30, v: 0.07, s: 0.85, a: 0.85 },
  { u: 0.52, v: 0.13, s: 1.35, a: 0.95 }, { u: 0.74, v: 0.08, s: 0.95, a: 0.88 },
  { u: 0.90, v: 0.16, s: 1.05, a: 0.90 }, { u: 0.18, v: 0.20, s: 0.70, a: 0.75 },
  { u: 0.44, v: 0.22, s: 0.80, a: 0.78 }, { u: 0.66, v: 0.24, s: 0.60, a: 0.70 },
  { u: 0.84, v: 0.30, s: 0.75, a: 0.72 },
];

function drawCloud(ctx, cx, cy, s, alpha) {
  // A puff: shaded base with bright tops, so clouds read as volumes.
  ctx.save();
  ctx.globalAlpha = alpha;
  const puffs = [
    [0, 6, 46, 15], [-38, 10, 32, 12], [38, 10, 34, 12], [-16, -6, 30, 13], [18, -4, 28, 12],
  ];
  for (const [ox, oy, rx, ry] of puffs) {
    const g = ctx.createLinearGradient(cx + ox * s, cy + (oy - ry) * s, cx + ox * s, cy + (oy + ry) * s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d7e2ea');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx + ox * s, cy + oy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSky(ctx, w, h, pitch, roll, horizonY) {
  // Deeper sky: rich zenith blue fading to pale warm haze at the horizon.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1c5ca6');
  g.addColorStop(0.35, '#5d9bd3');
  g.addColorStop(0.55, '#a8c8e2');
  g.addColorStop(0.68, '#dbe7e6');
  g.addColorStop(1, '#f0e6c6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun: soft layered glow, no hard disc edge.
  const sunX = w * 0.78, sunY = h * 0.13 - pitch * 140;
  const sg = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 190);
  sg.addColorStop(0, 'rgba(255,250,220,0.98)');
  sg.addColorStop(0.12, 'rgba(255,240,190,0.75)');
  sg.addColorStop(0.4, 'rgba(255,222,130,0.28)');
  sg.addColorStop(1, 'rgba(255,222,130,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 190, sunY - 190, 380, 380);
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath(); ctx.arc(sunX, sunY, 17, 0, Math.PI * 2); ctx.fill();
  // High wispy cirrus.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const cy = h * (0.05 + i * 0.03) - pitch * 160;
    ctx.beginPath();
    ctx.moveTo(w * (0.08 + i * 0.2), cy);
    ctx.bezierCurveTo(w * (0.3 + i * 0.15), cy - 8, w * (0.55 + i * 0.1), cy + 6, w * (0.85 - i * 0.1), cy - 4);
    ctx.stroke();
  }
  // Puffy clouds, drifting gently with roll.
  for (const c of CLOUDS) {
    const cx = c.u * w - roll * 36 + Math.sin(c.u * 40) * 12;
    const cy = c.v * h - pitch * 220;
    if (cy < -40 || cy > horizonY + 40) continue;
    drawCloud(ctx, cx, cy, c.s, c.a);
  }
  // Warm haze band hugging the horizon.
  const hg = ctx.createLinearGradient(0, horizonY - 70, 0, horizonY + 30);
  hg.addColorStop(0, 'rgba(232,238,230,0)');
  hg.addColorStop(0.6, 'rgba(232,238,230,0.45)');
  hg.addColorStop(1, 'rgba(232,238,230,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizonY - 70, w, 100);
}

// Distant mountain silhouettes, layered in cool blue-gray, sampled from
// the same heightfield the terrain uses so they agree with the ground.
function drawRidges(ctx, cam, w, h, horizonY) {
  const layers = [
    { d: 4200, color: 'rgba(143,168,192,0.50)' },
    { d: 2700, color: 'rgba(111,138,165,0.62)' },
  ];
  for (const { d, color } of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, horizonY + 2);
    let first = true;
    for (let a = -0.95; a <= 0.95; a += 0.05) {
      const ang = cam.heading + a;
      const wx = cam.x + Math.sin(ang) * d;
      const wz = cam.z - Math.cos(ang) * d;
      const wy = terrainHeight(wx, wz);
      const p = project(wx, wy, wz, cam, w, h);
      const y = p ? Math.min(p.y, horizonY + 2) : horizonY + 2;
      const x = p ? p.x : (w / 2 + a * w);
      if (first) { ctx.lineTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTerrain(ctx, cam, w, h) {
  // Grid of quads in front of the camera, far rows first.
  const cols = 26, rows = 18, step = 90;
  const sin = Math.sin(cam.heading), cos = Math.cos(cam.heading);
  for (let r = rows - 1; r >= 0; r--) {
    const zc = 20 + r * step;
    // Atmospheric haze grows with distance: far ground melts into the sky.
    const hazeT = Math.min(0.55, Math.max(0, (zc - 250) / 1500));
    for (let c = 0; c < cols; c++) {
      const xc = (c - cols / 2) * step;
      const pts = [];
      let ok = true;
      for (const [ox, oz] of [[0, 0], [step, 0], [step, step], [0, step]]) {
        const lx = xc + ox, lz = zc + oz;
        const wx = cam.x + lx * cos + lz * sin;
        const wz = cam.z + lx * sin - lz * cos;
        const wy = terrainHeight(wx, wz);
        const p = project(wx, wy, wz, cam, w, h);
        if (!p) { ok = false; break; }
        pts.push(p);
      }
      if (!ok) continue;
      const mx = cam.x + (xc + step / 2) * cos + (zc + step / 2) * sin;
      const mz = cam.z + (xc + step / 2) * sin - (zc + step / 2) * cos;
      const mh = terrainHeight(mx, mz);
      const inRunway = Math.abs(mx - RUNWAY.x) < RUNWAY.width / 2
        && mz > RUNWAY.z0 && mz < RUNWAY.z1;
      if (inRunway) {
        ctx.fillStyle = mixRgb(hexRgb('#3a3f45'), HAZE, hazeT);
      } else {
        const base = shadeHex(terrainColor(mx, mz, mh), dapple(mx, mz));
        const rgb = base.slice(4, -1).split(',').map(Number);
        ctx.fillStyle = mixRgb(rgb, HAZE, hazeT);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      if (inRunway) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        ctx.lineTo((pts[3].x + pts[2].x) / 2, (pts[3].y + pts[2].y) / 2);
        ctx.stroke();
      }
    }
  }
  // Soft cloud shadows drifting over the ground.
  for (const c of CLOUDS.slice(0, 4)) {
    const cx = c.u * w + 90;
    const cy = h * (0.62 + (c.v * 0.5));
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150 * c.s);
    g.addColorStop(0, 'rgba(26,47,69,0.10)');
    g.addColorStop(1, 'rgba(26,47,69,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.6, 0.55);
    ctx.beginPath(); ctx.arc(0, 0, 150 * c.s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawRunway(ctx, cam, w, h) {
  // The strip itself, drawn as a projected ribbon on the flattened ground.
  const ptsL = [], ptsR = [];
  for (let z = RUNWAY.z1; z >= RUNWAY.z0; z -= 40) {
    ptsL.push(project(RUNWAY.x - RUNWAY.width / 2, 0.4, z, cam, w, h));
    ptsR.push(project(RUNWAY.x + RUNWAY.width / 2, 0.4, z, cam, w, h));
  }
  if (ptsL.some((p) => !p) || ptsR.some((p) => !p)) return;
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath();
  ctx.moveTo(ptsL[0].x, ptsL[0].y);
  for (const p of ptsL) ctx.lineTo(p.x, p.y);
  for (let i = ptsR.length - 1; i >= 0; i--) ctx.lineTo(ptsR[i].x, ptsR[i].y);
  ctx.closePath();
  ctx.fill();
  // Threshold bars and dashed centre line.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  for (let z = RUNWAY.z1; z >= RUNWAY.z0; z -= 40) {
    const p = project(RUNWAY.x, 0.5, z, cam, w, h);
    if (!p) continue;
    if (z === RUNWAY.z1) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRing(ctx, ring, cam, w, h, next, showLabel, dist, index) {
  const [rx, ry, rz] = ring;
  const n = 28;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = rx + Math.cos(a) * CFG.ringRadius;
    const py = ry + Math.sin(a) * CFG.ringRadius;
    pts.push(project(px, py, rz, cam, w, h));
  }
  if (pts.some((p) => !p)) return;
  const centre = project(rx, ry, rz, cam, w, h);
  // Faint dotted guide from the flight-path marker toward the next ring.
  if (next && centre) {
    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 10]);
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.42);
    ctx.lineTo(centre.x, centre.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Dimensional ring: soft outer glow, bright sunlit top half, shaded
  // lower half, and a thin inner highlight so it reads as a solid target.
  ctx.lineJoin = 'round';
  const trace = (a0, a1) => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = a0 + (a1 - a0) * (i / 24);
      const px = rx + Math.cos(a) * CFG.ringRadius;
      const py = ry + Math.sin(a) * CFG.ringRadius;
      const p = project(px, py, rz, cam, w, h);
      if (!p) return;
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = next ? 'rgba(255,180,0,0.28)' : 'rgba(255,180,0,0.16)';
  ctx.lineWidth = next ? 14 : 9;
  trace(0, Math.PI * 2);
  ctx.strokeStyle = next ? '#ffd34d' : 'rgba(255,211,77,0.55)';
  ctx.lineWidth = next ? 7 : 4;
  trace(Math.PI, Math.PI * 2); // upper half, sunlit
  ctx.strokeStyle = next ? '#e08a00' : 'rgba(224,138,0,0.55)';
  trace(0, Math.PI); // lower half, shaded
  ctx.strokeStyle = next ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  trace(Math.PI * 1.05, Math.PI * 1.95);
  // Label and distance above the next ring.
  if (next && showLabel && centre && centre.x > 60 && centre.x < w - 60 && centre.y > 110) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText('NEXT RING', centre.x, centre.y - 46);
    ctx.fillStyle = '#3d2b00';
    ctx.fillText('NEXT RING', centre.x, centre.y - 46);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(20,30,40,0.7)';
    ctx.lineWidth = 3;
    const label = `RING ${index + 1} · ${Math.max(0, Math.round(dist))}m`;
    ctx.strokeText(label, centre.x, centre.y - 26);
    ctx.fillText(label, centre.x, centre.y - 26);
    ctx.textAlign = 'left';
  }
}

function drawJet(ctx, w, h, roll, speed, time) {
  // Chase view: a larger, detailed jet low-centre, banking with the roll,
  // with contrails streaming off the wingtips.
  const cx = w / 2 - roll * 26, cy = h * 0.70;
  const s = Math.min(w, h) / 520;
  // Contrails: tapered, fading trails behind the wingtips.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll * 1.0);
  ctx.scale(s, s);
  const trail = Math.min(1, speed / CFG.maxSpeed);
  for (const side of [-1, 1]) {
    const wx = side * 138, wy = 44;
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      const len = 64 * trail * (1 - t * 0.25);
      const wob = Math.sin(time * 2 + k * 1.3 + side) * 3 * t;
      const out = side * 10 * t; // trails drift slightly outward
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - t) * trail})`;
      ctx.lineWidth = 6 - t * 4.5;
      ctx.beginPath();
      ctx.moveTo(wx, wy + t * len * 0.3);
      ctx.quadraticCurveTo(wx + wob, wy + len * (0.5 + t * 0.3), wx + out + wob * 2, wy + len);
      ctx.stroke();
    }
  }
  // Engine glow grows with speed.
  const glow = 0.4 + (speed / CFG.maxSpeed) * 0.6;
  const eg = ctx.createRadialGradient(0, 52, 2, 0, 52, 26);
  eg.addColorStop(0, `rgba(255,200,110,${0.8 * glow})`);
  eg.addColorStop(0.5, `rgba(255,150,50,${0.35 * glow})`);
  eg.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.ellipse(0, 52, 18, 14 + 20 * glow, 0, 0, Math.PI * 2); ctx.fill();
  // Wings: shaded upper surfaces with dark trailing edges.
  for (const side of [-1, 1]) {
    const wg = ctx.createLinearGradient(0, 0, 0, 56);
    wg.addColorStop(0, '#e6e9ed');
    wg.addColorStop(1, '#a9aeb6');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(side * 14, 6);
    ctx.lineTo(side * 152, 34);
    ctx.lineTo(side * 140, 54);
    ctx.lineTo(side * 10, 26);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7c828b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(side * 14, 8); ctx.lineTo(side * 150, 36);
    ctx.stroke();
    // Roundel on the wing.
    ctx.fillStyle = '#2f6db3';
    ctx.beginPath(); ctx.arc(side * 96, 30, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(side * 96, 30, 3.5, 0, Math.PI * 2); ctx.fill();
    // Wingtip navigation light: red port, green starboard.
    ctx.fillStyle = side < 0 ? '#ff3b30' : '#2ee66b';
    ctx.beginPath(); ctx.arc(side * 148, 42, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Tailplanes and fin.
  ctx.fillStyle = '#9aa0a8';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, 34); ctx.lineTo(side * 52, 66); ctx.lineTo(side * 40, 70); ctx.lineTo(side * 6, 44);
    ctx.closePath(); ctx.fill();
  }
  const fin = ctx.createLinearGradient(0, 26, 0, 66);
  fin.addColorStop(0, '#d8433a'); fin.addColorStop(1, '#8f1f18');
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(0, 22); ctx.lineTo(-10, 64); ctx.lineTo(10, 64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('7', 0, 52);
  // Fuselage: shaded metal with a darker spine and panel lines.
  const fg = ctx.createLinearGradient(-12, 0, 12, 0);
  fg.addColorStop(0, '#7e848c'); fg.addColorStop(0.35, '#e8ebee'); fg.addColorStop(0.65, '#c9ced4'); fg.addColorStop(1, '#7e848c');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -82);
  ctx.quadraticCurveTo(13, -30, 11, 30);
  ctx.quadraticCurveTo(10, 54, 0, 58);
  ctx.quadraticCurveTo(-10, 54, -11, 30);
  ctx.quadraticCurveTo(-13, -30, 0, -82);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,96,104,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(10, 14); ctx.stroke();
  // Nose cone.
  ctx.fillStyle = '#5d646d';
  ctx.beginPath();
  ctx.moveTo(0, -82);
  ctx.quadraticCurveTo(7, -64, 6, -52);
  ctx.quadraticCurveTo(0, -48, -6, -52);
  ctx.quadraticCurveTo(-7, -64, 0, -82);
  ctx.fill();
  // Canopy with frame and glint.
  ctx.fillStyle = '#1d3a56';
  ctx.beginPath();
  ctx.ellipse(0, -38, 7.5, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9ced4';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, -38, 7.5, 21, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-2.5, -47, 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Fuselage roundel.
  ctx.fillStyle = '#2f6db3';
  ctx.beginPath(); ctx.arc(0, 8, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8433a';
  ctx.beginPath(); ctx.arc(0, 8, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- HUD: one consistent aviation panel set -------------------------------
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6,12,20,0.62)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
}

function gauge(ctx, x, y, w, frac, color, label, value) {
  ctx.fillStyle = '#cfe4ef';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(value, x + w, y - 6);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, x, y, w, 10, 5);
  ctx.fill();
  ctx.fillStyle = color;
  const fw = Math.max(10, (w - 2) * Math.max(0, Math.min(1, frac)));
  roundRect(ctx, x + 1, y + 1, fw, 8, 4);
  ctx.fill();
}

function drawHUD(ctx, f, w, h) {
  const alt = Math.max(0, Math.round(f.y));
  const spd = Math.round(f.speed * 3.6);
  const hdg = ((Math.round(-f.heading * 180 / Math.PI) % 360) + 360) % 360;
  // Top instrument strip: aligned ALT / SPD / HDG groups, score on the right.
  ctx.fillStyle = 'rgba(6,12,20,0.66)';
  ctx.fillRect(0, 0, w, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 64.5); ctx.lineTo(w, 64.5); ctx.stroke();
  const groups = [
    { label: 'ALTITUDE', value: `${alt}`, unit: 'M', x: 24 },
    { label: 'AIRSPEED', value: `${spd}`, unit: 'KM/H', x: 300 },
    { label: 'HEADING', value: String(hdg).padStart(3, '0'), unit: '°', x: 576 },
  ];
  ctx.textAlign = 'left';
  for (const g of groups) {
    ctx.fillStyle = '#8fb4cc';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(g.label, g.x, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(g.value, g.x, 50);
    const vw = ctx.measureText(g.value).width;
    ctx.fillStyle = '#8fb4cc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(g.unit, g.x + vw + 8, 50);
  }
  // Dividers between groups.
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  for (const x of [268, 544]) {
    ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 52); ctx.stroke();
  }
  // Score and rings, right side of the strip.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fb4cc';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('SCORE', w - 200, 20);
  ctx.fillText('RINGS', w - 24, 20);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(`${f.score}`, w - 200, 50);
  ctx.fillStyle = '#9fe870';
  ctx.fillText(`${f.rings} / 8`, w - 24, 50);
  ctx.textAlign = 'left';
  // Compass tape under the strip.
  ctx.fillStyle = 'rgba(6,12,20,0.45)';
  ctx.fillRect(0, 64, w, 26);
  ctx.fillStyle = '#cfe4ef';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let d = -75; d <= 75; d += 15) {
    const a = ((hdg + d) % 360 + 360) % 360;
    const x = w / 2 + d * 4.4;
    const major = a % 45 === 0;
    ctx.fillStyle = major ? '#fff' : '#9db8c9';
    ctx.font = major ? 'bold 13px monospace' : '12px monospace';
    ctx.fillText(major ? names[Math.round(a / 45) % 8] : String(a), x, 82);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x, 66, 1, major ? 6 : 3);
  }
  // Centre caret on the tape.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 90); ctx.lineTo(w / 2 + 6, 90); ctx.lineTo(w / 2, 97);
  ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left';
  // Throttle and fuel gauges, bottom left, in one panel.
  panel(ctx, 16, h - 122, 216, 106);
  gauge(ctx, 28, h - 100, 192, f.throttle, '#ff9d2e', 'THR', `${Math.round(f.throttle * 100)}%`);
  gauge(ctx, 28, h - 58, 192, f.fuel / CFG.fuelMax, f.fuel < 25 ? '#e5484d' : '#4caf50', 'FUEL', `${Math.round(f.fuel)}%`);
  // Attitude indicator, bottom right, in a labelled panel.
  const ax = w - 172, ay = h - 146, aw = 156, ah = 130;
  panel(ctx, ax, ay, aw, ah);
  ctx.fillStyle = '#8fb4cc';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ax + aw / 2, ay + 15);
  const hx = ax + aw / 2, hy = ay + 68, hr = 40;
  ctx.save();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-f.roll);
  ctx.translate(0, f.pitch * 130);
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-hr - 4, -hr - 4, (hr + 4) * 2, hr + 4);
  ctx.fillStyle = '#8a6b46'; ctx.fillRect(-hr - 4, 0, (hr + 4) * 2, hr + 4);
  // Pitch ladder.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  for (const dy of [-22, -11, 11, 22]) {
    ctx.beginPath();
    ctx.moveTo(-18, dy); ctx.lineTo(18, dy); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
  // Fixed aircraft symbol and bank pointer.
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hx - 26, hy); ctx.lineTo(hx - 8, hy);
  ctx.moveTo(hx + 8, hy); ctx.lineTo(hx + 26, hy);
  ctx.moveTo(hx, hy - 4); ctx.lineTo(hx, hy + 4);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-f.roll);
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(0, -hr - 2); ctx.lineTo(-5, -hr - 10); ctx.lineTo(5, -hr - 10);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#8fb4cc';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`BANK ${Math.round(-f.roll * 180 / Math.PI)}°`, hx, ay + ah - 8);
  ctx.textAlign = 'left';
  // Flight-path marker: circle with side ticks where the jet is heading.
  const mx = w / 2, my = h * 0.42;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx - 24, my); ctx.lineTo(mx - 13, my);
  ctx.moveTo(mx + 13, my); ctx.lineTo(mx + 24, my);
  ctx.moveTo(mx, my + 13); ctx.lineTo(mx, my + 20);
  ctx.stroke();
  // Flash message in a pill.
  if (f.messageT > 0) {
    ctx.font = 'bold 26px sans-serif';
    const tw = ctx.measureText(f.message).width;
    ctx.fillStyle = 'rgba(6,12,20,0.62)';
    roundRect(ctx, w / 2 - tw / 2 - 18, h * 0.28 - 32, tw + 36, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.fillText(f.message, w / 2, h * 0.28);
    ctx.textAlign = 'left';
  }
}

function drawTitle(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,16,28,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SKYLINE RUN', w / 2, h * 0.3);
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 130, h * 0.3 + 18); ctx.lineTo(w / 2 + 130, h * 0.3 + 18);
  ctx.stroke();
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('Fly the ring course. Land on the runway. Mind the fuel.', w / 2, h * 0.3 + 56);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('W / S throttle   ·   Arrow keys steer   ·   Mouse steers too', w / 2, h * 0.3 + 108);
  ctx.fillText('Click or press Enter to fly — R restarts, P pauses, M mutes', w / 2, h * 0.3 + 138);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, f, w, h, title, sub) {
  ctx.fillStyle = 'rgba(8,16,28,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, w / 2, h * 0.38);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText(sub, w / 2, h * 0.38 + 44);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Score ${f.score}  ·  Rings ${f.rings}  ·  Press R to fly again`, w / 2, h * 0.38 + 84);
  ctx.textAlign = 'left';
}

export function render(ctx, f, scene, w, h) {
  const cam = {
    x: f.x - Math.sin(f.heading) * 26,
    y: f.y + 9,
    z: f.z + Math.cos(f.heading) * 26,
    heading: f.heading, pitch: f.pitch * 0.6,
  };
  // Horizon line for the sky, ridges and haze band.
  const far = project(cam.x + Math.sin(cam.heading) * 4000, cam.y, cam.z - Math.cos(cam.heading) * 4000, cam, w, h);
  const horizonY = far ? far.y : h * 0.42;
  drawSky(ctx, w, h, f.pitch, f.roll, horizonY);
  drawRidges(ctx, cam, w, h, horizonY);
  drawTerrain(ctx, cam, w, h);
  drawRunway(ctx, cam, w, h);
  // Rings, nearest first so the next one draws on top.
  const order = RINGS.map((r, i) => ({ r, i })).sort((a, b) => {
    const da = (a.r[0] - f.x) ** 2 + (a.r[2] - f.z) ** 2;
    const db = (b.r[0] - f.x) ** 2 + (b.r[2] - f.z) ** 2;
    return da - db;
  });
  for (const { r, i } of order) {
    const dx = r[0] - f.x, dy = r[1] - f.y, dz = r[2] - f.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    drawRing(ctx, r, cam, w, h, i === f.ringIndex, scene !== 'title', dist, i);
  }
  drawJet(ctx, w, h, f.roll, f.speed, f.time);
  drawHUD(ctx, f, w, h);
  if (scene === 'title') drawTitle(ctx, w, h);
  if (f.crashed) drawEnd(ctx, f, w, h, 'CRASHED', f.crashReason);
  if (f.landed) drawEnd(ctx, f, w, h, 'LANDED', 'Runway landing complete — sortie finished');
}
