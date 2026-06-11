import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2, GitCommit, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

/**
 * EvidencePanel — shows the repo file / commit / code snippet that triggered a question.
 * Slot this beside any RepoInterviewChat question to make the AI feel grounded.
 *
 * Props:
 *   evidence: {
 *     type: 'file' | 'commit' | 'snippet',
 *     file: string,           // e.g. "auth/middleware/jwt.js"
 *     commit?: string,        // short SHA
 *     commitMsg?: string,
 *     lines?: [number, number], // [start, end]
 *     code?: string,          // raw code excerpt
 *     reason: string,         // why this triggered the question
 *   }
 */
export default function EvidencePanel({ evidence, className = '' }) {
    const [expanded, setExpanded] = useState(false);

    if (!evidence) return null;

    const iconMap = {
        file: FileCode2,
        commit: GitCommit,
        snippet: Link2,
    };
    const Icon = iconMap[evidence.type] ?? FileCode2;

    return (
        <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] overflow-hidden ${className}`}
        >
            {/* Header */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-500/[0.04] transition-colors"
            >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-0.5">
                        Evidence Source
                    </div>
                    <div className="text-sm text-white font-mono truncate">{evidence.file}</div>
                </div>
                {expanded
                    ? <ChevronUp className="w-4 h-4 text-indigo-400/60 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-indigo-400/60 flex-shrink-0" />
                }
            </button>

            {/* Commit badge */}
            {evidence.commit && (
                <div className="px-4 pb-2 flex items-center gap-2">
                    <GitCommit className="w-3 h-3 text-indigo-400/50" />
                    <span className="text-xs font-mono text-indigo-300/70">{evidence.commit}</span>
                    {evidence.commitMsg && (
                        <span className="text-xs text-text-muted truncate">{evidence.commitMsg}</span>
                    )}
                </div>
            )}

            {/* Reason line */}
            <div className="px-4 pb-3">
                <p className="text-xs text-text-muted leading-relaxed">
                    <span className="text-indigo-400/80 font-medium">Why this was asked: </span>
                    {evidence.reason}
                </p>
            </div>

            {/* Expandable code snippet */}
            <AnimatePresence>
                {expanded && evidence.code && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="border-t border-indigo-500/10">
                            {evidence.lines && (
                                <div className="px-4 pt-2 pb-1 flex items-center gap-1.5">
                                    <span className="text-xs text-text-muted font-mono">
                                        Lines {evidence.lines[0]}–{evidence.lines[1]}
                                    </span>
                                </div>
                            )}
                            <pre className="px-4 pb-4 text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                                <code>{evidence.code}</code>
                            </pre>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
