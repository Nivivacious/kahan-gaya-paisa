import { useEffect, useMemo, useRef, useState } from "react";
import VoicePill from "./rb/VoicePill.jsx";
import ThoughtLine from "./rb/ThoughtLine.jsx";
import StatusMark from "./rb/StatusMark.jsx";
import Counter from "./rb/Counter.jsx";
import RotatingText from "./rb/RotatingText.jsx";
import Kite from "./Kite.jsx";
import Journey from "./Journey.jsx";
import Ivr from "./Ivr.jsx";
import ApiPeek, { TURN_CALLS } from "./ApiPeek.jsx";
import { createRecorder } from "./recorder.js";
import { player, playQueue, stopQueue, progress, speaking as isSpeaking } from "./audio.js";

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

const ROWS_LAKSHMI = [
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


const ROWS_RAMESH = [
  {
    id: "R1",
    date: istDate(0),
    who: "Suresh Kumar",
    how: "UPI, to a friend",
    amount: 5000,
    before: { status: "failed", label: "Failed, money debited" },
    after: { status: "running", label: `Back by ${istDate(1)}` },
    ask: {
      "hi-IN": "सुरेश को भेजे पाँच हज़ार फेल हो गए, पैसा कट गया। कब वापस आएगा?",
      "kn-IN": "ಸುರೇಶ್‌ಗೆ ಕಳಿಸಿದ ಐದು ಸಾವಿರ ಫೇಲ್ ಆಯ್ತು, ದುಡ್ಡು ಯಾವಾಗ ವಾಪಸ್?",
      "ta-IN": "சுரேஷுக்கு அனுப்பின ஐயாயிரம் ஃபெயில் ஆச்சு, பணம் எப்போ வரும்?",
      "te-IN": "సురేష్‌కి పంపిన ఐదు వేలు ఫెయిల్ అయింది, డబ్బు ఎప్పుడు వస్తుంది?",
      "en-IN": "My ₹5,000 to Suresh failed but got debited. When's it back?",
    },
  },
  {
    id: "R2",
    date: istDate(-2),
    who: "Airtel recharge",
    how: "UPI, to a merchant",
    amount: 299,
    before: { status: "failed", label: "Failed, money debited" },
    after: { status: "running", label: `Back by ${istDate(3)}` },
    ask: {
      "hi-IN": "दो सौ निन्यानवे का रिचार्ज फेल हो गया, पैसा कब आएगा?",
      "kn-IN": "ಇನ್ನೂರ ತೊಂಬತ್ತೊಂಬತ್ತು ರೂಪಾಯಿ ರೀಚಾರ್ಜ್ ಫೇಲ್ ಆಯ್ತು, ದುಡ್ಡು ಯಾವಾಗ ಬರುತ್ತೆ?",
      "ta-IN": "இருநூத்தி தொண்ணூத்தி ஒன்பது ரீசார்ஜ் ஃபெயில் ஆச்சு, பணம் எப்போ வரும்?",
      "te-IN": "రెండు వందల తొంభై తొమ్మిది రీఛార్జ్ ఫెయిల్ అయింది, డబ్బు ఎప్పుడు వస్తుంది?",
      "en-IN": "My ₹299 recharge failed. When do I get it back?",
    },
  },
  {
    id: "R3",
    date: istDate(-6),
    who: "Salary",
    how: "NEFT credit",
    amount: 28000,
    before: { status: "done", label: "Credited" },
    after: { status: "done", label: "Credited" },
    ask: {
      "hi-IN": "सैलरी आ गई क्या?",
      "kn-IN": "ಸಂಬಳ ಬಂತಾ?",
      "ta-IN": "சம்பளம் வந்துடுச்சா?",
      "te-IN": "జీతం వచ్చిందా?",
      "en-IN": "Did my salary come in?",
    },
  },
];

const CALLERS = {
  lakshmi: {
    name: "Lakshmi",
    place: "Bengaluru",
    lang: "kn-IN",
    account: "Savings ••4417",
    rows: ROWS_LAKSHMI,
    empty: "Lakshmi paid the kirana ₹1,240 yesterday. Payment failed. Money got cut. Ask like she would, or tap a payment in her passbook.",
    pronoun: "her",
  },
  ramesh: {
    name: "Ramesh",
    place: "Delhi",
    lang: "hi-IN",
    account: "Savings ••8830",
    rows: ROWS_RAMESH,
    empty: "Ramesh sent his friend ₹5,000 this morning. It failed, but the money left. Ask like he would, or tap a payment in his passbook.",
    pronoun: "his",
  },
};

const ASK_PERSON = {
  "kn-IN": "ನನಗೆ ಯಾರಾದ್ರೂ ಮನುಷ್ಯರ ಜೊತೆ ಮಾತಾಡಬೇಕು",
  "hi-IN": "मुझे किसी इंसान से बात करनी है",
  "ta-IN": "எனக்கு யாராவது ஒரு ஆள்கிட்ட பேசணும்",
  "te-IN": "నాకు ఎవరైనా మనిషితో మాట్లాడాలి",
  "en-IN": "I want to talk to a person.",
};

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
    let raf = 0;
    const mounted = performance.now();
    const tick = () => {
      const p = progress();
      // The queue starts a frame after this line renders; give it a moment before giving up.
      if (p === null && performance.now() - mounted < 1500) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (p === null || p >= 1) {
        setLit(words.length);
        return;
      }
      setLit(Math.ceil(p * words.length));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => setLit(words.length), 40000);
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
  const [callerId, setCallerId] = useState("lakshmi");
  const caller = CALLERS[callerId];
  const ROWS = caller.rows;
  const [lang, setLang] = useState("kn-IN");
  const [handoff, setHandoff] = useState(null);
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

  // Voice the reply one sentence at a time, in parallel; play the first as soon as it's ready.
  function speakReply(msgIndex, parts, lang, onFirst) {
    const weights = parts.map((p) => p.split(/\s+/).filter(Boolean).length || 1);
    const t0 = performance.now();
    const items = parts.map((text) =>
      fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.audio || null)
        .catch(() => null)
    );
    Promise.all(items).then((audios) =>
      setMessages((m) => m.map((x, i) => (i === msgIndex ? { ...x, audios, weights } : x)))
    );
    setSpeaking(true);
    playQueue(items, weights, {
      onStart: () => onFirst?.((performance.now() - t0) / 1000),
      onDone: (blocked) => {
        setSpeaking(false);
        if (blocked) setStatus("Tap Play again to hear it.");
      },
    });
  }

  function replay(m) {
    if (!m.audios) return;
    setSpeaking(true);
    playQueue(m.audios.map((a) => Promise.resolve(a)), m.weights, { onDone: () => setSpeaking(false) });
  }

  async function ask(payload) {
    if (busy) return;
    stopQueue();
    player(); // set up audio on this tap so the reply can autoplay
    setBusy(true);
    setTrace({ working: true, steps: [payload.audio ? "Sending your voice to Saaras v4" : "Reading the question"] });
    if (payload.text) setMessages((m) => [...m, { role: "user", content: payload.text, typed: true }]);
    setStatus(`Checking ${caller.pronoun} passbook…`);
    setHandoff(null);
    scrollCall();
    try {
      const r = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, lang, history, caller: callerId }),
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
      const base = (t.stt_ms || 0) + (t.llm_ms || 0);
      steps.push(`Bulbul v3 voicing ${data.sentences.length} ${data.sentences.length === 1 ? "sentence" : "sentences"} in ${LANG_NAME[data.lang] || "her language"}, in parallel`);
      setTrace({ working: true, steps });

      let index = 0;
      let convo = [];
      setMessages((m) => {
        const next = [
          ...(payload.audio ? [...m, { role: "user", content: data.customerText, heard: data.heard }] : m),
          { role: "assistant", content: data.reply, lang: data.lang, handoff: data.handoff },
        ];
        index = next.length - 1;
        convo = next.filter((x) => x.role === "user" || x.role === "assistant");
        return next;
      });
      if (data.handoff) {
        requestAnimationFrame(() => startHandoff(convo, row, steps));
      }
      setMatched(data.txn);
      requestAnimationFrame(() =>
        speakReply(index, data.sentences, data.lang, (firstSec) => {
          const done = [...steps];
          done[done.length - 1] = `Bulbul v3 started speaking ${LANG_NAME[data.lang] || ""} · ${firstSec.toFixed(1)} s`;
          setTrace({ working: false, steps: done, elapsed: base / 1000 + firstSec, label: "First words in" });
        })
      );
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

  // Hand the call to a person: Sarvam Translate puts it in English, Sarvam-105B writes the brief.
  async function startHandoff(convo, row, steps) {
    setHandoff({ loading: true });
    try {
      const r = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: `${caller.name}, ${caller.place}`,
          item: row ? `${row.who}, ₹${row.amount}, ${row.how}. Status: ${row.after.label}` : "not matched",
          lines: convo.map((m) => ({ who: m.role === "user" ? "customer" : "bank", text: m.content })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Hand-off failed.");
      setHandoff(d);
      setTrace((tr) => ({
        ...(tr || {}),
        working: false,
        steps: [...(tr?.steps || steps), `Sarvam Translate put the call in English · ${secs(d.timings.translate_ms)}`, `Sarvam-105B wrote the brief for the desk · ${secs(d.timings.llm_ms)}`],
      }));
      scrollCall();
    } catch (e) {
      setHandoff({ error: e.message });
    }
  }

  function switchCaller(id) {
    if (id === callerId || busy) return;
    stopQueue();
    setCallerId(id);
    setLang(CALLERS[id].lang);
    setMessages([]);
    setMatched(null);
    setTrace(null);
    setHandoff(null);
    setStatus("");
  }

  async function onStart() {
    stopQueue();
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

      <Ivr />

      <main className="demo" id="demo">
        <section className="call" aria-labelledby="call-h">
          <div className="call__head">
            <h2 id="call-h">Call Saathi Bank</h2>
            <div className="callers" role="group" aria-label="Who's calling">
              {Object.entries(CALLERS).map(([id, c]) => (
                <button key={id} type="button" aria-pressed={callerId === id} disabled={busy} onClick={() => switchCaller(id)}>
                  {c.name}, {c.place}
                </button>
              ))}
            </div>
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
              <p className="call__empty">{caller.empty}</p>
            ) : (
              messages.map((m, i) =>
                m.role === "error" ? (
                  <p key={i} className="line line--err" role="alert">{m.content}</p>
                ) : (
                  <div key={i} className={`line line--${m.role === "user" ? "me" : "bank"}`} data-old={i < messages.length - 2 ? "" : undefined}>
                    <span className="line__who">
                      {m.role === "user" ? caller.name : "Saathi Bank"}
                      {m.role === "user" && m.heard?.language && (
                        <span className="chip">
                          Saaras heard {LANG_NAME[m.heard.language] || m.heard.language}
                          {m.heard.confidence != null ? `, ${Math.round(m.heard.confidence * 100)}% sure` : ""}
                        </span>
                      )}
                      {m.role === "user" && m.typed && <span className="chip chip--quiet">Typed</span>}
                      {m.role === "assistant" && m.lang && <span className="chip">Replied in {LANG_NAME[m.lang]}</span>}
                    </span>
                    {m.role === "assistant" ? (
                      <>
                        <Subtitle text={m.content} lang={m.lang} live={i === lastBank} />
                        <button type="button" className="line__play" disabled={!m.audios} onClick={() => replay(m)}>{m.audios ? "Play again" : "Voicing…"}</button>
                      </>
                    ) : (
                      <p className="line__text">{m.content}</p>
                    )}
                  </div>
                )
              )
            )}
            {handoff && (
              <div className="handoff" aria-live="polite">
                <span className="handoff__tag">Handed to a person</span>
                {handoff.loading ? (
                  <p className="handoff__brief">Writing the brief for the support desk…</p>
                ) : handoff.error ? (
                  <p className="handoff__brief">{handoff.error}</p>
                ) : (
                  <>
                    <p className="handoff__brief">{handoff.brief}</p>
                    <ol className="handoff__lines">
                      {handoff.lines.map((l, i) => (
                        <li key={i}>
                          <span>{l.who === "customer" ? caller.name : "Bot"}</span>
                          {l.english || l.text}
                        </li>
                      ))}
                    </ol>
                    <small>What the desk sees, in English, translated by Sarvam Translate (Mayura).</small>
                  </>
                )}
              </div>
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
          <button type="button" className="call__person" disabled={busy} onClick={() => ask({ text: ASK_PERSON[lang] || ASK_PERSON["en-IN"] })}>
            Ask for a person
          </button>
        </section>

        <aside className="side">
          <section className="passbook" aria-labelledby="pb-h">
            <div className="passbook__band">
              <h2 id="pb-h">{caller.name}'s passbook</h2>
              <span>{caller.account}. Sample data.</span>
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
                doneLabel={trace.label || "Answered in"}
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
            <ApiPeek blocks={TURN_CALLS} />
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
