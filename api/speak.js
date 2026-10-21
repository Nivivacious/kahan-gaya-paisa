// Voice one sentence of a reply with Bulbul v3. The page calls this once per sentence, in parallel.
import { speak } from "./turn.js";

const SPOKEN = ["kn-IN", "hi-IN", "ta-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: "Demo's offline. No Sarvam key set." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = String(body.text || "").slice(0, 600);
  const lang = SPOKEN.includes(body.lang) ? body.lang : "kn-IN";
  if (!text.trim()) return res.status(400).json({ error: "Nothing to say." });
  const t0 = Date.now();
  try {
    const audio = await speak(text, lang);
    return res.status(200).json({ audio, tts_ms: Date.now() - t0 });
  } catch (e) {
    return res.status(502).json({ error: "Sarvam call failed: " + e.message });
  }
}

export const config = { maxDuration: 30 };
