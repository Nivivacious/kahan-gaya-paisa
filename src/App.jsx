import { useMemo, useRef, useState } from "react";
import VoicePill from "./rb/VoicePill.jsx";
import ThoughtLine from "./rb/ThoughtLine.jsx";
import StatusMark from "./rb/StatusMark.jsx";
import TextType from "./rb/TextType.jsx";
import Counter from "./rb/Counter.jsx";
import RotatingText from "./rb/RotatingText.jsx";
import Kite from "./Kite.jsx";
import { createRecorder } from "./recorder.js";

const LANGS = [
  ["kn-IN", "ಕನ್ನಡ", "Kannada"],
  ["hi-IN", "हिन्दी", "Hindi"],
  ["ta-IN", "தமிழ்", "Tamil"],
  ["te-IN", "తెలుగు", "Telugu"],
  ["ml-IN", "മലയാളം", "Malayalam"],
  ["mr-IN", "मराठी", "Marathi"],
  ["bn-IN", "বাংলা", "Bengali"],
  ["gu-IN", "ગુજરાતી", "Gujarati"],
  ["pa-IN", "ਪੰਜਾਬੀ", "Punjabi"],
  ["od-IN", "ଓଡ଼ିଆ", "Odia"],
  ["en-IN", "English", "English"],
];
const LANG_NAME = Object.fromEntries(LANGS.map(([code, , name]) => [code, name]));

const ASKS = [
  "ಹಣ ಎಲ್ಲಿ ಹೋಯ್ತು?",
  "पैसा कहाँ गया?",
  "பணம் எங்க போச்சு?",
  "డబ్బు ఎక్కడికి పోయింది?",
  "Where did my money go?",
];

const TRIES = {
  "kn-IN": ["ನಿನ್ನೆ ಅಂಗಡಿಗೆ UPI ಮಾಡಿದೆ, ಫೇಲ್ ಆಯ್ತು ಆದರೆ ದುಡ್ಡು ಕಟ್ ಆಗಿದೆ", "ನನ್ನ ಕಾರ್ಡ್ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಯಾಕೆ ಕೆಲಸ ಮಾಡ್ತಿಲ್ಲ?"],
  "hi-IN": ["कल दुकान पर UPI पेमेंट फेल हो गया लेकिन पैसे कट गए", "मेरा रिफंड अभी तक क्यों नहीं आया?"],
  "ta-IN": ["நேத்து கடையில UPI பேமெண்ட் ஃபெயில் ஆச்சு, ஆனா பணம் கட் ஆயிடுச்சு", "என் கார்டு ஆன்லைன்ல ஏன் வேலை செய்யல?"],
  "en-IN": ["Yaar my UPI failed at the kirana but money got debited", "My refund from the shopping app still hasn't come"],
};

function istDate(offset) {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 + offset * 86400 * 1000);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

const ROWS = [
  {
    id: "T1",
    date: istDate(-1),
    who: "Sri Ganesh Provisions",
    how: "UPI, scan and pay",
    amount: 1240,
    before: { status: "failed", label: "Failed, money debited" },
    after: { status: "running", label: `Coming back by ${istDate(4)}` },
  },
  {
    id: "T2",
    date: istDate(0),
    who: "Online shoe store",
    how: "Debit card ••2290",
    amount: 3499,
    before: { status: "failed", label: "Declined" },
    after: { status: "pending", label: "Turn on online use, then retry" },
  },
  {
    id: "T3",
    date: istDate(-5),
    who: "Shopping app refund",
    how: "To debit card",
    amount: 2150,
    before: { status: "pending", label: "Refund issued" },
    after: { status: "running", label: "Due in 5–7 working days" },
  },
];

