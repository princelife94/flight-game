// Skyline Run — WebAudio sounds, generated, no audio files.
// Engine hum follows the throttle, a chime marks a ring, a low thud
// marks a landing and noise marks a crash. All of it starts only after
// the player first interacts, so browsers allow it.
export class SoundEngine {
  constructor() {
    this.ctx = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.windGain = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned sawtooths through a low-pass filter.
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 70;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 71.5;
    this.engineOsc.connect(filter); osc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start(); osc2.start();
    // Wind: looped noise whose gain follows airspeed.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(bp); bp.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    noise.start();
  }

  update(throttle, speed) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.09, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + throttle * 75 + speed * 0.4, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0012), t, 0.2);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  chime() { this.tone(880, 0.35); this.tone(1318, 0.5, 'sine', 0.18, 0.09); }
  land() { this.tone(220, 0.4, 'triangle', 0.25); this.tone(330, 0.5, 'triangle', 0.2, 0.12); }
  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
    this.tone(60, 0.6, 'sawtooth', 0.3);
  }

  setMuted(m) {
    this.muted = m;
    if (this.engineGain) this.engineGain.gain.value = m ? 0 : 0.08;
    if (this.windGain) this.windGain.gain.value = m ? 0 : 0.02;
  }
}
