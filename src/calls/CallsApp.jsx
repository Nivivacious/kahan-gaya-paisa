import { useEffect, useMemo, useRef, useState } from "react";
import StatusMark from "../rb/StatusMark.jsx";
import ThoughtLine from "../rb/ThoughtLine.jsx";
import Counter from "../rb/Counter.jsx";
import { toWavBase64 } from "../recorder.js";

const QUEUE = [
  { id: "A", time: "11:20", title: "EMI reminder", lang: "Hindi", agent: "Rohan", amount: 4200 },
  { id: "B", time: "20:40", title: "Third reminder", lang: "Hindi", agent: "Unnamed", amount: 6000 },
  { id: "C", time: "14:05", title: "Follow-up", lang: "Kannada", agent: "Manjunath", amount: 2800 },
];

const LANG = { "hi-IN": "Hindi", "kn-IN": "Kannada", "ta-IN": "Tamil", "te-IN": "Telugu", "en-IN": "English", "mr-IN": "Marathi", "bn-IN": "Bengali", "gu-IN": "Gujarati", "ml-IN": "Malayalam", "pa-IN": "Punjabi", "od-IN": "Odia" };

const SHORT = {
  hours: "After hours",
  recorded: "No recording notice",
  identity: "No name",
  threats: "Threat",
  third_party: "Third party",
  misleading: "Misleading",
  sensitive: "Ignored emergency",
};

