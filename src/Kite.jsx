import { useEffect, useRef } from "react";
import { level } from "./audio.js";

// A line-drawn patang. Its string is a live waveform: it ripples with the caller's
// voice while she speaks, and with the bank's voice while it answers.
const W = 360;
const H = 520;
const TAIL = { x: 214, y: 188 };
const END = { x: 30, y: 512 };
const C1 = { x: 160, y: 300 };
const C2 = { x: 250, y: 400 };
const N = 90;

function bez(t) {
  const u = 1 - t;
  const x = u * u * u * TAIL.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * END.x;
  const y = u * u * u * TAIL.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * END.y;
  const dx = 3 * u * u * (C1.x - TAIL.x) + 6 * u * t * (C2.x - C1.x) + 3 * t * t * (END.x - C2.x);
  const dy = 3 * u * u * (C1.y - TAIL.y) + 6 * u * t * (C2.y - C1.y) + 3 * t * t * (END.y - C2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, nx: -dy / len, ny: dx / len };
}
const BASE = Array.from({ length: N + 1 }, (_, i) => bez(i / N));

export default function Kite({ state = "idle" }) {
  const stringRef = useRef(null);
  const bodyRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let env = 0;
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      const target = level();
      env += (target - env) * (target > env ? 0.35 : 0.06);
      const idle = reduce ? 0 : 1.6;
      const amp = idle + env * 34;
      const speed = 2 + env * 10;
      let d = "";
      for (let i = 0; i <= N; i++) {
        const p = BASE[i];
        const taper = Math.sin((i / N) * Math.PI) * (0.35 + 0.65 * (i / N));
        const o = Math.sin(i * 0.42 - t * speed) * amp * taper;
        d += `${i ? "L" : "M"}${(p.x + p.nx * o).toFixed(1)} ${(p.y + p.ny * o).toFixed(1)}`;
      }
      stringRef.current?.setAttribute("d", d);
      if (bodyRef.current && !reduce) {
        const sway = Math.sin(t * 0.9) * 4 + Math.sin(t * 7) * env * 5;
        bodyRef.current.setAttribute("transform", `rotate(${sway.toFixed(2)} 214 110) translate(0 ${(Math.sin(t * 0.7) * 5).toFixed(1)})`);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg className="kite" data-state={state} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path ref={stringRef} className="kite__string" fill="none" />
      <g ref={bodyRef}>
        <path d="M214 30 L292 108 L214 186 L136 108 Z" className="kite__left" />
        <path d="M214 30 L292 108 L214 186 Z" className="kite__right" />
        <path d="M214 30 L214 186" className="kite__line" />
        <path d="M136 108 Q214 66 292 108" className="kite__line" fill="none" />
        <path d="M214 30 L292 108 L214 186 L136 108 Z" className="kite__line" fill="none" />
        <path d="M214 186 l-11 18 h22 Z" className="kite__tassel" />
      </g>
    </svg>
  );
}