const STATS = [
  {
    value: 802,
    suffix: " million",
    text: "UPI payments a day in September 2026.",
    src: ["NPCI, via StartupTalky", "https://startuptalky.com/upi-transactions-september-2026/"],
  },
  {
    value: 0.7,
    decimals: 1,
    prefix: "",
    suffix: "–0.8%",
    text: "of them fail for technical reasons. Small as a share, but at today's volume that's millions of payments a day.",
    src: ["NPCI CEO, Nov 2024, via Inc42", "https://inc42.com/buzz/technical-glitches-on-upi-have-fallen-below-1"],
  },
  {
    value: 152157,
    suffix: "",
    text: "internet and mobile banking complaints at Canara Bank in FY26. Its biggest category, at one bank.",
    src: ["Canara Bank disclosure", "https://www.canarabank.bank.in/documents/d/guest/disclosure-20of-20complaints-202025-26"],
  },
  {
    value: 10.6,
    decimals: 1,
    suffix: "%",
    text: "of Indians speak English at all, according to the last census. Support has to work in the language people think in.",
    src: ["Census 2011", "https://en.wikipedia.org/wiki/Multilingualism_in_India"],
  },
];

const secs = (ms) => (ms / 1000).toFixed(1) + " s";

export default function App() {
  const [lang, setLang] = useState("kn-IN");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const [matched, setMatched] = useState(null);
  const [trace, setTrace] = useState(null);
  const [typed, setTyped] = useState("");
  const recorder = useRef(null);
  const player = useRef(null);
  const callRef = useRef(null);

  const history = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant").map(({ role, content }) => ({ role, content })),
    [messages]
  );

  function scrollCall() {
    requestAnimationFrame(() => {
      const el = callRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function play(b64) {
    if (!b64) return;
    player.current?.pause();
    player.current = new Audio("data:audio/mpeg;base64," + b64);
    player.current.play().catch(() => setStatus("Tap play on the reply to hear it."));
  }

  async function ask(payload) {
    setBusy(true);
    setTrace({ working: true, steps: [payload.audio ? "Sending your voice to Saaras v4" : "Reading your question"] });
    if (payload.text) setMessages((m) => [...m, { role: "user", content: payload.text }]);
    setStatus(payload.audio ? "Listening back…" : "Checking the passbook…");
    scrollCall();
    try {
      const r = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, lang, history }),
      });
      const data = await r.json().catch(() => ({ error: "The server sent back something unexpected." }));
      if (!r.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { timings: data.timings });

      const t = data.timings || {};
      const row = ROWS.find((x) => x.id === data.txn);
      const steps = [];
      if (t.stt_ms != null) {
        const heard = data.heard?.language ? LANG_NAME[data.heard.language] || data.heard.language : "the caller";
        const conf = data.heard?.confidence != null ? ` (${Math.round(data.heard.confidence * 100)}% sure)` : "";
        steps.push(`Saaras v4 heard ${heard}${conf} · ${secs(t.stt_ms)}`);
      }
      steps.push(`Sarvam-105B matched ${row ? row.who : "no transaction"} · ${secs(t.llm_ms)}`);
      steps.push(`Bulbul v3 answered in ${LANG_NAME[data.lang] || "the caller's language"} · ${secs(t.tts_ms)}`);
      const total = (t.stt_ms || 0) + (t.llm_ms || 0) + (t.tts_ms || 0);

      setMessages((m) => [
        ...(payload.audio ? [...m, { role: "user", content: data.customerText }] : m),
        { role: "assistant", content: data.reply, audio: data.audio, lang: data.lang },
      ]);
      setMatched(data.txn);
      setTrace({ working: false, steps, elapsed: total / 1000 });
      play(data.audio);
      setStatus("Ask a follow-up, or try another language.");
    } catch (e) {
      setMessages((m) => [...m, { role: "error", content: e.message }]);
      setTrace(null);
      setStatus("Tap the mic to try again.");
    } finally {
      setBusy(false);
      scrollCall();
    }
  }

  async function onStart() {
    player.current?.pause();
    setListening(true);
    setStatus("Listening. Tap again when you're done.");
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
    } catch {
      setListening(false);
      setStatus("The microphone is blocked. Allow it in your browser, or type your question below.");
    }
  }

  async function onStop({ reason }) {
    setListening(false);
    const rec = recorder.current;
    recorder.current = null;
    if (!rec) return;
    if (reason === "cancel" || reason === "escape" || reason === "mic-denied" || reason === "unmount") {
      rec.cancel();
      setStatus(reason === "mic-denied" ? "The microphone is blocked. Type your question below instead." : "Cancelled.");
      return;
    }
    try {
      const audio = await rec.stop();
      if (!audio) return setStatus("That was very short. Tap the mic and speak for a couple of seconds.");
      ask({ audio });
    } catch {
      setStatus("Couldn't read that recording. Try again, or type instead.");
    }
  }

  const kiteState = listening ? "listening" : busy ? "thinking" : matched ? "answered" : "idle";

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__text">
          <h1>Kahan gaya paisa?</h1>
          <p className="hero__ask" lang="mul">
            <RotatingText
              texts={ASKS}
              splitBy="words"
              effect="blur"
              rotationInterval={2600}
              mainClassName="hero__rotate"
            />
          </p>
          <p className="hero__lede">
            Your UPI payment failed, but the money left your account anyway. You call the bank and a recorded voice asks you
            to press 1 for English. This helpline listens in the language you speak, finds the payment, and tells you out loud when the
            money comes back.
          </p>
          <p className="hero__built">
            Built on Sarvam's <b>Saaras v4</b>, <b>Sarvam-105B</b> and <b>Bulbul v3</b> by Nivedita Prabhu.
          </p>
        </div>
        <div className="hero__kite" aria-hidden="false">
          <Kite state={kiteState} />
        </div>
      </header>

      <main className="demo" id="demo">
        <section className="call" aria-labelledby="call-h">
          <div className="call__head">
            <h2 id="call-h">Call Saathi Bank</h2>
            <p>Speak in any Indian language. Saaras works out which one, and the answer comes back in it.</p>
          </div>

          <div className="call__log" ref={callRef} aria-live="polite">
            {messages.length === 0 ? (
              <p className="call__empty">
                Lakshmi paid ₹1,240 at the kirana yesterday. The payment failed, but the money left her account. Ask
                about it the way she would.
              </p>
            ) : (
              messages.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="bubble bubble--me">{m.content}</p>
                ) : m.role === "assistant" ? (
                  <div key={i} className="bubble bubble--bank" lang={m.lang}>
                    {i === messages.length - 1 ? (
                      <TextType text={m.content} as="p" loop={false} typingSpeed={22} showCursor={false} />
                    ) : (
                      <p>{m.content}</p>
                    )}
                    <button type="button" className="bubble__play" onClick={() => play(m.audio)}>
                      Play again
                    </button>
                  </div>
                ) : (
                  <p key={i} className="bubble bubble--err" role="alert">{m.content}</p>
                )
              )
            )}
          </div>

          <div className="call__mic">
            <VoicePill
              reactive="mic"
              size={64}
              reach={10}
              accentColor="#FFFFFF"
              iconColor="#FFFFFF"
              background="#D6336C"
              disabled={busy}
              slideToCancel
              ariaLabel={listening ? "Stop and send" : "Speak to Saathi Bank"}
              onStart={onStart}
              onStop={onStop}
            />
            <p className="call__status" role="status">{status || "Tap to speak, or hold and slide left to cancel."}</p>
          </div>

          <form
            className="call__type"
            onSubmit={(e) => {
              e.preventDefault();
              const t = typed.trim();
              if (!t || busy) return;
              setTyped("");
              ask({ text: t });
            }}
          >
            <label className="sr" htmlFor="typed">Type your question</label>
            <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type your question" />
            <select aria-label="Language for typed questions" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([code, native]) => (
                <option key={code} value={code}>{native}</option>
              ))}
            </select>
            <button type="submit" disabled={busy}>Ask</button>
          </form>
          {TRIES[lang] && (
            <div className="call__tries" aria-label="Example questions">
              {TRIES[lang].map((t) => (
                <button key={t} type="button" disabled={busy} onClick={() => ask({ text: t })}>{t}</button>
              ))}
            </div>
          )}
        </section>

        <aside className="side">
          <section className="passbook" aria-labelledby="pb-h">
            <h2 id="pb-h">Lakshmi's passbook</h2>
            <p className="passbook__sub">Savings ••4417, Bengaluru. Sample data, not a real account.</p>
            <ol className="passbook__rows">
              {ROWS.map((r) => {
                const on = matched === r.id;
                const s = on ? r.after : r.before;
                return (
                  <li key={r.id} className="row" data-on={on ? "" : undefined}>
                    <span className="row__date">{r.date}</span>
                    <span className="row__who">
                      {r.who}
                      <small>{r.how}</small>
                    </span>
                    <span className="row__amt">
                      <Counter value={r.amount} locale="en-IN" prefix="₹" fontSize={17} intro={false} motionBlur={false} />
                    </span>
                    <span className="row__status">
                      <StatusMark
                        status={s.status}
                        label={s.label}
                        size={16}
                        fontSize={13}
                        color="var(--ink-2)"
                        doneColor="var(--leaf)"
                        errorColor="var(--chilli)"
                        strike={false}
                      />
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="trace" aria-labelledby="trace-h">
            <h2 id="trace-h">Behind the last answer</h2>
            {trace ? (
              <ThoughtLine
                key={trace.working ? "w" : "d" + trace.elapsed}
                label="Working on it"
                doneLabel="Answered in"
                glyph="dot"
                steps={trace.steps}
                working={trace.working}
                elapsed={trace.working ? undefined : trace.elapsed}
                collapseOnSettle={false}
                fontSize={15}
                color="var(--ink)"
                glyphColor="var(--kite)"
              />
            ) : (
              <p className="trace__empty">Each answer takes three Sarvam calls. Their timings show up here, measured on the server.</p>
            )}
          </section>
        </aside>
      </main>

      <section className="why" aria-labelledby="why-h">
        <h2 id="why-h">Why build this</h2>
        <ul className="why__grid">
          {STATS.map((s) => (
            <li key={s.text}>
              <Counter
                value={s.value}
                locale="en-IN"
                decimals={s.decimals}
                prefix={s.prefix}
                suffix={s.suffix}
                fontSize={44}
                fontWeight={800}
                className="why__num"
              />
              <p>{s.text}</p>
              <a href={s.src[1]} target="_blank" rel="noreferrer">{s.src[0]}</a>
            </li>
          ))}
        </ul>
        <p className="why__gap">
          NPCI is working on this too. Its <a href="https://yourstory.com/2026/09/bhim-myupi-9-upi-services-ai-assistant" target="_blank" rel="noreferrer">BHIM MyUPI</a> assistant
          takes complaints by chat, in English, Hindi, Telugu, Tamil and Bengali. A Kannada speaker who'd rather call than
          type is still waiting. That's the gap a bank can close with Sarvam.
        </p>
      </section>

      <footer className="foot">
        <p>
          Saathi Bank is fictional and the passbook is sample data. Reversal dates follow RBI's{" "}
          <a href="https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693" target="_blank" rel="noreferrer">turnaround-time rules</a>:
          T+5 days for a failed UPI payment to a shop, T+1 for one to a person, and ₹100 a day owed after that. Your voice
          goes to Sarvam's APIs to be transcribed and isn't stored here.
        </p>
        <p>
          Interface pieces adapted from <a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits</a>.{" "}
          <a href="https://github.com/Nivivacious/kahan-gaya-paisa" target="_blank" rel="noreferrer">Source on GitHub</a>.
        </p>
      </footer>
    </div>
  );
}
