// One support turn: caller audio (or typed text) -> Saaras v4 STT -> Sarvam-105B -> Bulbul v3 TTS.
// The Sarvam key lives only in the SARVAM_API_KEY environment variable on the server.

const BASE = "https://api.sarvam.ai";

// Languages Bulbul v3 can speak. Saaras can hear more (22), so if a caller speaks
// one Bulbul can't voice, we reply in the language the caller picked on the page.
const SPOKEN = ["kn-IN", "hi-IN", "ta-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"];
const LANG_NAMES = {
  "kn-IN": "Kannada", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu", "ml-IN": "Malayalam",
  "mr-IN": "Marathi", "bn-IN": "Bengali", "gu-IN": "Gujarati", "pa-IN": "Punjabi", "od-IN": "Odia", "en-IN": "English",
}

// Words Saaras v4 should listen for: names and payments jargon that generic ASR mangles.
const KEYTERMS = ["UPI", "UTR", "ARN", "refund", "reversal", "Saathi Bank", "Sri Ganesh Provisions", "debit card", "PhonePe", "Google Pay", "Paytm", "BHIM"];

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
        status: "Money debited from the customer's account, but the shop never received confirmation. Marked FAILED.",
        resolution: `Automatic reversal has started. Under RBI's turnaround-time rules (circular of 20 Sept 2019), a failed UPI payment to a merchant must be reversed within T+5 days, where T is the transaction day, so by ${istDate(4)} at the latest. Most reversals arrive much sooner. If it comes later than that, the bank owes the customer ₹100 for every day of delay, without the customer having to claim it. The shop did not get this money, so if she needs to pay the shop she must pay again; the first payment will still come back to her.`,
        reference: "UPI ref (UTR) 629104338215",
      },
      {
        id: "T2", type: "Debit card online payment", amount_inr: 3499, to: "an online shoe store", date: istDate(0),
        status: "DECLINED. No money left the account.",
        resolution: "Online (e-commerce) use is switched off on this card. She can switch it on in the bank app under Card settings, then try again.",
        reference: "Decline reason: online use disabled",
      },
      {
        id: "T3", type: "Merchant refund to debit card", amount_inr: 2150, from: "a fashion shopping app (returned order)", date: istDate(-5),
        status: "Refund issued by the merchant; not yet credited.",
        resolution: "Card refunds usually reach the account within 5 to 7 working days of the merchant issuing them. If it takes longer, she can quote the ARN to the bank.",
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
    "Start your reply with the id of the transaction the customer is asking about in square brackets, for example [T1]. Use [NONE] if it matches none. Then the reply itself.",
    "Your reply is read aloud, so: at most three short sentences, no lists, no markdown, no emojis. Say amounts and dates the way people say them out loud.",
    "Answer only from the ledger below. Say what happened, what happens next, and by when.",
    "If the customer disputes something, asks about something outside the ledger, or sounds very upset, say you are connecting them to a person and stop.",
    "Never ask for an OTP, PIN, CVV or full card number.",
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

async function transcribe(wavBase64) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(wavBase64, "base64")], { type: "audio/wav" }), "turn.wav");
  form.append("model", "saaras:v4");
  form.append("mode", "transcribe");
  form.append("language_code", "unknown"); // let Saaras work out which language the caller is speaking
  form.append("keyterms", JSON.stringify(KEYTERMS));
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.SARVAM_API_KEY) {
    return res.status(503).json({ error: "Demo's offline. No Sarvam key set." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const picked = SPOKEN.includes(body && body.lang) ? body.lang : "kn-IN";
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const timings = {};

  try {
    let customerText = (body.text || "").toString().slice(0, 600);
    let heard = null;

    if (body.audio) {
      const t0 = Date.now();
      const stt = await transcribe(body.audio);
      timings.stt_ms = Date.now() - t0;
      customerText = stt.transcript || "";
      heard = { language: stt.language_code || null, confidence: stt.language_probability ?? null };
      if (!customerText.trim()) {
        return res.status(422).json({ error: "Didn't catch that. Try again.", timings });
      }
    }
    if (!customerText.trim()) return res.status(400).json({ error: "Say or type something first." });

    // Reply in the language the caller actually spoke, if Bulbul can voice it.
    const lang = heard && SPOKEN.includes(heard.language) ? heard.language : picked;

    const t1 = Date.now();
    const chat = await sarvamJSON("/v1/chat/completions", {
      model: "sarvam-105b",
      temperature: 0.3,
      // Reasoning tokens count toward max_tokens and can leave the reply empty.
      // A three-sentence spoken answer from a fixed ledger doesn't need them.
      reasoning_effort: null,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.slice(0, 600) })),
        { role: "user", content: customerText },
      ],
    });
    timings.llm_ms = Date.now() - t1;
    let reply = clean(chat.choices && chat.choices[0] && chat.choices[0].message && chat.choices[0].message.content);
    let txn = null;
    const tag = reply.match(/^\s*\[(T\d|NONE)\]\s*/i);
    if (tag) {
      txn = tag[1].toUpperCase() === "NONE" ? null : tag[1].toUpperCase();
      reply = reply.slice(tag[0].length).trim();
    }
    if (!reply) throw new Error(`The model returned an empty reply (finish_reason: ${chat.choices?.[0]?.finish_reason}).`);

    const t2 = Date.now();
    const tts = await sarvamJSON("/text-to-speech", {
      text: reply.slice(0, 2400),
      language_code: lang,
      model: "bulbul:v3",
      speaker: "priya",
      pace: 1.05,
      output_audio_codec: "mp3", // less than half the size of WAV, so the answer reaches the browser sooner
    });
    timings.tts_ms = Date.now() - t2;

    return res.status(200).json({
      customerText,
      heard,
      lang,
      txn,
      reply,
      audio: (tts.audios || []).join(""),
      timings,
    });
  } catch (e) {
    return res.status(502).json({ error: "Sarvam call failed: " + e.message, timings });
  }
}

export const config = { maxDuration: 60 };
