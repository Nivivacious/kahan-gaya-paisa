import { useEffect, useMemo, useRef, useState } from "react";
import VoicePill from "./rb/VoicePill.jsx";
import ThoughtLine from "./rb/ThoughtLine.jsx";
import StatusMark from "./rb/StatusMark.jsx";
import Counter from "./rb/Counter.jsx";
import RotatingText from "./rb/RotatingText.jsx";
import Kite from "./Kite.jsx";
import Journey from "./Journey.jsx";
import { createRecorder } from "./recorder.js";
import { player } from "./audio.js";

const LANGS = [
  ["kn-IN", "ಕನ್ನಡ", "Kannada"],
  ["hi-IN", "हिन्दी", "Hindi"],
  ["ta-IN", "தமிழ்", "Tamil"],
  ["te-IN", "తెలుగు", "Telugu"],
  ["en-IN", "English", "English"],
  ["ml-IN", "മലയാളം", "Malayalam"],
  ["mr-IN", "मराठी", "Marathi"],
  ["bn-IN", "বাংলা", "Bengali"],
  ["gu-IN", "ગુજરાતી", "Gujarati"],
  ["pa-IN", "ਪੰਜਾਬੀ", "Punjabi"],
  ["od-IN", "ଓଡ଼ିଆ", "Odia"],
];
const LANG_NAME = Object.fromEntries(LANGS.map(([code, , name]) => [code, name]));

const ASKS = ["ಹಣ ಎಲ್ಲಿ ಹೋಯ್ತು?", "पैसा कहाँ गया?", "பணம் எங்க போச்சு?", "డబ్బు ఎక్కడికి పోయింది?", "Where did my money go?"];

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
    ask: {
      "kn-IN": "ನಿನ್ನೆ ಶ್ರೀ ಗಣೇಶ್ ಅಂಗಡಿಗೆ ಮಾಡಿದ UPI ಫೇಲ್ ಆಯ್ತು, ದುಡ್ಡು ಎಲ್ಲಿ?",
      "hi-IN": "कल श्री गणेश को किया UPI फेल हो गया, पैसा कहाँ गया?",
      "ta-IN": "நேத்து ஸ்ரீ கணேஷ் கடைக்கு பண்ண UPI ஃபெயில் ஆச்சு, பணம் எங்க?",
      "te-IN": "నిన్న శ్రీ గణేష్ షాప్‌కి చేసిన UPI ఫెయిల్ అయింది, డబ్బు ఎక్కడ?",
      "en-IN": "My UPI to Sri Ganesh failed yesterday. Where's the money?",
    },
  },
  {
    id: "T2",
    date: istDate(0),
    who: "Online shoe store",
    how: "Debit card ••2290",
    amount: 3499,
    before: { status: "failed", label: "Declined" },
    after: { status: "pending", label: "Turn on online use, then retry" },
    ask: {
      "kn-IN": "ಶೂ ಆರ್ಡರ್ ಮಾಡುವಾಗ ಕಾರ್ಡ್ ಯಾಕೆ ಡಿಕ್ಲೈನ್ ಆಯ್ತು?",
      "hi-IN": "जूते ऑर्डर करते वक्त कार्ड डिक्लाइन क्यों हुआ?",
      "ta-IN": "ஷூ ஆர்டர் பண்ணும்போது கார்டு ஏன் டிக்ளைன் ஆச்சு?",
      "te-IN": "షూ ఆర్డర్ చేసేటప్పుడు కార్డ్ ఎందుకు డిక్లైన్ అయింది?",
      "en-IN": "Why did my card get declined for the shoes?",
    },
  },
  {
    id: "T3",
    date: istDate(-5),
    who: "Shopping app refund",
    how: "To debit card",
    amount: 2150,
    before: { status: "pending", label: "Refund issued" },
    after: { status: "running", label: "Due in 5–7 working days" },
    ask: {
      "kn-IN": "ಶಾಪಿಂಗ್ ಆಪ್ ರಿಫಂಡ್ ಇನ್ನೂ ಬಂದಿಲ್ಲ",
      "hi-IN": "शॉपिंग ऐप का रिफंड अभी तक नहीं आया",
      "ta-IN": "ஷாப்பிங் ஆப் ரிஃபண்ட் இன்னும் வரல",
      "te-IN": "షాపింగ్ యాప్ రిఫండ్ ఇంకా రాలేదు",
      "en-IN": "The shopping app refund still hasn't come.",
    },
  },
];

