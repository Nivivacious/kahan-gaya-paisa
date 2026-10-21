// Health check for the live demo, protected by CHECK_TOKEN.
// Runs two real turns: a typed Kannada question (Sarvam-105B -> Bulbul), then feeds
// Bulbul's own audio back in as a "caller" (Saaras -> Sarvam-105B -> Bulbul).
// Returns only text and timings, never audio or keys.
import { createHash } from "node:crypto";
import turn from "./turn.js";

// Only the SHA-256 of the token lives in the repo.
const TOKEN_HASH = "d53b03c51cab20d0d77df23f3c8bd310ef36a4a5a8917ea63bdfdded05c7c1b5";

function call(body) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      status(c) { this.code = c; return this; },
      json(j) { resolve({ status: this.code, ...j }); },
    };
    turn({ method: "POST", body }, res);
  });
}

export default async function handler(req, res) {
  const given = (req.query && req.query.t) || new URL(req.url, "http://x").searchParams.get("t");
  if (!given || createHash("sha256").update(String(given)).digest("hex") !== TOKEN_HASH) return res.status(200).json({ ok: false, error: "bad or missing token" });
  try {

  const typed = await call({ lang: "kn-IN", text: "ನಿನ್ನೆ ಅಂಗಡಿಗೆ UPI ಮಾಡಿದೆ, ಫೇಲ್ ಆಯ್ತು ಆದರೆ ದುಡ್ಡು ಕಟ್ ಆಗಿದೆ" });
  const out = {
    typed: {
      status: typed.status,
      error: typed.error,
      txn: typed.txn,
      lang: typed.lang,
      reply: typed.reply,
      audio_chars: typed.audio ? typed.audio.length : 0,
      timings: typed.timings,
    },
  };

  if (typed.audio && (req.query && req.query.step) === "voice") {
    const spoken = await call({ lang: "hi-IN", audio: typed.audio });
    out.voice = {
      status: spoken.status,
      error: spoken.error,
      heard: spoken.heard,
      transcript: spoken.customerText,
      txn: spoken.txn,
      lang: spoken.lang,
      reply: spoken.reply,
      audio_chars: spoken.audio ? spoken.audio.length : 0,
      timings: spoken.timings,
    };
  }
  res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ ok: false, crashed: String(e && e.stack || e).slice(0, 800) });
  }
}

export const config = { maxDuration: 60 };
