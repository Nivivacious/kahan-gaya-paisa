// An original patang (Indian fighter kite) on a string. It sways when idle,
// flutters while the caller is speaking, and steadies once the answer is in.
export default function Kite({ state = "idle" }) {
  return (
    <svg className="kite" data-state={state} viewBox="0 0 320 420" role="img" aria-label="A pink paper kite on a long string">
      <path
        className="kite__string"
        d="M168 150 C 150 230, 210 280, 150 340 S 60 400, 20 418"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <g className="kite__body">
        <path d="M168 10 L250 92 L168 174 L86 92 Z" className="kite__paper" />
        <path d="M168 10 L250 92 L168 92 Z" className="kite__fold" />
        <path d="M168 10 L168 174" className="kite__spar" />
        <path d="M86 92 Q168 56 250 92" className="kite__spar" fill="none" />
        <path d="M168 174 l-14 22 h28 Z" className="kite__tail" />
        <circle cx="168" cy="92" r="9" className="kite__dot" />
      </g>
    </svg>
  );
}
