import { motion } from 'framer-motion';

/**
 * CompetencyTimeline — SVG animated line chart for score progression across questions.
 * No external chart library. Pure SVG + Framer Motion.
 *
 * Props:
 *   turns: Array<{ score: number, label?: string }>
 *   width?: number
 *   height?: number
 */

const PAD = { top: 20, right: 20, bottom: 36, left: 36 };

const COLOR_FOR = (v) => {
    if (v >= 80) return '#34D399';
    if (v >= 60) return '#818CF8';
    if (v >= 40) return '#FBBF24';
    return '#F87171';
};

export default function CompetencyTimeline({ turns = [], width = 560, height = 180 }) {
    if (turns.length < 2) return null;

    const W = width - PAD.left - PAD.right;
    const H = height - PAD.top - PAD.bottom;

    const scores = turns.map(t => t.score);
    const minS = Math.max(0, Math.min(...scores) - 10);
    const maxS = Math.min(100, Math.max(...scores) + 10);
    const range = maxS - minS || 1;

    const xOf = (i) => (i / (turns.length - 1)) * W;
    const yOf = (v) => H - ((v - minS) / range) * H;

    // Build polyline points
    const pts = turns.map((t, i) => `${xOf(i).toFixed(1)},${yOf(t.score).toFixed(1)}`).join(' ');
    // Filled area path
    const areaPath = [
        `M ${xOf(0).toFixed(1)},${yOf(turns[0].score).toFixed(1)}`,
        ...turns.slice(1).map((t, i) => `L ${xOf(i + 1).toFixed(1)},${yOf(t.score).toFixed(1)}`),
        `L ${xOf(turns.length - 1).toFixed(1)},${H}`,
        `L 0,${H}`,
        'Z',
    ].join(' ');

    // Y gridlines at 25, 50, 75, 100 (only within visible range)
    const gridLines = [25, 50, 75, 100].filter(v => v >= minS - 5 && v <= maxS + 5);

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-widest text-text-muted uppercase">
                    Competency Growth
                </span>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>Start: <span className="text-white font-semibold">{scores[0]}</span></span>
                    <span>→</span>
                    <span>End: <span className={`font-semibold`} style={{ color: COLOR_FOR(scores[scores.length - 1]) }}>{scores[scores.length - 1]}</span></span>
                </div>
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full overflow-visible"
                style={{ maxHeight: height }}
            >
                <g transform={`translate(${PAD.left},${PAD.top})`}>
                    {/* Y gridlines */}
                    {gridLines.map(v => (
                        <g key={v}>
                            <line
                                x1={0} y1={yOf(v)}
                                x2={W} y2={yOf(v)}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={-6} y={yOf(v)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize="8"
                                fill="rgba(160,160,160,0.5)"
                            >
                                {v}
                            </text>
                        </g>
                    ))}

                    {/* Filled area */}
                    <motion.path
                        d={areaPath}
                        fill="url(#timelineGrad)"
                        opacity={0.25}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.25 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                    />

                    {/* Gradient def */}
                    <defs>
                        <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Line — animated draw */}
                    <motion.polyline
                        points={pts}
                        fill="none"
                        stroke="#818CF8"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
                        style={{ pathLength: undefined }}
                    />

                    {/* Data points */}
                    {turns.map((t, i) => {
                        const x = xOf(i);
                        const y = yOf(t.score);
                        const col = COLOR_FOR(t.score);
                        return (
                            <g key={i}>
                                <motion.circle
                                    cx={x} cy={y} r={5}
                                    fill={col}
                                    stroke="#1a1a1a"
                                    strokeWidth="2"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                                    style={{ transformOrigin: `${x}px ${y}px` }}
                                />
                                {/* Score label above dot */}
                                <motion.text
                                    x={x}
                                    y={y - 10}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="700"
                                    fill={col}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                >
                                    {t.score}
                                </motion.text>
                                {/* X axis label */}
                                <text
                                    x={x}
                                    y={H + 16}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="rgba(160,160,160,0.6)"
                                >
                                    Q{i + 1}
                                </text>
                            </g>
                        );
                    })}

                    {/* Trend annotation */}
                    {(() => {
                        const delta = scores[scores.length - 1] - scores[0];
                        if (Math.abs(delta) < 5) return null;
                        const improving = delta > 0;
                        return (
                            <text
                                x={W}
                                y={-8}
                                textAnchor="end"
                                fontSize="9"
                                fontWeight="600"
                                fill={improving ? '#34D399' : '#F87171'}
                            >
                                {improving ? '↑' : '↓'} {improving ? '+' : ''}{delta} over session
                            </text>
                        );
                    })()}
                </g>
            </svg>
        </div>
    );
}
