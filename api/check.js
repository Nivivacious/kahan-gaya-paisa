// Health check for the live demo, protected by CHECK_TOKEN.
// Runs two real turns: a typed Kannada question (Sarvam-105B -> Bulbul), then feeds
// Bulbul's own audio back in as a "caller" (Saaras -> Sarvam-105B -> Bulbul).
// Returns only text and timings, never audio or keys.
import { createHash } from "node:crypto";
import turn from "./turn.js";
import audit from "./audit.js";
import speakHandler from "./speak.js";
import handoffHandler from "./handoff.js";

// Only the SHA-256 of the token lives in the repo.
const TOKEN_HASH = "d53b03c51cab20d0d77df23f3c8bd310ef36a4a5a8917ea63bdfdded05c7c1b5";

function call(body, fn = turn) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      status(c) { this.code = c; return this; },
      json(j) { resolve({ status: this.code, ...j }); },
    };
    fn({ method: "POST", body }, res);
  });
}

export default async function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const candidates = [...u.searchParams.values(), ...u.pathname.split("/")];
  const ok = candidates.some((v) => v && createHash("sha256").update(String(v)).digest("hex") === TOKEN_HASH);
  if (!ok) return res.status(200).json({ ok: false, error: "bad or missing token" });
  try {

  if (u.searchParams.get("step") === "ramesh") {
    const a = await call({ caller: "ramesh", lang: "hi-IN", text: "सुरेश को भेजे पाँच हज़ार फेल हो गए, पैसा कट गया। कब वापस आएगा?" });
    const b = await call({ caller: "ramesh", lang: "hi-IN", text: "मुझे किसी इंसान से बात करनी है", history: [{ role: "user", content: "सुरेश को भेजे पाँच हज़ार फेल हो गए" }, { role: "assistant", content: a.reply || "" }] });
    const h = await call({ customer: "Ramesh, Delhi", item: "Suresh Kumar, ₹5000, UPI, to a friend. Status: Back by tomorrow", lines: [{ who: "customer", text: "सुरेश को भेजे पाँच हज़ार फेल हो गए, पैसा कट गया। कब वापस आएगा?" }, { who: "bank", text: a.reply || "" }, { who: "customer", text: "मुझे किसी इंसान से बात करनी है" }, { who: "bank", text: b.reply || "" }] }, handoffHandler);
    return res.status(200).json({ first: { status: a.status, error: a.error, txn: a.txn, handoff: a.handoff, reply: a.reply, timings: a.timings }, person: { status: b.status, error: b.error, txn: b.txn, handoff: b.handoff, reply: b.reply }, handoff: h });
  }
  if (u.searchParams.get("step") === "speak") {
    const parts = ["ಸಾರಿ ಲಕ್ಷ್ಮಿ ಅವರೇ.", "ನಿನ್ನೆ ಶ್ರೀ ಗಣೇಶ್ ಅಂಗಡಿಗೆ ಮಾಡಿದ UPI ಪೇಮೆಂಟ್ ತಲುಪಿಲ್ಲ.", "ಹಣ ಇಪ್ಪತ್ತೈದನೇ ತಾರೀಖಿನ ಒಳಗೆ ವಾಪಸ್ ಬರುತ್ತೆ."];
    const t0 = Date.now();
    const outs = await Promise.all(parts.map((text) => call({ text, lang: "kn-IN" }, speakHandler).then((r) => ({ ...r, at: Date.now() - t0 }))));
    return res.status(200).json(outs.map((o) => ({ status: o.status, error: o.error, tts_ms: o.tts_ms, done_at_ms: o.at, audio: o.audio ? o.audio.length : 0 })));
  }
  if (u.searchParams.get("step") === "audit") {
    const a = await call({ sample: u.searchParams.get("sample") || "B" }, audit);
    return res.status(200).json({ ...a, audio: a.audio ? a.audio.length : 0 });
  }
  const typed = await call({ lang: "kn-IN", speak: true, text: "ನಿನ್ನೆ ಅಂಗಡಿಗೆ UPI ಮಾಡಿದೆ, ಫೇಲ್ ಆಯ್ತು ಆದರೆ ದುಡ್ಡು ಕಟ್ ಆಗಿದೆ" });
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

  if (typed.audio && u.searchParams.get("step") === "voice") {
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
