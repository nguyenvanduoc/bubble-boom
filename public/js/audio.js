// ============================================================
// ÂM THANH TỔNG HỢP BẰNG Web Audio API (không cần file mp3)
// ============================================================
let ctx = null, muted = false;
const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

/** Phát 1 nốt: tần số f -> f2, dạng sóng type, dài dur giây */
function tone(f, dur, type = 'sine', vol = 0.15, f2 = f, delay = 0) {
  if (muted) return;
  const a = ac(), t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
/** Tiếng ồn trắng qua bộ lọc -> tiếng nước bắn / nổ */
function noise(dur, freq = 1200, vol = 0.25) {
  if (muted) return;
  const a = ac(), n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
}

export const sfx = {
  unlock: () => { try { ac(); } catch { /* trình duyệt chưa cho phép */ } },
  toggle: () => (muted = !muted),
  get muted() { return muted; },
  place: () => tone(420, 0.12, 'sine', 0.12, 260),
  boom: () => { noise(0.45, 900, 0.32); tone(160, 0.3, 'sine', 0.18, 50); },
  pick: () => { tone(660, 0.08, 'triangle', 0.12, 880); tone(990, 0.12, 'triangle', 0.12, 1320, 0.07); },
  trap: () => tone(300, 0.5, 'sine', 0.15, 700),
  pop: () => { tone(900, 0.08, 'square', 0.08, 200); noise(0.2, 3000, 0.15); },
  rescue: () => { tone(523, 0.1, 'triangle', 0.12); tone(784, 0.18, 'triangle', 0.12, 784, 0.09); },
  kick: () => tone(200, 0.1, 'square', 0.07, 120),
  count: () => tone(520, 0.12, 'square', 0.07),
  go: () => tone(880, 0.3, 'square', 0.08, 1100),
  drop: () => tone(120, 0.15, 'sawtooth', 0.06, 60),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, f, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, f * 0.97, i * 0.15)),
};
