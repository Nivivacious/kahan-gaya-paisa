// One support turn: customer audio (or typed text) -> Saaras STT -> Sarvam-105B -> Bulbul TTS.
// The Sarvam key lives only in the SARVAM_API_KEY environment variable on the server.

const BASE = "https://api.sarvam.ai";
const LANGS = ["kn-IN", "hi-IN", "ta-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"];
const LANG_NAMES = {
  "kn-IN": "Kannada", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu", "ml-IN": "Malayalam",
  "mr-IN": "Marathi", "bn-IN": "Bengali", "gu-IN": "Gujarati", "pa-IN": "Punjabi", "od-IN": "Odia", "en-IN": "English",
};

function istDate(offsetDays) {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function ledger() {
  return {
    customer: { name: "Lakshmi R", city: "Bengaluru", account: "Savings ending 4417", card: "Debit card ending 2290" },
    transactions: [
      {
        id: "T1", type: "UPI payment to a merchant (scan-and-pay at a shop)", amount_inr: 1240, to: "Sri Ganesh Provisions", date: istDate(-1),
        status: "Money debited from customer account, but the merchant never received confirmation. Marked FAILED.",
        resolution: `Automatic reversal already started. Under RBI's turnaround-time rules (circular of 20 Sept 2019), a failed UPI merchant payment must be reversed within T+5 days, where T is the transaction day, so by ${istDate(4)} at the latest. Most reversals arrive much sooner. If it is later than that, the bank owes the customer ₹100 for every day of delay, without the customer having to claim it. The shopkeeper did not get the money, so the customer should pay the shop again only if they need to, and the first payment will still come back.`,
        reference: "UTR 629104338215",
      },
      {
        id: "T2", type: "Debit card online payment", amount_inr: 3499, to: "an online shoe store", date: istDate(0),
        status: "DECLINED. No money left the account.",
        resolution: "Online (e-commerce) use is switched off on this card. Customer can switch it on in the bank app under Card settings, then retry.",
        reference: "Decline code: online usage disabled",
      },
      {
        id: "T3", type: "Merchant refund", amount_inr: 2150, from: "a fashion shopping app (returned order)", date: istDate(-5),
        status: "Refund issued by the merchant; not yet credited.",
        resolution: "Card refunds usually reach the account within 5 to 7 working days of the merchant issuing them. The customer can quote the ARN to the bank if it takes longer.",
        reference: "ARN 74332746287001234567890",
      },
    ],
  };
}

function systemPrompt(lang) {
  const name = LANG_NAMES[lang] || "the customer's language";
  return [
    "You are the voice support agent for Saathi Bank, a fictional Indian bank used in a product demo.",
    `Reply in ${name}, in the same script and the same casual, code-mixed register the customer used. Keep common English payment words (UPI, refund, card, app) in English if the customer did.`,
    "Your reply will be read aloud, so: at most three short sentences, no lists, no markdown, no emojis. Say amounts the way people say them (for example 'twelve hundred and forty rupees' in the reply language).",
    "Answer only from the ledger below. Identify which transaction the customer means. Tell them what happened, what happens next and by when.",
    "If the customer disputes something, asks for something outside the ledger, or sounds very upset, say you are connecting them to a person and stop.",
    "Never ask for OTP, PIN, CVV or full card numbers.",
    "LEDGER (JSON):",
    JSON.stringify(ledger()),
  ].join("\n");
}

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

async function transcribe(wavBase64, lang) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(wavBase64, "base64")], { type: "audio/wav" }), "turn.wav");
  form.append("model", "saaras:v3");
  form.append("mode", "transcribe");
  form.append("language_code", lang);
  const r = await fetch(BASE + "/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY },
    body: form,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`/speech-to-text ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function clean(s) {
  return String(s || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/[*_#`]/g, "")
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.SARVAM_API_KEY) {
    return res.status(503).json({ error: "This demo needs a Sarvam API key. The owner adds it as SARVAM_API_KEY in Vercel." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const lang = LANGS.includes(body && body.lang) ? body.lang : "kn-IN";
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const timings = {};

  try {
    let customerText = (body.text || "").toString().slice(0, 600);
    let detected = null;

    if (body.audio) {
      const t0 = Date.now();
      const stt = await transcribe(body.audio, lang);
      timings.stt_ms = Date.now() - t0;
      customerText = stt.transcript || "";
      detected = stt.language_code || null;
      if (!customerText.trim()) {
        return res.status(422).json({ error: "Didn't catch that. Hold the button and speak for a couple of seconds.", timings });
      }
    }
    if (!customerText.trim()) return res.status(400).json({ error: "Say or type a question first." });

    const t1 = Date.now();
    const chat = await sarvamJSON("/v1/chat/completions", {
      model: "sarvam-105b",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.slice(0, 600) })),
        { role: "user", content: customerText },
      ],
    });
    timings.llm_ms = Date.now() - t1;
    const reply = clean(chat.choices && chat.choices[0] && chat.choices[0].message && chat.choices[0].message.content);
    if (!reply) throw new Error("The model returned an empty reply.");

    const t2 = Date.now();
    const tts = await sarvamJSON("/text-to-speech", {
      text: reply.slice(0, 2400),
      language_code: lang,
      model: "bulbul:v3",
      speaker: "priya",
      pace: 1.05,
    });
    timings.tts_ms = Date.now() - t2;

    return res.status(200).json({
      customerText,
      detected,
      reply,
      audio: (tts.audios || []).join(""),
      timings,
      usage: chat.usage || null,
    });
  } catch (e) {
    return res.status(502).json({ error: "Sarvam call failed: " + e.message, timings });
  }
};

module.exports.config = { maxDuration: 60 };
