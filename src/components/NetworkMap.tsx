"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Producer } from "@/lib/api";
import { km } from "@/lib/format";

// The design's minimal map ("Mapa Red"): an invented line drawing of streets, avenues, squares and a stream as a
// backdrop — not real geography — with the buyer and the farms placed by their coordinates on top. The farms'
// points are already approximate (the API snaps them to ~500 m).

const NS_ART = { w: 1000, h: 500 };
const PAD = 40;

interface Props {
  producers: Producer[];
  me: { lat: number; lng: number; label: string };
  selected: string | null;
  onSelect: (id: string) => void;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Seeded so the backdrop never changes between renders. */
function backdrop() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grid: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
  for (let i = -800; i <= 1800; i += 24) {
    const major = Math.round(i / 24) % 6 === 0;
    grid.push({ x1: i, y1: -600, x2: i, y2: 1100, major }, { x1: -800, y1: i - 500, x2: 1800, y2: i - 500, major });
  }
  const alleys = Array.from({ length: 140 }, () => {
    const x = -400 + rnd() * 1800;
    const y = -400 + rnd() * 1300;
    const l = 10 + rnd() * 30;
    return { x1: x, y1: y, x2: x + l * (rnd() - 0.5), y2: y + l };
  });
  return { grid, alleys };
}

const ART = backdrop();

interface Pin {
  p: Producer;
  x: number;
  y: number;
  label: { x: number; y: number; w: number; side: "L" | "R"; dy: number };
  /** No free spot for its label (narrow screens): only the dot shows, and the label when it is selected. */
  crowded: boolean;
}

/** Each label tries the side with room, then shifts up or down (with a leader line) to avoid the others; one
 * that can't avoid them is left out rather than drawn over another. */
function layout(producers: Producer[], me: Props["me"], W: number, H: number) {
  const lats = [me.lat, ...producers.map((p) => p.lat)];
  const lngs = [me.lng, ...producers.map((p) => p.lng)];
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.01);
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.01);
  const b = {
    n: Math.max(...lats) + spanLat * 0.12,
    s: Math.min(...lats) - spanLat * 0.12,
    w: Math.min(...lngs) - spanLng * 0.08,
    e: Math.max(...lngs) + spanLng * 0.08,
  };
  const P = (lat: number, lng: number) => [PAD + ((lng - b.w) / (b.e - b.w)) * (W - 2 * PAD), PAD + ((b.n - lat) / (b.n - b.s)) * (H - 2 * PAD)];
  const [mx, my] = P(me.lat, me.lng);
  const placed = producers.map((p) => {
    const [x, y] = P(p.lat, p.lng);
    return { x: x - 12, y: y - 12, w: 24, h: 24 };
  });
  placed.push({ x: mx - 14, y: my - 14, w: 116, h: 28 });
  const hit = (r: { x: number; y: number; w: number; h: number }) =>
    placed.some((q) => r.x < q.x + q.w + 4 && r.x + r.w + 4 > q.x && r.y < q.y + q.h + 4 && r.y + r.h + 4 > q.y);
  const pins: Pin[] = [];
  [...producers]
    .sort((a, c) => P(a.lat, a.lng)[1] - P(c.lat, c.lng)[1])
    .forEach((p) => {
      const [x, y] = P(p.lat, p.lng);
      const d = p.distance_km != null ? km(p.distance_km) : "";
      const w = (p.name.length + d.length) * 6.6 + 30;
      const pref: ("L" | "R")[] = x > W * 0.6 ? ["L", "R"] : ["R", "L"];
      const opts: { side: "L" | "R"; dy: number }[] = [];
      [0, 28, -28, 52, -52, 76, -76].forEach((dy) => pref.forEach((side) => opts.push({ side, dy })));
      const rectOf = (o: { side: "L" | "R"; dy: number }) => ({ x: o.side === "L" ? x - 16 - w : x + 16, y: y + o.dy - 13, w, h: 26 });
      const fits = (o: { side: "L" | "R"; dy: number }) => {
        const r = rectOf(o);
        return r.x >= 4 && r.x + w <= W - 4 && r.y >= 4 && r.y + 26 <= H - 4;
      };
      const free = opts.find((c) => fits(c) && !hit(rectOf(c)));
      const o = free ?? opts.find((c) => fits(c) && c.dy === 0) ?? opts[0];
      const r = rectOf(o);
      if (free) placed.push(r);
      pins.push({ p, x, y, label: { x: r.x - x, y: r.y - y, w, side: o.side, dy: o.dy }, crowded: !free });
    });
  return { pins, me: { x: mx, y: my } };
}

