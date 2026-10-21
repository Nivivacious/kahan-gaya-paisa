// One AudioContext for the page. The kite string reads `level()` every frame,
// so it moves with whoever is talking: the caller's mic, or the bank's reply.

let ctx = null;
let micAn = null;
let playAn = null;
let playerEl = null;
const buf = new Float32Array(1024);

export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function attachMic(stream) {
  try {
    const c = audioCtx();
    const src = c.createMediaStreamSource(stream);
    const an = c.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    micAn = an;
    return () => {
      src.disconnect();
      if (micAn === an) micAn = null;
    };
  } catch {
    return () => {};
  }
}

// A single <audio> element plays every reply, routed through an analyser.
export function player() {
  if (playerEl) return playerEl;
  playerEl = new Audio();
  try {
    const c = audioCtx();
    const src = c.createMediaElementSource(playerEl);
    playAn = c.createAnalyser();
    playAn.fftSize = 1024;
    src.connect(playAn);
    playAn.connect(c.destination);
  } catch {
    playAn = null;
  }
  return playerEl;
}

function rms(an) {
  an.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

export function level() {
  let l = 0;
  if (micAn) l = Math.max(l, rms(micAn));
  if (playAn && playerEl && !playerEl.paused) l = Math.max(l, rms(playAn));
  return Math.min(1, l * 5);
}

// Play a reply sentence by sentence. Each item is a promise of base64 MP3 (or null);
// playback starts as soon as the first one lands. `weights` (words per sentence) drive progress().
let q = null;

export function playQueue(items, weights, { onStart, onDone } = {}) {
  const el = player();
  el.pause();
  const token = {};
  q = { token, items, weights, idx: 0, done: false, started: false };
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  q.total = total;

  const next = async () => {
    if (q?.token !== token) return;
    if (q.idx >= items.length) {
      q.done = true;
      onDone?.();
      return;
    }
    const b64 = await items[q.idx];
    if (q?.token !== token) return;
    if (!b64) {
      q.idx += 1;
      return next();
    }
    el.src = "data:audio/mpeg;base64," + b64;
    el.onended = () => {
      if (q?.token !== token) return;
      q.idx += 1;
      next();
    };
    try {
      await el.play();
      if (!q.started) {
        q.started = true;
        onStart?.();
      }
    } catch {
      q.done = true; // autoplay blocked: show the text, let "Play again" handle it
      onDone?.(true);
    }
  };
  next();
  return token;
}

export function stopQueue() {
  if (q) q.token = null;
  q = null;
  player().pause();
}

// 0..1 through the current reply, or null if nothing is queued.
export function progress() {
  if (!q) return null;
  if (q.done) return 1;
  const el = player();
  const before = q.weights.slice(0, q.idx).reduce((a, b) => a + b, 0);
  const cur = q.weights[q.idx] || 0;
  const frac = el.duration && isFinite(el.duration) && q.started ? el.currentTime / el.duration : 0;
  return Math.min(1, (before + cur * frac) / q.total);
}

export function speaking() {
  return Boolean(q && q.started && !q.done && !player().paused);
}
