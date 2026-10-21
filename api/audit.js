// Hear every call: audit one recovery call against RBI's recovery-conduct rules.
// Sample calls are scripts voiced by Bulbul v3 (two speakers), so there is real audio to transcribe.
// Pipeline: [Bulbul, samples only] -> Saaras v4 (timestamps) -> Sarvam-105B audit -> JSON.

const BASE = "https://api.sarvam.ai";
const RATE = 16000;

export const SAMPLES = {
  A: {
    title: "EMI reminder",
    lender: "Saathi Finance",
    agent: "Rohan",
    calledAt: "11:20",
    terms: "EMI ₹4,200 due on the 15th. Late fee ₹500 once per missed EMI.",
    lines: [
      ["agent", "hi-IN", "नमस्ते, मैं साथी फाइनेंस से रोहन बोल रहा हूँ। ये कॉल रिकॉर्ड हो रही है।"],
      ["borrower", "hi-IN", "हाँ, बोलिए।"],
      ["agent", "hi-IN", "आपकी चार हज़ार दो सौ की EMI पंद्रह तारीख से बाकी है। कब तक भर पाएंगी?"],
      ["borrower", "hi-IN", "सैलरी अट्ठाईस को आएगी, उसी दिन भर दूँगी।"],
      ["agent", "hi-IN", "ठीक है, अट्ठाईस तारीख, चार हज़ार दो सौ। धन्यवाद।"],
    ],
  },
  B: {
    title: "Third reminder",
    lender: "Saathi Finance",
    agent: "Unknown",
    calledAt: "20:40",
    terms: "EMI ₹6,000, three months overdue. Late fee ₹500 once per missed EMI.",
    lines: [
      ["agent", "hi-IN", "मैडम, पेमेंट कब करोगी? तीन महीने हो गए।"],
      ["borrower", "hi-IN", "भैया, अभी हॉस्पिटल में हूँ, पापा एडमिट हैं।"],
      ["agent", "hi-IN", "वो सब मत बताओ। कल तक पैसे नहीं आए तो आपके ऑफिस आके सबको बताएंगे।"],
      ["borrower", "hi-IN", "प्लीज़ ऐसा मत कीजिए।"],
      ["agent", "hi-IN", "और पुलिस केस भी होगा। आपके भाई को भी कॉल कर रहा हूँ।"],
    ],
  },
  C: {
    title: "Kannada follow-up",
    lender: "Saathi Finance",
    agent: "Manjunath",
    calledAt: "14:05",
    terms: "EMI ₹2,800. Late fee ₹500 once per missed EMI. No daily penalty.",
    lines: [
      ["agent", "kn-IN", "ನಮಸ್ಕಾರ, ಸಾಥಿ ಫೈನಾನ್ಸ್‌ನಿಂದ ಮಂಜುನಾಥ್ ಮಾತಾಡ್ತಿದೀನಿ."],
      ["borrower", "kn-IN", "ಹೇಳಿ ಸರ್."],
      ["agent", "kn-IN", "ನಿಮ್ಮ ಎರಡು ಸಾವಿರದ ಎಂಟು ನೂರು ರೂಪಾಯಿ EMI ಬಾಕಿ ಇದೆ. ಪ್ರತಿದಿನ ಐನೂರು ರೂಪಾಯಿ ದಂಡ ಬೀಳುತ್ತೆ."],
      ["borrower", "kn-IN", "ಅಯ್ಯೋ, ಮೂವತ್ತನೇ ತಾರೀಖು ಕಟ್ತೀನಿ ಸರ್."],
      ["agent", "kn-IN", "ಸರಿ, ಮೂವತ್ತನೇ ತಾರೀಖು. ಮರೆಯಬೇಡಿ."],
    ],
  },
};

const VOICE = { agent: "rahul", borrower: "kavya" };

