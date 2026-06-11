import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';

/**
 * KnowledgeGraph — Examination Blueprint
 *
 * Renders a multi-root skill tree with parent→child relationships.
 * Verified nodes glow indigo; unverified are dimmed.
 * This is the most memorable visual in the VERITAS suite.
 *
 * Props:
 *   graph: Array<{
 *     id: string,
 *     label: string,
 *     verified: boolean,
 *     children?: Array<{ id, label, verified }>
 *   }>
 *
 * Example:
 *   [
 *     { id: 'react', label: 'React', verified: true, children: [
 *         { id: 'hooks',  label: 'Hooks',  verified: true  },
 *         { id: 'redux',  label: 'Redux',  verified: true  },
 *         { id: 'context',label: 'Context API', verified: false },
 *     ]},
 *     { id: 'node', label: 'Node.js', verified: true, children: [
 *         { id: 'jwt',    label: 'JWT',    verified: true  },
 *         { id: 'redis',  label: 'Redis',  verified: true  },
 *         { id: 'express',label: 'Express',verified: true  },
 *         { id: 'pg',     label: 'PostgreSQL', verified: false },
 *     ]},
 *     { id: 'docker', label: 'Docker', verified: true, children: [] },
 *   ]
 */

const NODE_W = 88;
const NODE_H = 32;
const ROOT_H = 40;
const COL_GAP = 32;       // gap between root columns
const CHILD_GAP = 10;     // gap between children vertically
const ROOT_TO_CHILD = 40; // vertical distance root → first child

function rootColor(verified) {
    return verified
        ? { bg: 'rgba(79,70,229,0.15)', border: 'rgba(99,102,241,0.5)', text: '#C7D2FE', glow: 'rgba(99,102,241,0.3)' }
        : { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: '#6B7280', glow: 'transparent' };
}

function childColor(verified) {
    return verified
        ? { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)', text: '#6EE7B7', check: '#34D399' }
        : { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', text: '#4B5563', check: '#374151' };
}

export default function KnowledgeGraph({ graph = [] }) {
    if (!graph.length) return null;

    // Layout: compute positions for each root and its children
    const roots = graph.map((root, ri) => {
        const children = root.children ?? [];
        const colHeight = ROOT_H + (children.length > 0 ? ROOT_TO_CHILD + children.length * (NODE_H + CHILD_GAP) - CHILD_GAP : 0);
        return { ...root, children, colHeight };
    });

    // Assign x positions
    let x = 0;
    const positioned = roots.map((root) => {
        const cx = x + NODE_W / 2;
        x += NODE_W + COL_GAP;
        return { ...root, cx };
    });

    const svgW = x - COL_GAP;
    const svgH = Math.max(...positioned.map(r => r.colHeight)) + 20;

    const totalVerified = graph.reduce((acc, r) => {
        const childVerified = (r.children ?? []).filter(c => c.verified).length;
        return acc + (r.verified ? 1 : 0) + childVerified;
    }, 0);
    const totalNodes = graph.reduce((acc, r) => acc + 1 + (r.children ?? []).length, 0);

    return (
        <div className="flex flex-col gap-4">
            {/* Title row */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-text-muted uppercase">
                    Examination Blueprint
                </span>
                <span className="text-xs text-indigo-400 font-semibold">
                    {totalVerified}/{totalNodes} verified
                </span>
            </div>

            {/* SVG graph */}
            <div className="w-full overflow-x-auto">
                <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    width={svgW}
                    height={svgH}
                    style={{ minWidth: svgW, maxWidth: '100%' }}
                >
                    <defs>
                        <filter id="glow-indigo">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    {positioned.map((root, ri) => {
                        const rc = rootColor(root.verified);
                        const rootY = 8;
                        const childStartY = rootY + ROOT_H + ROOT_TO_CHILD;

                        return (
                            <g key={root.id}>
                                {/* Root node */}
                                <motion.g
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: ri * 0.1 }}
                                >
                                    {root.verified && (
                                        <rect
                                            x={root.cx - NODE_W / 2 - 2}
                                            y={rootY - 2}
                                            width={NODE_W + 4}
                                            height={ROOT_H + 4}
                                            rx={12}
                                            fill="none"
                                            stroke={rc.glow}
                                            strokeWidth="6"
                                            opacity={0.4}
                                            filter="url(#glow-indigo)"
                                        />
                                    )}
                                    <rect
                                        x={root.cx - NODE_W / 2}
                                        y={rootY}
                                        width={NODE_W}
                                        height={ROOT_H}
                                        rx={10}
                                        fill={rc.bg}
                                        stroke={rc.border}
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={root.cx}
                                        y={rootY + ROOT_H / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="11"
                                        fontWeight="700"
                                        fill={rc.text}
                                        fontFamily="'Manrope', sans-serif"
                                    >
                                        {root.label}
                                    </text>
                                    {root.verified && (
                                        <circle cx={root.cx + NODE_W / 2 - 8} cy={rootY + 8} r={5} fill="#4F46E5" />
                                    )}
                                </motion.g>

                                {/* Children */}
                                {root.children.map((child, ci) => {
                                    const cy = childStartY + ci * (NODE_H + CHILD_GAP);
                                    const cc = childColor(child.verified);
                                    const connY1 = rootY + ROOT_H;
                                    const connY2 = cy + NODE_H / 2;

                                    return (
                                        <motion.g
                                            key={child.id}
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: ri * 0.1 + 0.15 + ci * 0.07 }}
                                        >
                                            {/* Connector line */}
                                            <path
                                                d={`M ${root.cx} ${connY1} C ${root.cx} ${(connY1 + connY2) / 2}, ${root.cx} ${(connY1 + connY2) / 2}, ${root.cx} ${connY2}`}
                                                fill="none"
                                                stroke={child.verified ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}
                                                strokeWidth="1.5"
                                                strokeDasharray={child.verified ? 'none' : '4 3'}
                                            />

                                            {/* Child node */}
                                            <rect
                                                x={root.cx - NODE_W / 2}
                                                y={cy}
                                                width={NODE_W}
                                                height={NODE_H}
                                                rx={8}
                                                fill={cc.bg}
                                                stroke={cc.border}
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={root.cx - 8}
                                                y={cy + NODE_H / 2}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="9.5"
                                                fontWeight="600"
                                                fill={cc.text}
                                                fontFamily="'Manrope', sans-serif"
                                            >
                                                {child.label}
                                            </text>
                                            {/* Checkmark or circle */}
                                            <text
                                                x={root.cx + NODE_W / 2 - 12}
                                                y={cy + NODE_H / 2}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="10"
                                                fill={cc.check}
                                            >
                                                {child.verified ? '✓' : '○'}
                                            </text>
                                        </motion.g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/20 border border-indigo-500/50" />
                    <span>Root Skill</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold text-sm">✓</span>
                    <span>Verified</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-600 font-bold text-sm">○</span>
                    <span>Not assessed</span>
                </div>
            </div>
        </div>
    );
}