const STATS = [
  { value: 802, suffix: " million", text: "UPI payments a day. September 2026.", src: ["NPCI, via StartupTalky", "https://startuptalky.com/upi-transactions-september-2026/"] },
  { value: 0.7, decimals: 1, suffix: "–0.8%", text: "fail on the tech side. That's millions of payments, every day.", src: ["NPCI CEO, Nov 2024, via Inc42", "https://inc42.com/buzz/technical-glitches-on-upi-have-fallen-below-1"] },
  { value: 152157, text: "digital banking complaints at one bank, Canara, in FY26. Its biggest pile.", src: ["Canara Bank disclosure", "https://www.canarabank.bank.in/documents/d/guest/disclosure-20of-20complaints-202025-26"] },
  { value: 10.6, decimals: 1, suffix: "%", text: 'of Indians speak English. The rest still get "Press 1 for English."', src: ["Census 2011", "https://en.wikipedia.org/wiki/Multilingualism_in_India"] },
];

const secs = (ms) => (ms / 1000).toFixed(1) + " s";

// The bank's latest reply, lit word by word in time with Bulbul's voice.
function Subtitle({ text, lang, live }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [lit, setLit] = useState(live ? 0 : words.length);
  useEffect(() => {
    if (!live) {
      setLit(words.length);
      return undefined;
    }
    const el = player();
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      // If the audio never starts (autoplay blocked, no audio), just show the full text.
      if (el.paused && el.currentTime === 0 && performance.now() - started > 1500) {
        setLit(words.length);
        return;
      }
      if (el.duration && isFinite(el.duration)) {
        setLit(el.ended ? words.length : Math.ceil((el.currentTime / el.duration) * words.length));
      }
      if (el.ended) setLit(words.length);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => setLit(words.length), 30000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stop);
    };
  }, [live, words.length, text]);
  return (
    <p className="line__text" lang={lang}>
      {words.map((w, i) => (
        <span key={i} className="word" data-lit={i < lit ? "" : undefined}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

export default function App() {
  const [lang, setLang] = useState("kn-IN");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("");
  const [matched, setMatched] = useState(null);
  const [trace, setTrace] = useState(null);
  const [typed, setTyped] = useState("");
  const recorder = useRef(null);
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
    const el = player();
    el.pause();
    el.src = "data:audio/mpeg;base64," + b64;
    el.onplay = () => setSpeaking(true);
    el.onended = el.onpause = () => setSpeaking(false);
    el.play().catch(() => setStatus("Tap Play again to hear it."));
  }

  async function ask(payload) {
    if (busy) return;
    player(); // set up audio on this tap so the reply can autoplay
    setBusy(true);
    setTrace({ working: true, steps: [payload.audio ? "Sending your voice to Saaras v4" : "Reading the question"] });
    if (payload.text) setMessages((m) => [...m, { role: "user", content: payload.text }]);
    setStatus("Checking her passbook…");
    scrollCall();
    try {
      const r = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, lang, history }),
      });
      const data = await r.json().catch(() => ({ error: "Something broke on our side. Try again." }));
      if (!r.ok) throw new Error(data.error || "Something broke. Try again.");

      const t = data.timings || {};
      const row = ROWS.find((x) => x.id === data.txn);
      const steps = [];
      if (t.stt_ms != null) {
        const heard = data.heard?.language ? LANG_NAME[data.heard.language] || data.heard.language : "the caller";
        const conf = data.heard?.confidence != null ? ` (${Math.round(data.heard.confidence * 100)}% sure)` : "";
        steps.push(`Saaras v4 heard ${heard}${conf} · ${secs(t.stt_ms)}`);
      }
      steps.push(`Sarvam-105B matched ${row ? row.who : "no payment"} · ${secs(t.llm_ms)}`);
      steps.push(`Bulbul v3 answered in ${LANG_NAME[data.lang] || "her language"} · ${secs(t.tts_ms)}`);
      const total = (t.stt_ms || 0) + (t.llm_ms || 0) + (t.tts_ms || 0);

      setMessages((m) => [
        ...(payload.audio ? [...m, { role: "user", content: data.customerText }] : m),
        { role: "assistant", content: data.reply, audio: data.audio, lang: data.lang },
      ]);
      setMatched(data.txn);
      setTrace({ working: false, steps, elapsed: total / 1000 });
      play(data.audio);
      setStatus("Ask a follow-up. Or switch language.");
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
    player().pause();
    setListening(true);
    setStatus("Listening. Tap again to send.");
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
    } catch {
      setListening(false);
      setStatus("Mic's blocked. Allow it, or type below.");
    }
  }

  async function onStop({ reason }) {
    setListening(false);
    const rec = recorder.current;
    recorder.current = null;
    if (!rec) return;
    if (["cancel", "escape", "mic-denied", "unmount", "blur", "disabled"].includes(reason)) {
      rec.cancel();
      setStatus(reason === "mic-denied" ? "Mic's blocked. Type below instead." : "Cancelled.");
      return;
    }
    try {
      const audio = await rec.stop();
      if (!audio) return setStatus("Too short. Try again.");
      ask({ audio });
    } catch {
      setStatus("Couldn't hear that. Try again, or type it.");
    }
  }

  const kiteState = listening ? "listening" : speaking ? "speaking" : busy ? "thinking" : "idle";
  const lastBank = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="page">
      <nav className="hc-nav">
        <span aria-current="page">Kahan gaya paisa?</span>
        <a href="/calls/">Hear every call</a>
      </nav>
      <header className="hero">
        <div className="hero__text">
          <h1>Kahan gaya paisa?</h1>
          <p className="hero__ask">
            <RotatingText texts={ASKS} splitBy="words" effect="blur" rotationInterval={2800} mainClassName="hero__rotate" />
          </p>
          <p className="hero__lede">
            The UPI payment failed. The money left anyway. Ask about it in your own language, and hear when it's coming back.
          </p>
          <p className="hero__built">A demo on Sarvam's Saaras v4, Sarvam-105B and Bulbul v3. By Nivedita Prabhu.</p>
        </div>
        <div className="hero__kite">
          <Kite state={kiteState} />
        </div>
      </header>

      <main className="demo" id="demo">
        <section className="call" aria-labelledby="call-h">
          <div className="call__head">
            <h2 id="call-h">Call Saathi Bank</h2>
            <p className="call__sub">Speak any Indian language. It answers in the same one.</p>
            <div className="langs" role="group" aria-label="Language for typed and tapped questions">
              {LANGS.slice(0, 5).map(([code, native]) => (
                <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>
                  {native}
                </button>
              ))}
              <select
                aria-label="More languages"
                value={LANGS.slice(0, 5).some(([c]) => c === lang) ? "" : lang}
                onChange={(e) => e.target.value && setLang(e.target.value)}
              >
                <option value="">More</option>
                {LANGS.slice(5).map(([code, native]) => (
                  <option key={code} value={code}>{native}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="call__log" ref={callRef} aria-live="polite">
            {messages.length === 0 ? (
              <p className="call__empty">
                Lakshmi paid the kirana ₹1,240 yesterday. Payment failed. Money got cut. Ask like she would, or tap a payment in
                her passbook.
              </p>
            ) : (
              messages.map((m, i) =>
                m.role === "error" ? (
                  <p key={i} className="line line--err" role="alert">{m.content}</p>
                ) : (
                  <div key={i} className={`line line--${m.role === "user" ? "me" : "bank"}`} data-old={i < messages.length - 2 ? "" : undefined}>
                    <span className="line__who">{m.role === "user" ? "Lakshmi" : "Saathi Bank"}</span>
                    {m.role === "assistant" ? (
                      <>
                        <Subtitle text={m.content} lang={m.lang} live={i === lastBank} />
                        <button type="button" className="line__play" onClick={() => play(m.audio)}>Play again</button>
                      </>
                    ) : (
                      <p className="line__text">{m.content}</p>
                    )}
                  </div>
                )
              )
            )}
          </div>

          <div className="call__mic">
            <p className="call__status" role="status">{status || "Tap to talk. Hold and slide left to cancel."}</p>
            <VoicePill
              reactive="mic"
              size={60}
              reach={10}
              accentColor="#FFFFFF"
              iconColor="#FFFFFF"
              background="#16203A"
              disabled={busy}
              slideToCancel
              ariaLabel={listening ? "Stop and send" : "Talk to Saathi Bank"}
              onStart={onStart}
              onStop={onStop}
            />
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
            <label className="sr" htmlFor="typed">Type a question</label>
            <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type it" />
            <button type="submit" disabled={busy}>Ask</button>
          </form>
        </section>

        <aside className="side">
          <section className="passbook" aria-labelledby="pb-h">
            <div className="passbook__band">
              <h2 id="pb-h">Lakshmi's passbook</h2>
              <span>Savings ••4417. Sample data.</span>
            </div>
            <div className="passbook__cols" aria-hidden="true">
              <span>Date</span>
              <span>Particulars</span>
              <span>Amount</span>
            </div>
            <ol className="passbook__rows">
              {ROWS.map((r) => {
                const on = matched === r.id;
                const s = on ? r.after : r.before;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="row"
                      data-on={on ? "" : undefined}
                      disabled={busy}
                      onClick={() => ask({ text: r.ask[lang] || r.ask["en-IN"] })}
                      aria-label={`Ask about ${r.who}, ₹${r.amount}`}
                    >
                      <span className="row__date">{r.date}</span>
                      <span className="row__who">
                        {r.who}
                        <small>{r.how}</small>
                      </span>
                      <span className="row__amt">
                        <Counter value={r.amount} locale="en-IN" prefix="₹" fontSize={16} intro={false} motionBlur={false} />
                      </span>
                      <span className="row__status">
                        <StatusMark status={s.status} label={s.label} size={15} fontSize={13} color="var(--ink-2)" doneColor="var(--leaf)" errorColor="var(--chilli)" strike={false} />
                        <span className="row__ask">Ask about this</span>
                      </span>
                    </button>
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
                label="Working"
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
              <p className="trace__empty">Three Sarvam calls per answer. Timings land here.</p>
            )}
          </section>
        </aside>
      </main>

      <Journey />

      <section className="why" aria-labelledby="why-h">
        <h2 id="why-h">Why this</h2>
        <ul className="why__grid">
          {STATS.map((s) => (
            <li key={s.text}>
              <Counter value={s.value} locale="en-IN" decimals={s.decimals} suffix={s.suffix} fontSize={40} fontWeight={600} className="why__num" />
              <p>{s.text}</p>
              <a href={s.src[1]} target="_blank" rel="noreferrer">{s.src[0]}</a>
            </li>
          ))}
        </ul>
        <p className="why__gap">
          NPCI's new <a href="https://yourstory.com/2026/09/bhim-myupi-9-upi-services-ai-assistant" target="_blank" rel="noreferrer">BHIM MyUPI</a> takes
          complaints by chat, in five languages. Kannada isn't one. Everyone else is still on hold.
        </p>
      </section>

      <footer className="foot">
        <p>
          Saathi Bank is made up. So is the passbook. Reversal dates follow{" "}
          <a href="https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693" target="_blank" rel="noreferrer">RBI rules</a>: T+5
          days for a failed UPI payment to a shop, T+1 to a person, then ₹100 a day for any delay. Your voice goes to Sarvam to be
          transcribed. Nothing is stored here.
        </p>
        <p>
          UI bits from <a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits</a>. Code on{" "}
          <a href="https://github.com/Nivivacious/kahan-gaya-paisa" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </footer>
    </div>
  );
}
