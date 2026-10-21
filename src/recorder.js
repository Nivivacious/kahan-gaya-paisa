// Records the caller, then hands back 16 kHz mono WAV as base64, the format Saaras handles best.
import { attachMic } from "./audio.js";

export function createRecorder() {
  let stream = null;
  let rec = null;
  let chunks = [];
  let detach = () => {};

  const release = () => {
    detach();
    stream?.getTracks().forEach((t) => t.stop());
  };

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      detach = attachMic(stream);
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
    },
    stop() {
      return new Promise((resolve, reject) => {
        if (!rec || rec.state === "inactive") {
          release();
          return resolve(null);
        }
        rec.onstop = async () => {
          release();
          try {
            resolve(await toWavBase64(new Blob(chunks, { type: rec.mimeType || "audio/webm" })));
          } catch (e) {
            reject(e);
          }
        };
        rec.stop();
      });
    },
    cancel() {
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      release();
    },
  };
}

async function toWavBase64(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  if (decoded.duration < 0.6) return null;
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(Math.min(decoded.duration, 29) * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const samples = (await off.startRendering()).getChannelData(0);

  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  w(36, "data"); out.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
