// Hand-off to a human: translate the caller's side to English with Sarvam Translate,
// then write a two-line brief for the support desk with Sarvam-105B.
import { sarvamJSON } from "./_sarvam.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: "Demo's offline. No Sarvam key set." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .filter((l) => l && typeof l.text === "string" && l.text.trim())
    .slice(-8)
    .map((l) => ({ who: l.who === "bank" ? "bank" : "customer", text: l.text.slice(0, 900) }));
  if (!lines.length) return res.status(400).json({ error: "Nothing to hand off." });
  const timings = {};

  try {
    const t0 = Date.now();
    const translated = await Promise.all(
      lines.map((l) =>
        sarvamJSON("/translate", {
          input: l.text,
          source_language_code: "auto",
          target_language_code: "en-IN",
          model: "mayura:v1",
          mode: "formal",
        })
          .then((r) => ({ ...l, english: r.translated_text, from: r.source_language_code }))
          .catch(() => ({ ...l, english: null, from: null }))
      )
    );
    timings.translate_ms = Date.now() - t0;

    const t1 = Date.now();
    const chat = await sarvamJSON("/v1/chat/completions", {
      model: "sarvam-105b",
      temperature: 0.2,
      reasoning_effort: null,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            "A voice bot at Saathi Bank (fictional) is handing a customer to a human support agent.",
            "Write the brief the human reads before picking up: at most two short plain-English sentences. Say what the customer wants and the one thing to do first. Use only facts in the passbook item and the call; failed UPI debits reverse automatically, so never tell the agent to start a refund. No greeting, no bullet points.",
            `Customer: ${body.customer || "the customer"}. Passbook item: ${body.item || "unknown"}.`,
            "Call so far, translated to English:",
            translated.map((l) => `${l.who}: ${l.english || l.text}`).join("\n"),
          ].join("\n"),
        },
      ],
    });
    timings.llm_ms = Date.now() - t1;
    const brief = String(chat.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/[*_#`]/g, "").trim();

    return res.status(200).json({ lines: translated, brief, timings });
  } catch (e) {
    return res.status(502).json({ error: "Sarvam call failed: " + e.message, timings });
  }
}

export const config = { maxDuration: 30 };
