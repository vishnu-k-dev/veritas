import { motion } from 'framer-motion';

/**
 * CompetencyRadar — SVG hexagonal radar chart, no external chart library.
 *
 * Props:
 *   scores: {
 *     problemSolving: number,   // 0–100
 *     communication: number,
 *     authenticity: number,
 *     ownership: number,
 *     technicalDepth: number,
 *     consistency: number,
 *   }
 *   size?: number   default 280
 */

const DIMENSIONS = [
    { key: 'problemSolving',  label: 'Problem\nSolving'   },
    { key: 'technicalDepth',  label: 'Technical\nDepth'   },
    { key: 'consistency',     label: 'Consistency'         },
    { key: 'communication',   label: 'Communication'       },
    { key: 'ownership',       label: 'Ownership'           },
    { key: 'authenticity',    label: 'Authenticity'        },
];

const N = DIMENSIONS.length;
const RINGS = [25, 50, 75, 100];

const toRad = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;

const pt = (r, i, cx, cy) => ({
    x: cx + r * Math.cos(toRad(i)),
    y: cy + r * Math.sin(toRad(i)),
});

const toPoints = (values, maxR, cx, cy) =>
    values.map((v, i) => pt(maxR * (v / 100), i, cx, cy));

const pointsStr = (pts) => pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export default function CompetencyRadar({ scores = {}, size = 280 }) {
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.35;
    const labelR = size * 0.47;

    const values = DIMENSIONS.map(d => scores[d.key] ?? 0);
    const dataPts = toPoints(values, maxR, cx, cy);
    const dataStr = pointsStr(dataPts);

    // Animated polygon: start from center, expand to real values
    const zeroPts = toPoints(DIMENSIONS.map(() => 0), maxR, cx, cy);
    const zeroStr = pointsStr(zeroPts);

    return (
        <div className="flex flex-col items-center gap-4">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="overflow-visible"
            >
                {/* Grid rings */}
                {RINGS.map(pct => {
                    const r = maxR * (pct / 100);
                    const ringPts = DIMENSIONS.map((_, i) => pt(r, i, cx, cy));
                    return (
                        <polygon
                            key={pct}
                            points={pointsStr(ringPts)}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Ring labels (25, 50, 75, 100) on the right axis */}
                {RINGS.map(pct => {
                    const r = maxR * (pct / 100);
                    const p = pt(r, 1, cx, cy); // place on second axis (top-right)
                    return (
                        <text
                            key={pct}
                            x={p.x + 3}
                            y={p.y - 3}
                            fontSize="7"
                            fill="rgba(255,255,255,0.2)"
                            textAnchor="start"
                        >
                            {pct}
                        </text>
                    );
                })}

                {/* Axis spokes */}
                {DIMENSIONS.map((_, i) => {
                    const outer = pt(maxR, i, cx, cy);
                    return (
                        <line
                            key={i}
                            x1={cx} y1={cy}
                            x2={outer.x} y2={outer.y}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Data polygon — animated */}
                <motion.polygon
                    points={zeroStr}
                    fill="rgba(99,102,241,0.15)"
                    stroke="rgba(99,102,241,0.7)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    animate={{ points: dataStr }}
                    initial={{ points: zeroStr }}
                    transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
                />

                {/* Data point dots */}
                {dataPts.map((p, i) => (
                    <motion.circle
                        key={i}
                        cx={cx} cy={cy} r={3}
                        fill="#818CF8"
                        stroke="#312E81"
                        strokeWidth="1.5"
                        animate={{ cx: p.x, cy: p.y }}
                        initial={{ cx, cy }}
                        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 + i * 0.05 }}
                    />
                ))}

                {/* Axis labels */}
                {DIMENSIONS.map((dim, i) => {
                    const p = pt(labelR, i, cx, cy);
                    const lines = dim.label.split('\n');
                    const anchor =
                        Math.abs(p.x - cx) < 4 ? 'middle' :
                        p.x < cx ? 'end' : 'start';
                    const baseY = p.y - ((lines.length - 1) * 8) / 2;

                    return (
                        <g key={i}>
                            {lines.map((line, li) => (
                                <text
                                    key={li}
                                    x={p.x}
                                    y={baseY + li * 10}
                                    textAnchor={anchor}
                                    dominantBaseline="middle"
                                    fontSize="9"
                                    fill="rgba(160,160,160,0.9)"
                                    fontWeight="600"
                                    fontFamily="'Manrope', sans-serif"
                                >
                                    {line}
                                </text>
                            ))}
                        </g>
                    );
                })}

                {/* Score dots with value labels on hover — show values statically */}
                {dataPts.map((p, i) => (
                    <motion.text
                        key={`val-${i}`}
                        x={cx} y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="8"
                        fill="rgba(129,140,248,0.8)"
                        fontWeight="700"
                        fontFamily="monospace"
                        animate={{ x: p.x, y: p.y + (p.y >= cy ? 10 : -10) }}
                        initial={{ x: cx, y: cy }}
                        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 + i * 0.05 }}
                    >
                        {values[i]}
                    </motion.text>
                ))}
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-indigo-400/70 rounded" />
                    <span>Assessed</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-3 h-0.5 bg-white/10 rounded" />
                    <span>Benchmark</span>
                </div>
            </div>
        </div>
    );
}
