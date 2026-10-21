import { useEffect, useRef, useState } from "react";
import { audioCtx } from "./audio.js";

// What Lakshmi gets today: a bank IVR that only ever loops back to "press 1 for English".
const START = "Welcome to Saathi Bank. For English, press 1. हिंदी के लिए 2 दबाएं।";
const REPLIES = {
  "1": "For balance, press 1. For cards, press 2. For anything else, press 9.",
  "2": "क्षमा करें, यह विकल्प अभी उपलब्ध नहीं है। For English, press 1.",
  "9": "All our executives are busy. Your call is important to us. Please stay on the line.",
  "0": "Invalid input. For English, press 1.",
};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function beep(key) {
  try {
    const c = audioCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 680 + KEYS.indexOf(key) * 40;
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.15);
  } catch {
    /* sound is optional */
  }
}

export default function Ivr() {
  const [line, setLine] = useState(START);
  const [presses, setPresses] = useState(0);
  const [held, setHeld] = useState(null);
  const [now, setNow] = useState(0);
  const timer = useRef(0);

  useEffect(() => {
    if (held == null) return undefined;
    timer.current = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer.current);
  }, [held]);

  function press(k) {
    beep(k);
    if (held == null) setHeld(Date.now());
    const n = presses + 1;
    setPresses(n);
    if (n % 4 === 0) setLine(START);
    else setLine(REPLIES[k] || REPLIES["0"]);
  }

  const secs = held == null ? 0 : Math.floor((now - held) / 1000);

  return (
    <section className="ivr" aria-labelledby="ivr-h">
      <div className="ivr__copy">
        <h2 id="ivr-h">What she gets today</h2>
        <p>Try getting help in Kannada.</p>
        {presses >= 3 && (
          <a className="ivr__out" href="#demo">
            Now ask the way she would
          </a>
        )}
      </div>
      <div className="ivr__phone">
        <div className="ivr__screen" aria-live="polite">
          <span className="ivr__hold">{held == null ? "Saathi Bank helpline" : `On hold ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</span>
          <p>{line}</p>
        </div>
        <div className="ivr__keys">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} aria-label={`Press ${k}`}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
