// Shared Sarvam helpers with retries, so a rate limit or a blip doesn't break a live demo.
export const BASE = "https://api.sarvam.ai";

async function withRetry(fn, tries = 3) {
  let last;
  for (let a = 0; a < tries; a++) {
    const r = await fn();
    if (r.ok || (r.status !== 429 && r.status < 500)) return r;
    last = r;
    const wait = Number(r.headers.get("retry-after")) * 1000 || 400 * 2 ** a;
    await new Promise((res) => setTimeout(res, Math.min(wait, 3000)));
  }
  return last;
}

export async function sarvamJSON(path, body) {
  const r = await withRetry(() =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// fields: { model, mode, language_code, keyterms, ... }; wav: Buffer
export async function speechToText(wav, fields) {
  const r = await withRetry(() => {
    const form = new FormData();
    form.append("file", new Blob([wav], { type: "audio/wav" }), "audio.wav");
    for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === "string" ? v : JSON.stringify(v));
    return fetch(BASE + "/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY },
      body: form,
    });
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`/speech-to-text ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