const CHECKS = [
  ["hours", "Called between 8 am and 7 pm"],
  ["recorded", "Told the borrower the call is recorded"],
  ["identity", "Agent named themselves and the lender"],
  ["threats", "No threats, abuse or intimidation"],
  ["third_party", "Kept to the borrower; no pressure through family, office or neighbours"],
  ["misleading", "No false or misleading claims about dues, fees or legal action"],
  ["sensitive", "Backed off during a medical emergency or bereavement"],
];

async function sarvamJSON(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// Pull raw 16-bit PCM out of a WAV file.
function pcmOf(wav) {
  let i = 12;
  while (i + 8 <= wav.length) {
    const id = wav.toString("ascii", i, i + 4);
    const size = wav.readUInt32LE(i + 4);
    if (id === "data") return wav.subarray(i + 8, i + 8 + size);
    i += 8 + size + (size % 2);
  }
  return wav.subarray(44);
}

function wavOf(pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const voiced = new Map(); // warm-instance cache: sample id -> WAV buffer

async function voice(sample) {
  if (voiced.has(sample.id)) return voiced.get(sample.id);
  const parts = await Promise.all(
    sample.lines.map(([who, lang, text]) =>
      sarvamJSON("/text-to-speech", {
        text, language_code: lang, model: "bulbul:v3", speaker: VOICE[who], pace: 1.08,
        speech_sample_rate: RATE, output_audio_codec: "wav",
      }).then((r) => pcmOf(Buffer.from((r.audios || []).join(""), "base64")))
    )
  );
  const gap = Buffer.alloc(Math.round(RATE * 0.35) * 2);
  const pcm = Buffer.concat(parts.flatMap((p, i) => (i ? [gap, p] : [p])));
  const wav = wavOf(pcm);
  voiced.set(sample.id, wav);
  return wav;
}

async function transcribe(wav) {
  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "call.wav");
  form.append("model", "saaras:v4");
  form.append("mode", "transcribe");
  form.append("language_code", "unknown");
  form.append("keyterms", JSON.stringify(["EMI", "Saathi Finance", "UPI", "NACH", "police", "late fee"]));
  const r = await fetch(BASE + "/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY },
    body: form,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`/speech-to-text ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// Split the call at pauses (simple energy VAD), so each turn gets its own timestamp.
function splitAtPauses(pcm) {
  const frame = Math.round(RATE * 0.02); // 20 ms
  const n = Math.floor(pcm.length / 2 / frame);
  const energy = new Float64Array(n);
  let peak = 0;
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let k = 0; k < frame; k++) {
      const v = pcm.readInt16LE((f * frame + k) * 2) / 32768;
      s += v * v;
    }
    energy[f] = Math.sqrt(s / frame);
    if (energy[f] > peak) peak = energy[f];
  }
  const thr = Math.max(0.01, peak * 0.06);
  const minGap = 14; // 280 ms of quiet ends a segment
  const segs = [];
  let start = -1;
  let quiet = 0;
  for (let f = 0; f < n; f++) {
    if (energy[f] > thr) {
      if (start < 0) start = f;
      quiet = 0;
    } else if (start >= 0 && ++quiet >= minGap) {
      segs.push([start, f - quiet + 1]);
      start = -1;
      quiet = 0;
    }
  }
  if (start >= 0) segs.push([start, n]);
  // Drop blips, merge very short pieces into their neighbour, cap the count.
  const merged = [];
  for (const [a, b] of segs) {
    if (b - a < 10) continue;
    const last = merged[merged.length - 1];
    if (last && (b - a < 15 || merged.length >= 14)) last[1] = b;
    else merged.push([a, b]);
  }
  const pad = 6;
  return merged.map(([a, b]) => {
    const s0 = Math.max(0, a - pad) * frame;
    const s1 = Math.min(n, b + pad) * frame;
    return { start: (s0 / RATE), end: (s1 / RATE), pcm: pcm.subarray(s0 * 2, s1 * 2) };
  });
}


// Median voice pitch of a stretch of 16 kHz PCM (autocorrelation over 40 ms frames).
function pitchOf(pcm) {
  const N = 640, hop = 320, minLag = 40, maxLag = 230;
  const n = Math.floor(pcm.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  const f0s = [];
  for (let s = 0; s + N + maxLag < n; s += hop) {
    let e = 0;
    for (let i = 0; i < N; i++) e += x[s + i] * x[s + i];
    if (e / N < 0.0004) continue;
    const rs = new Float32Array(maxLag + 2);
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0, e2 = 0;
      for (let i = 0; i < N; i++) { c += x[s + i] * x[s + i + lag]; e2 += x[s + i + lag] * x[s + i + lag]; }
      rs[lag] = c / Math.sqrt(e * e2 + 1e-9);
      if (rs[lag] > best) best = rs[lag];
    }
    if (best < 0.45) continue;
    // Take the shortest lag that's a local peak close to the best, to avoid octave errors.
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (rs[lag] >= 0.9 * best && rs[lag] >= rs[lag - 1] && rs[lag] >= rs[lag + 1]) { f0s.push(RATE / lag); break; }
    }
  }
  if (!f0s.length) return null;
  f0s.sort((a, b) => a - b);
  return f0s[Math.floor(f0s.length / 2)];
}

// Group segments into two voices by pitch (1-D two-means on log pitch).
function voices(pitches) {
  const known = pitches.map((p, i) => [i, p]).filter(([, p]) => p);
  if (known.length < 2) return pitches.map(() => null);
  const logs = known.map(([, p]) => Math.log(p));
  let lo = Math.min(...logs), hi = Math.max(...logs);
  if (hi - lo < Math.log(1.25)) return pitches.map(() => 1); // one voice, or two too close to tell
  for (let k = 0; k < 10; k++) {
    const a = [], b = [];
    logs.forEach((v) => (Math.abs(v - lo) <= Math.abs(v - hi) ? a : b).push(v));
    lo = a.reduce((s, v) => s + v, 0) / (a.length || 1);
    hi = b.reduce((s, v) => s + v, 0) / (b.length || 1);
  }
  const out = pitches.map(() => null);
  known.forEach(([i], k) => { out[i] = Math.abs(logs[k] - lo) <= Math.abs(logs[k] - hi) ? 1 : 2; });
  return out;
}

async function transcribeCall(wav) {
  const pcm = pcmOf(wav);
  const pieces = splitAtPauses(pcm);
  if (!pieces.length) return { segments: [], language: null };
  const results = await Promise.all(pieces.map((p) => transcribe(wavOf(p.pcm)).catch(() => null)));
  const voiceOf = voices(pieces.map((p) => pitchOf(p.pcm)));
  const langs = {};
  const segments = [];
  results.forEach((r, i) => {
    if (!r || !String(r.transcript || "").trim()) return;
    if (r.language_code) langs[r.language_code] = (langs[r.language_code] || 0) + 1;
    segments.push({ i: segments.length, text: String(r.transcript).trim(), start: +pieces[i].start.toFixed(2), end: +pieces[i].end.toFixed(2), voice: voiceOf[i] });
  });
  const language = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { segments, language };
}

function auditPrompt(meta, segments, language) {
  return [
    "You audit Indian loan-recovery calls for a lender's compliance team.",
    "Rules (RBI directions on conduct in recovery of loans, in force 1 Jan 2027): contact only 08:00–19:00; tell the borrower the call is recorded; no abusive or threatening language, intimidation, threatening calls or public humiliation; deal only with the borrower or guarantor and never pressure family, friends, neighbours or co-workers; no false or misleading representations; no calls during bereavement, medical emergencies, calamities or marriage functions. Good practice: the agent names themselves and the lender.",
    `Call metadata: lender ${meta.lender}; call time ${meta.calledAt || "unknown"}; loan terms: ${meta.terms || "unknown"}.`,
    `Transcript segments from Saaras (language ${language || "unknown"}), as JSON with start times in seconds:`,
    JSON.stringify(segments.map(({ i, text, start, voice }) => ({ i, text, start, voice }))),
    "Return ONLY a JSON object, no prose, with this shape:",
    JSON.stringify({
      turns: [{ seg: 0, speaker: "agent|borrower", text: "segment text as transcribed", english: "short English gloss" }],
      checks: CHECKS.filter(([id]) => id !== "hours").map(([id, label]) => ({ id, label, pass: true, seg: null, why: "one short English sentence; quote the words if it failed" })),
      promise: { amount_inr: null, date: null },
      summary: "one plain English sentence for a compliance manager",
    }),
    "Judge only from what is said on the call, never from the metadata, except the call time. recorded passes only if the agent says on the call that it is being recorded. identity passes only if the agent says both their own name and the lender's name. Threatening police action, arrest or a criminal case over a missed EMI fails both threats and misleading. Stating a penalty that contradicts the loan terms fails misleading. Give one turn per segment, in order. Each segment has a voice number from pitch analysis: segments with the same voice number are almost certainly the same person, so use it to decide speakers and only override it when the words make it impossible. Work out which voice is the agent from what they say. Split a segment into turns only if two speakers are clearly inside it. For a failed check, set seg to the segment index where it happens. If the call gives no information for a check, pass it and say so in why. Use null for promise fields not stated.",
  ].join("\n");
}

function parseJSON(s) {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The audit came back without JSON.");
  return JSON.parse(s.slice(a, b + 1));
}

function hoursCheck(calledAt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(calledAt || "");
  if (!m) return { id: "hours", label: CHECKS[0][1], pass: true, seg: null, why: "Call time not given, so this couldn't be checked." };
  const mins = Number(m[1]) * 60 + Number(m[2]);
  const ok = mins >= 8 * 60 && mins <= 19 * 60;
  return { id: "hours", label: CHECKS[0][1], pass: ok, seg: null, why: ok ? `Logged at ${calledAt}, inside the window.` : `Logged at ${calledAt}, outside 8 am to 7 pm.` };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: "Demo's offline. No Sarvam key set." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const timings = {};

  try {
    let wav;
    let meta;
    if (body.sample && SAMPLES[body.sample]) {
      meta = { ...SAMPLES[body.sample], id: body.sample };
      const t0 = Date.now();
      wav = await voice(meta);
      timings.voice_ms = Date.now() - t0;
    } else if (body.audio) {
      wav = Buffer.from(body.audio, "base64");
      meta = { lender: "the lender", calledAt: /^\d{1,2}:\d{2}$/.test(body.calledAt || "") ? body.calledAt : null, terms: null };
    } else {
      return res.status(400).json({ error: "Pick a call, or upload one." });
    }
    const seconds = (wav.length - 44) / (RATE * 2);

    const t1 = Date.now();
    const { segments, language } = await transcribeCall(wav);
    timings.stt_ms = Date.now() - t1;
    if (!segments.length) return res.status(422).json({ error: "Couldn't hear any speech in that recording.", timings });

    const t2 = Date.now();
    const chat = await sarvamJSON("/v1/chat/completions", {
      model: "sarvam-105b",
      temperature: 0.1,
      reasoning_effort: null,
      max_tokens: 3000,
      messages: [{ role: "user", content: auditPrompt(meta, segments, language) }],
    });
    timings.llm_ms = Date.now() - t2;
    const audit = parseJSON(chat.choices?.[0]?.message?.content || "");
    const checks = [hoursCheck(meta.calledAt), ...(audit.checks || []).filter((c) => c && c.id !== "hours")];

    return res.status(200).json({
      call: { title: meta.title || "Your recording", lender: meta.lender, agent: meta.agent || null, calledAt: meta.calledAt, terms: meta.terms, seconds },
      audio: body.sample ? wav.toString("base64") : null,
      language,
      segments,
      turns: audit.turns || [],
      checks,
      promise: audit.promise || null,
      summary: audit.summary || "",
      timings,
    });
  } catch (e) {
    return res.status(502).json({ error: "Sarvam call failed: " + e.message, timings });
  }
}

export const config = { maxDuration: 60 };
