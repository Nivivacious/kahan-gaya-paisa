// "See the API calls": the exact Sarvam requests behind each demo, for developers.
export default function ApiPeek({ title = "See the API calls", blocks }) {
  return (
    <details className="peek">
      <summary>{title}</summary>
      {blocks.map(([label, code]) => (
        <figure key={label} className="peek__block">
          <figcaption>{label}</figcaption>
          <pre><code>{code}</code></pre>
        </figure>
      ))}
    </details>
  );
}

export const TURN_CALLS = [
  [
    "1. Saaras v4 hears her, in whatever language she speaks",
    `form.append("model", "saaras:v4");
form.append("language_code", "unknown");  // detect the language
form.append("keyterms", JSON.stringify(["UPI", "UTR", "Saathi Bank"]));
await fetch("https://api.sarvam.ai/speech-to-text", {
  method: "POST",
  headers: { "api-subscription-key": KEY },
  body: form,
});
// → { transcript, language_code: "kn-IN", language_probability: 0.98 }`,
  ],
  [
    "2. Sarvam-105B finds the payment and writes a spoken answer",
    `await sarvam("/v1/chat/completions", {
  model: "sarvam-105b",
  reasoning_effort: null,  // or reasoning can use up max_tokens
  max_tokens: 1200,        // and the reply comes back empty
  messages: [{ role: "system", content: rules + passbook }, ...history],
});`,
  ],
  [
    "3. Bulbul v3 answers in the language Saaras heard",
    `await sarvam("/text-to-speech", {
  model: "bulbul:v3",
  text: reply,
  language_code: heard.language,  // "kn-IN"
  speaker: "priya",
  output_audio_codec: "mp3",      // less than half the size of WAV
});`,
  ],
];

export const AUDIT_CALLS = [
  [
    "1. Bulbul v3 voices the sample call in two voices",
    `await Promise.all(lines.map(([who, lang, text]) =>
  sarvam("/text-to-speech", {
    model: "bulbul:v3", text, language_code: lang,
    speaker: who === "agent" ? "rahul" : "kavya",
    speech_sample_rate: 16000, output_audio_codec: "wav",
  })
));`,
  ],
  [
    "2. Saaras v4 transcribes each piece, split at pauses",
    `const pieces = splitAtPauses(pcm);      // 280 ms of quiet ends a turn
await Promise.all(pieces.map((p) => {
  form.append("model", "saaras:v4");
  form.append("language_code", "unknown");
  form.append("keyterms", JSON.stringify(["EMI", "police", "late fee"]));
  return fetch("https://api.sarvam.ai/speech-to-text", { ... });
}));`,
  ],
  [
    "3. Sarvam-105B checks the call against seven rules",
    `await sarvam("/v1/chat/completions", {
  model: "sarvam-105b",
  temperature: 0.1,
  reasoning_effort: null,
  messages: [{ role: "user", content: rules + metadata + segments }],
});
// → { turns, checks: [{ id: "threats", pass: false, seg: 5 }], promise }`,
  ],
];
