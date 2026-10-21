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
