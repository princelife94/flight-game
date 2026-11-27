// Skyline Run — everything the player sees.
// A chase view: the camera sits behind and above the jet, looking along
// its heading. Terrain is a projected heightfield drawn back to front,
// the jet is drawn in frame, and the HUD carries altitude, speed,
// heading, fuel, throttle, score and the next ring.
import { CFG, RINGS, RUNWAY } from './config.js';
import { terrainHeight, terrainColor } from './world.js';

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

function drawSky(ctx, w, h, pitch, roll) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2f6db3');
  g.addColorStop(0.45, '#7fb2dd');
  g.addColorStop(0.62, '#cfe4ef');
  g.addColorStop(1, '#e8e2c8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  const sunX = w * 0.78, sunY = h * 0.16 - pitch * 120;
  const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
  sg.addColorStop(0, 'rgba(255,244,200,0.95)');
  sg.addColorStop(0.3, 'rgba(255,226,140,0.55)');
  sg.addColorStop(1, 'rgba(255,226,140,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
  // Drifting clouds.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 397 + 120) % 1400) / 1400 * w - roll * 30;
    const cy = h * (0.10 + (i % 3) * 0.07) - pitch * 200;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 + (i % 3) * 25, 16 + (i % 2) * 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain(ctx, cam, w, h) {
  // Grid of quads in front of the camera, far rows first.
  const cols = 26, rows = 18, step = 90;
  const sin = Math.sin(cam.heading), cos = Math.cos(cam.heading);
  for (let r = rows - 1; r >= 0; r--) {
    const zc = 20 + r * step;
    for (let c = 0; c < cols; c++) {
      const xc = (c - cols / 2) * step;
      // Four corners of this quad, in world space.
      const pts = [];
      let ok = true;
      for (const [ox, oz] of [[0, 0], [step, 0], [step, step], [0, step]]) {
        const lx = xc + ox, lz = zc + oz;
        // Local +z is forward: world = cam + right*lx + forward*lz.
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
      ctx.fillStyle = inRunway ? '#3a3f45' : terrainColor(mx, mz, mh);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      if (inRunway) {
        // Runway centre line.
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        ctx.lineTo((pts[3].x + pts[2].x) / 2, (pts[3].y + pts[2].y) / 2);
        ctx.stroke();
      }
    }
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
  // Dashed centre line.
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

function drawRing(ctx, ring, cam, w, h, next, showLabel) {
  const [rx, ry, rz] = ring;
  const n = 28;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Ring faces along the course (roughly towards the camera's heading).
    const px = rx + Math.cos(a) * CFG.ringRadius;
    const py = ry + Math.sin(a) * CFG.ringRadius;
    pts.push(project(px, py, rz, cam, w, h));
  }
  if (pts.some((p) => !p)) return;
  ctx.lineWidth = next ? 7 : 4;
  ctx.strokeStyle = next ? '#ffb400' : 'rgba(255,180,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.fillStyle = next ? '#fff3c4' : 'rgba(255,243,196,0.5)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  // Label at the top of the ring (angle +90 deg is the top point).
  const top = pts[Math.floor(n / 4)];
  if (next && showLabel && top.x > 40 && top.x < w - 40 && top.y > 90) {
    ctx.font = 'bold 16px sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText('NEXT RING', top.x, top.y - 12);
    ctx.fillStyle = '#3d2b00';
    ctx.fillText('NEXT RING', top.x, top.y - 12);
  }
}

function drawJet(ctx, w, h, roll, speed) {
  // Chase view: the jet sits low-centre, banking with the roll.
  const cx = w / 2, cy = h * 0.68;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll * 0.9);
  const s = Math.min(w, h) / 620;
  ctx.scale(s, s);
  // Engine glow grows with speed.
  const glow = 0.4 + (speed / CFG.maxSpeed) * 0.6;
  ctx.fillStyle = `rgba(255,170,60,${0.35 * glow})`;
  ctx.beginPath();
  ctx.ellipse(0, 46, 16, 10 + 18 * glow, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings.
  ctx.fillStyle = '#c8ccd2';
  ctx.beginPath();
  ctx.moveTo(-14, 6); ctx.lineTo(-150, 34); ctx.lineTo(-138, 52); ctx.lineTo(-10, 26);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6); ctx.lineTo(150, 34); ctx.lineTo(138, 52); ctx.lineTo(10, 26);
  ctx.closePath(); ctx.fill();
  // Tail.
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(-8, 34); ctx.lineTo(-52, 66); ctx.lineTo(-40, 70); ctx.lineTo(-6, 44);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 34); ctx.lineTo(52, 66); ctx.lineTo(40, 70); ctx.lineTo(6, 44);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(0, 26); ctx.lineTo(-9, 62); ctx.lineTo(9, 62);
  ctx.closePath(); ctx.fill();
  // Fuselage.
  const fg = ctx.createLinearGradient(-12, 0, 12, 0);
  fg.addColorStop(0, '#8f959c'); fg.addColorStop(0.5, '#e8ebee'); fg.addColorStop(1, '#8f959c');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.quadraticCurveTo(13, -30, 11, 30);
  ctx.quadraticCurveTo(10, 52, 0, 56);
  ctx.quadraticCurveTo(-10, 52, -11, 30);
  ctx.quadraticCurveTo(-13, -30, 0, -78);
  ctx.fill();
  // Canopy.
  ctx.fillStyle = '#274b6d';
  ctx.beginPath();
  ctx.ellipse(0, -38, 7, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, -46, 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Roundel.
  ctx.fillStyle = '#2f6db3';
  ctx.beginPath(); ctx.arc(0, 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, frac)), h - 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h / 2 + 4);
}

function drawHUD(ctx, f, w, h) {
  ctx.textAlign = 'left';
  // Top instrument strip.
  ctx.fillStyle = 'rgba(8,14,22,0.62)';
  ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px monospace';
  const alt = Math.max(0, Math.round(f.y));
  const spd = Math.round(f.speed * 3.6);
  const hdg = ((Math.round(-f.heading * 180 / Math.PI) % 360) + 360) % 360;
  ctx.fillText(`ALT ${alt}m`, 18, 40);
  ctx.fillText(`SPD ${spd}km/h`, 230, 40);
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 470, 40);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText(`SCORE ${f.score}`, 700, 38);
  ctx.fillStyle = '#9fe870';
  ctx.fillText(`RINGS ${f.rings}`, 880, 38);
  // Compass tape.
  ctx.fillStyle = '#cfe4ef';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const a = ((hdg + d) % 360 + 360) % 360;
    const x = w / 2 + d * 4;
    ctx.fillText(a % 45 === 0 ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8] : String(a), x, 82);
  }
  // Artificial horizon, bottom right.
  const hx = w - 90, hy = h - 90, hr = 52;
  ctx.save();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-f.roll);
  ctx.translate(0, f.pitch * 120);
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-hr, -hr, hr * 2, hr);
  ctx.fillStyle = '#8a6b46'; ctx.fillRect(-hr, 0, hr * 2, hr);
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 30, hy); ctx.lineTo(hx + 30, hy); ctx.stroke();
  // Throttle and fuel, bottom left.
  bar(ctx, 18, h - 96, 170, 20, f.throttle, '#ff9d2e', 'THR');
  bar(ctx, 18, h - 68, 170, 20, f.fuel / CFG.fuelMax, f.fuel < 25 ? '#e5484d' : '#4caf50', 'FUEL');
  // Centre crosshair.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 14, h * 0.42); ctx.lineTo(w / 2 + 14, h * 0.42);
  ctx.moveTo(w / 2, h * 0.42 - 14); ctx.lineTo(w / 2, h * 0.42 + 14);
  ctx.stroke();
  // Flash message.
  if (f.messageT > 0) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.message, w / 2, h * 0.3);
  }
  ctx.textAlign = 'left';
}