const secs = (ms) => (ms / 1000).toFixed(1) + " s";
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function CallsApp() {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [trace, setTrace] = useState(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploadTime, setUploadTime] = useState("21:15");
  const audioRef = useRef(null);
  const resultRef = useRef(null);

  async function run(payload, label) {
    setBusy(true);
    setError("");
    setPicked(label);
    setResult(null);
    setTrace({
      working: true,
      steps: payload.sample ? ["Voicing the sample call with Bulbul v3", "Splitting at pauses, transcribing with Saaras v4"] : ["Splitting at pauses, transcribing with Saaras v4"],
    });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const r = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({ error: "Something broke on our side. Try again." }));
      if (!r.ok) throw new Error(data.error || "Something broke. Try again.");
      const t = data.timings || {};
      const steps = [];
      if (t.voice_ms != null) steps.push(`Bulbul v3 voiced the script in two voices · ${secs(t.voice_ms)}`);
      steps.push(`Saaras v4 transcribed ${data.call.seconds.toFixed(0)} s of ${LANG[data.language] || "speech"} in ${data.segments.length} pieces · ${secs(t.stt_ms)}`);
      steps.push(`Sarvam-105B checked it against ${data.checks.length} rules · ${secs(t.llm_ms)}`);
      setTrace({ working: false, steps, elapsed: ((t.voice_ms || 0) + (t.stt_ms || 0) + (t.llm_ms || 0)) / 1000 });
      setResult({ ...data, localAudio: payload.localAudio || null });
    } catch (e) {
      setError(e.message);
      setTrace(null);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const audio = await toWavBase64(file);
      if (!audio) return setError("That recording is too short.");
      run({ audio, calledAt: uploadTime, localAudio: URL.createObjectURL(file) }, "upload");
    } catch {
      setError("Couldn't read that file. Try an MP3, M4A or WAV under 30 seconds.");
    }
  }

  // Track playback for the active line and the playhead.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setNow(el.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const src = result ? (result.audio ? `data:audio/wav;base64,${result.audio}` : result.localAudio) : null;
  const duration = result?.call?.seconds || 1;
  const failed = useMemo(() => (result ? result.checks.filter((c) => c.pass === false) : []), [result]);
  const flagsBySeg = useMemo(() => {
    const m = {};
    failed.forEach((c) => {
      if (c.seg == null) return;
      (m[c.seg] = m[c.seg] || []).push(c.id);
    });
    return m;
  }, [failed]);
  const segOf = (i) => result?.segments.find((s) => s.i === i);

  function seek(t) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, t - 0.05);
    el.play();
  }

  return (
    <div className="page hc">
      <nav className="hc-nav">
        <a href="/">Kahan gaya paisa?</a>
        <span aria-current="page">Hear every call</span>
      </nav>

      <header className="hc-hero">
        <h1>Hear every call.</h1>
        <p className="hc-lede">
          From 1 January 2027, every loan recovery call in India has to be recorded and kept for six months. Recording is the easy
          part. This one listens.
        </p>
        <p className="hc-built">
          A demo on Sarvam's Saaras v4, Sarvam-105B and Bulbul v3. By Nivedita Prabhu.{" "}
          <a href="https://www.corplawupdates.in/updates/rbi-amendment-directions-recovery-agents-loan-dues-2026" target="_blank" rel="noreferrer">The RBI rules</a>
        </p>
      </header>

      <section className="hc-queue" aria-labelledby="queue-h">
        <div className="hc-queue__head">
          <h2 id="queue-h">Today's recovery calls</h2>
          <p>Saathi Finance. Pick one to audit.</p>
        </div>
        <ol className="hc-calls">
          {QUEUE.map((c) => (
            <li key={c.id}>
              <button type="button" className="hc-call" data-on={picked === c.id ? "" : undefined} disabled={busy} onClick={() => run({ sample: c.id }, c.id)}>
                <span className="hc-call__time">{c.time}</span>
                <span className="hc-call__title">{c.title}</span>
                <span className="hc-call__meta">{c.lang}. Agent {c.agent}. ₹{c.amount.toLocaleString("en-IN")} due.</span>
                <span className="hc-call__go">{busy && picked === c.id ? "Listening…" : "Audit this call"}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="hc-upload">
          <label className="hc-upload__file">
            <input type="file" accept="audio/*" onChange={onUpload} disabled={busy} />
            <span>Or upload your own recording</span>
          </label>
          <label className="hc-upload__time">
            Called at
            <input type="time" value={uploadTime} onChange={(e) => setUploadTime(e.target.value)} />
          </label>
          <small>Under 30 seconds. It goes to Sarvam to be transcribed and isn't stored.</small>
        </div>
      </section>

      <div ref={resultRef} className="hc-result" aria-live="polite">
        {error ? <p className="hc-error" role="alert">{error}</p> : null}

        {(busy || result) && (
          <div className="hc-grid">
            <section className="hc-panel hc-listen" aria-labelledby="listen-h">
              <h2 id="listen-h">{result ? result.call.title : "Listening…"}</h2>
              {result && (
                <p className="hc-sub">
                  {result.call.lender}. {result.call.calledAt ? `Called at ${result.call.calledAt}` : "Call time unknown"}. {clock(duration)} long.
                </p>
              )}

              {result && (
                <div className="hc-player">
                  <audio
                    ref={audioRef}
                    src={src}
                    preload="auto"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                  />
                  <button type="button" className="hc-play" onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())} aria-label={playing ? "Pause" : "Play the call"}>
                    {playing ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
                    )}
                  </button>
                  <div
                    className="hc-bar"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      seek(((e.clientX - r.left) / r.width) * duration);
                    }}
                  >
                    {result.segments.map((s) => (
                      <span key={s.i} className="hc-bar__seg" style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%` }} />
                    ))}
                    <span className="hc-bar__fill" style={{ width: `${Math.min(100, (now / duration) * 100)}%` }} />
                    {Object.keys(flagsBySeg).map((k) => {
                      const s = segOf(Number(k));
                      return s ? (
                        <button
                          key={k}
                          type="button"
                          className="hc-bar__flag"
                          style={{ left: `${(s.start / duration) * 100}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            seek(s.start);
                          }}
                          aria-label={`Jump to ${flagsBySeg[k].map((id) => SHORT[id]).join(", ")} at ${clock(s.start)}`}
                        />
                      ) : null;
                    })}
                  </div>
                  <span className="hc-clock">{clock(now)}</span>
                </div>
              )}

              {result ? (
                <ol className="hc-turns">
                  {result.turns.map((t, k) => {
                    const s = segOf(t.seg) || {};
                    const flags = flagsBySeg[t.seg] || [];
                    const active = s.start != null && now >= s.start && now < (s.end ?? s.start + 3) && playing;
                    return (
                      <li key={k}>
                        <button type="button" className="hc-turn" data-who={t.speaker} data-flag={flags.length ? "" : undefined} data-active={active ? "" : undefined} onClick={() => s.start != null && seek(s.start)}>
                          <span className="hc-turn__who">
                            {t.speaker === "agent" ? "Agent" : "Borrower"}
                            {s.start != null && <span className="hc-turn__at">{clock(s.start)}</span>}
                          </span>
                          <span className="hc-turn__text" lang={result.language || undefined}>{t.text}</span>
                          {t.english && <span className="hc-turn__en">{t.english}</span>}
                          {flags.length > 0 && (
                            <span className="hc-turn__flags">
                              {flags.map((id) => <span key={id} className="hc-chip">{SHORT[id] || id}</span>)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="hc-wait" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </div>
              )}
            </section>

            <aside className="hc-side">
              <section className="hc-panel hc-score" aria-labelledby="score-h">
                <h2 id="score-h" className="sr">Audit</h2>
                {result ? (
                  <>
                    <div className="hc-verdict" data-tone={failed.length === 0 ? "ok" : failed.length > 2 ? "bad" : "warn"}>
                      <Counter value={failed.length} fontSize={56} fontWeight={600} intro={false} />
                      <span>{failed.length === 1 ? "rule broken" : "rules broken"}, out of {result.checks.length}</span>
                    </div>
                    {result.summary && <p className="hc-summary">{result.summary}</p>}
                    <ul className="hc-checks">
                      {result.checks.map((c) => (
                        <li key={c.id} data-fail={c.pass === false ? "" : undefined}>
                          <StatusMark status={c.pass === false ? "failed" : "done"} label={c.label} size={16} fontSize={14.5} color="var(--ink)" doneColor="var(--leaf)" errorColor="var(--chilli)" strike={false} />
                          {c.why && <p>{c.why}</p>}
                          {c.pass === false && c.seg != null && segOf(c.seg) && (
                            <button type="button" className="hc-jump" onClick={() => seek(segOf(c.seg).start)}>
                              Hear it at {clock(segOf(c.seg).start)}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {result.promise && (result.promise.amount_inr || result.promise.date) && (
                      <div className="hc-promise">
                        <span>Promise to pay</span>
                        <strong>
                          {result.promise.amount_inr ? `₹${Number(result.promise.amount_inr).toLocaleString("en-IN")}` : "Amount not said"}
                          {result.promise.date ? `, ${result.promise.date}` : ""}
                        </strong>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="hc-sub">Checking seven rules…</p>
                )}
              </section>

              <section className="hc-panel" aria-labelledby="htrace-h">
                <h2 id="htrace-h">Behind this audit</h2>
                {trace && (
                  <ThoughtLine
                    key={trace.working ? "w" : "d" + trace.elapsed}
                    label="Working"
                    doneLabel="Done in"
                    glyph="dot"
                    steps={trace.steps}
                    working={trace.working}
                    elapsed={trace.working ? undefined : trace.elapsed}
                    collapseOnSettle={false}
                    fontSize={15}
                    color="var(--ink)"
                    glyphColor="var(--kite)"
                  />
                )}
              </section>
            </aside>
          </div>
        )}
      </div>

      <section className="why" aria-labelledby="hwhy-h">
        <h2 id="hwhy-h">Why this</h2>
        <ul className="why__grid hc-why">
          <li>
            <span className="why__num hc-big">1 Jan 2027</span>
            <p>Recovery calls must be recorded, kept six months, and the borrower told.</p>
            <a href="https://www.corporateprofessionals.com/articles/when-the-recovery-call-comes-rbi-rewrites-the-rules-of-engagement-for-nbfcs/" target="_blank" rel="noreferrer">RBI directions, 6 Aug 2026</a>
          </li>
          <li>
            <span className="why__num hc-big">₹45 an hour</span>
            <p>for Saaras with speaker labels. About ₹3.75 for a five-minute call.</p>
            <a href="https://docs.sarvam.ai/api/pricing" target="_blank" rel="noreferrer">Sarvam pricing</a>
          </li>
          <li>
            <span className="why__num hc-big">1 crore+</span>
            <p>calls Mahindra Finance has run on Sarvam. Every one gets analysed afterwards.</p>
            <a href="https://www.sarvam.ai/stories/mahindra-finance-voice-agents" target="_blank" rel="noreferrer">Sarvam customer story</a>
          </li>
        </ul>
      </section>

      <footer className="foot">
        <p>
          Saathi Finance is made up. The sample calls are scripts voiced by Bulbul v3 in two voices, so there's real audio to transcribe.
          The checks summarise RBI's recovery directions. Not legal advice.
        </p>
        <p>
          UI bits from <a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits</a>. Code on{" "}
          <a href="https://github.com/Nivivacious/kahan-gaya-paisa" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </footer>
    </div>
  );
}