export function NetworkMap({ producers, me, selected, onSelect }: Props) {
  const [ref, { w: W, h: H }] = useSize();
  const placed = useMemo(() => (W && H ? layout(producers, me, W, H) : null), [producers, me, W, H]);
  const s = Math.max(W / NS_ART.w, H / NS_ART.h);

  return (
    <div ref={ref} className="network-map">
      {placed && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa de huertas cercanas">
          <rect x={0} y={0} width={W} height={H} fill="var(--color-bg)" />
          <g transform={`translate(${(W - NS_ART.w * s) / 2} ${(H - NS_ART.h * s) / 2}) scale(${s})`} aria-hidden>
            {[[90, 300, 130, 90], [520, 60, 90, 70], [700, 330, 150, 110], [300, 120, 60, 50], [860, 90, 80, 60]].map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={14} fill="var(--color-accent-2-200)" />
            ))}
            <ellipse cx={775} cy={385} rx={30} ry={18} fill="var(--color-accent-2-400)" opacity={0.5} />
            <g transform="rotate(-38 500 250)">
              {ART.grid.map(({ major, ...l }, i) => (
                <line key={i} {...l} className="st" strokeWidth={major ? 3.2 : 0.9} opacity={major ? 0.85 : 0.38} />
              ))}
              {ART.alleys.map((l, i) => (
                <line key={`a${i}`} {...l} className="st" strokeWidth={0.7} opacity={0.3} />
              ))}
            </g>
            {[["M-50 520 L1050 -40", 4.5], ["M-50 -20 L1050 540", 4.5], ["M0 250 C 250 230, 600 280, 1000 240", 5]].map(([d, w]) => (
              <path key={d} d={d as string} className="st" strokeWidth={w as number} />
            ))}
            <path d="M-20 120 C 120 160, 200 90, 340 150 S 520 230, 640 200 S 860 150, 1020 210" fill="none" stroke="var(--color-accent-2-300)" strokeWidth={7} strokeLinecap="round" />
            {[[500, 250], [255, 118], [745, 382]].map(([cx, cy]) => (
              <circle key={`${cx}`} cx={cx} cy={cy} r={9} fill="var(--color-bg)" className="st" strokeWidth={3} />
            ))}
          </g>
          <circle cx={placed.me.x} cy={placed.me.y} r={Math.min(W, H) * 0.4} fill="var(--color-accent-2)" opacity={0.08} />
          {/* the selected pin last, so its label sits on top */}
          {[...placed.pins].sort((a, c) => Number(a.p.id === selected) - Number(c.p.id === selected)).map(({ p, x, y, label, crowded }) => (
            <g
              key={p.id}
              className={`pin${selected === p.id ? " on" : ""}${selected && selected !== p.id ? " dim" : ""}`}
              transform={`translate(${x} ${y})`}
              onClick={() => onSelect(p.id)}
              role="button"
              tabIndex={0}
              aria-label={`${p.name}${p.distance_km != null ? `, a ${km(p.distance_km)}` : ""}`}
              aria-pressed={selected === p.id}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p.id)}
            >
              {(!crowded || selected === p.id) && (
                <>
                  {label.dy !== 0 && <line x1={0} y1={0} x2={label.side === "L" ? -16 : 16} y2={label.dy} stroke="var(--color-accent-2-700)" strokeWidth={1.5} />}
                  <rect className="lbl" x={label.x} y={label.y} width={label.w} height={26} rx={13} />
                  <text x={label.x + 12} y={label.dy + 4}>
                    {p.name}
                    {p.distance_km != null && (
                      <tspan className="d" dx={6}>
                        {km(p.distance_km)}
                      </tspan>
                    )}
                  </text>
                </>
              )}
              <circle className="dot" r={11} />
            </g>
          ))}
          <g transform={`translate(${placed.me.x} ${placed.me.y})`}>
            <circle r={22} fill="var(--color-accent)" opacity={0.22} />
            <circle r={13} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={4} />
            <rect x={22} y={-13} width={Math.max(80, me.label.length * 7 + 24)} height={26} rx={13} fill="var(--color-accent-100)" />
            <text x={34} y={4} className="me-label">
              {me.label}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
