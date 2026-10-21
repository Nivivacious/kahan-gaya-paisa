import { useEffect, useRef, useState } from "react";
import Counter from "./rb/Counter.jsx";

// "Follow the ₹1,240": scrub the days after a failed UPI payment to a shop.
// RBI's rule: reversed within T+5 days, then ₹100 a day for every day late.
const DAYS = 9; // T to T+8
const DEADLINE = 5;

function where(day, late) {
  if (day === 0) return { pos: 0.5, tone: "stuck", text: "₹1,240 leaves Lakshmi's account. The shop's bank never confirms. The payment is marked failed." };
  if (!late) {
    if (day === 1) return { pos: 0.25, tone: "moving", text: "Reversal starts. The money is on its way back." };
    return { pos: 0, tone: "home", text: `Back in her account. The rule allows up to day ${DEADLINE}; this one made it on day 2.` };
  }
  if (day <= DEADLINE) return { pos: 0.5, tone: "stuck", text: `Still stuck in the network. The bank has until day ${DEADLINE}.` };
  return { pos: 0.5, tone: "late", text: `Day ${day}. Past the deadline, so the bank owes her ₹100 for every extra day, without her having to ask.` };
}

export default function Journey() {
  const [day, setDay] = useState(0);
  const [late, setLate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setDay((d) => {
        if (d >= DAYS - 1) {
          setPlaying(false);
          return d;
        }
        return d + 1;
      });
    }, 1100);
    return () => clearInterval(timer.current);
  }, [playing]);

  const s = where(day, late);
  const owed = late && day > DEADLINE ? (day - DEADLINE) * 100 : 0;

  return (
    <section className="journey" aria-labelledby="journey-h">
      <div className="journey__head">
        <h2 id="journey-h">Follow the ₹1,240</h2>
        <div className="journey__toggle" role="group" aria-label="Scenario">
          <button type="button" aria-pressed={!late} onClick={() => setLate(false)}>Bank on time</button>
          <button type="button" aria-pressed={late} onClick={() => setLate(true)}>Bank late</button>
        </div>
      </div>

      <div className="track" data-tone={s.tone}>
        <div className="track__line" />
        {[
          ["Lakshmi's bank", 0],
          ["UPI network", 0.5],
          ["Shop's bank", 1],
        ].map(([label, at]) => (
          <div key={label} className="track__node" style={{ left: `${at * 100}%` }}>
            <span className="track__dot" />
            <span className="track__label">{label}</span>
          </div>
        ))}
        <div className="track__coin" style={{ left: `${s.pos * 100}%` }}>₹</div>
      </div>

      <p className="journey__text" aria-live="polite">{s.text}</p>

      <div className="journey__controls">
        <button
          type="button"
          className="journey__play"
          onClick={() => {
            if (day >= DAYS - 1) setDay(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : day >= DAYS - 1 ? "Replay" : "Play"}
        </button>
        <label className="journey__slider">
          <span className="sr">Day</span>
          <input
            type="range"
            min="0"
            max={DAYS - 1}
            step="1"
            value={day}
            onChange={(e) => {
              setPlaying(false);
              setDay(Number(e.target.value));
            }}
            style={{ "--p": `${(day / (DAYS - 1)) * 100}%`, "--d": `${(DEADLINE / (DAYS - 1)) * 100}%` }}
          />
          <span className="journey__days" aria-hidden="true">
            {Array.from({ length: DAYS }, (_, i) => (
              <span key={i} data-on={i === day ? "" : undefined} data-deadline={i === DEADLINE ? "" : undefined}>
                {i === 0 ? "T" : `+${i}`}
              </span>
            ))}
          </span>
        </label>
        <div className="journey__owed" data-on={owed ? "" : undefined}>
          <span>Bank owes</span>
          <Counter value={owed} locale="en-IN" prefix="₹" fontSize={26} fontWeight={600} intro={false} />
        </div>
      </div>
    </section>
  );
}