function drawTitle(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,16,28,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SKYLINE RUN', w / 2, h * 0.3);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('Fly the ring course. Land on the runway. Mind the fuel.', w / 2, h * 0.3 + 44);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('W / S throttle   ·   Arrow keys steer   ·   Mouse steers too', w / 2, h * 0.3 + 96);
  ctx.fillText('Click or press Enter to fly — R restarts, P pauses, M mutes', w / 2, h * 0.3 + 126);
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
  drawSky(ctx, w, h, f.pitch, f.roll);
  drawTerrain(ctx, cam, w, h);
  drawRunway(ctx, cam, w, h);
  // Rings, nearest first so the next one draws on top.
  const order = RINGS.map((r, i) => ({ r, i })).sort((a, b) => {
    const da = (a.r[0] - f.x) ** 2 + (a.r[2] - f.z) ** 2;
    const db = (b.r[0] - f.x) ** 2 + (b.r[2] - f.z) ** 2;
    return da - db;
  });
  for (const { r, i } of order) drawRing(ctx, r, cam, w, h, i === f.ringIndex, scene !== 'title');
  drawJet(ctx, w, h, f.roll, f.speed);
  drawHUD(ctx, f, w, h);
  if (scene === 'title') drawTitle(ctx, w, h);
  if (f.crashed) drawEnd(ctx, f, w, h, 'CRASHED', f.crashReason);
  if (f.landed) drawEnd(ctx, f, w, h, 'LANDED', 'Runway landing complete — sortie finished');
}
