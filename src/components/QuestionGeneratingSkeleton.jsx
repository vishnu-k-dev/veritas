import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cpu, Zap, CheckCircle2 } from 'lucide-react';

/**
 * QuestionGeneratingSkeleton
 * Shown while AI generates personalised interview questions (3–10s wait).
 * Gives the student something purposeful to look at instead of a frozen screen.
 *
 * Props:
 *   projectName  – shown in the headline ("Crafting questions for SolarTracker…")
 *   queuePosition – optional number; if > 0 shows position indicator
 */

const STEPS = [
  { icon: Brain,  label: 'Analysing your evidence',          detail: 'Dependencies, architecture, commit history…' },
  { icon: Cpu,    label: 'Building Examination Blueprint',   detail: 'Generating questions only the real builder can answer…' },
  { icon: Zap,    label: 'Calibrating examination depth',    detail: 'Matching the complexity of your demonstrated work…' },
];

// Rough skeleton widths for fake chat bubbles
const BUBBLES = [
  { side: 'left',  widths: ['w-3/4', 'w-1/2'] },
  { side: 'right', widths: ['w-2/3'] },
  { side: 'left',  widths: ['w-4/5', 'w-2/5'] },
  { side: 'right', widths: ['w-1/2'] },
];

function SkeletonLine({ className = '' }) {
  return (
    <div className={`h-3 rounded-full bg-white/[0.08] animate-pulse ${className}`} />
  );
}

function ChatBubbleSkeleton({ side, widths, delay = 0 }) {
  const isLeft = side === 'left';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`flex flex-col gap-2 p-3 rounded-2xl max-w-xs w-full ${
          isLeft
            ? 'bg-white/[0.05] rounded-tl-sm'
            : 'bg-emerald-500/10 rounded-tr-sm'
        }`}
        style={{ maxWidth: '65%' }}
      >
        {widths.map((w, i) => <SkeletonLine key={i} className={w} />)}
      </div>
    </motion.div>
  );
}

export default function QuestionGeneratingSkeleton({ projectName, queuePosition }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Step through STEPS automatically
  useEffect(() => {
    if (stepIndex >= STEPS.length - 1) return;
    const timer = setTimeout(() => setStepIndex(s => s + 1), 2200);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  // Elapsed counter
  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Estimated wait display
  const estWait = queuePosition > 0
    ? `~${queuePosition * 3}s (position ${queuePosition} in queue)`
    : elapsed < 5 ? 'a few seconds' : elapsed < 12 ? 'almost there…' : 'just a moment…';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <Brain className="w-7 h-7 text-emerald-400" />
        </motion.div>

        <h2 className="text-xl font-semibold text-white mb-1">
          Building your Examination Blueprint
          {projectName ? (
            <span className="text-emerald-400"> · {projectName}</span>
          ) : null}
        </h2>
        <p className="text-sm text-text-muted">
          Generating examination questions only the real builder can answer — {estWait}
        </p>

        {/* Queue position badge */}
        {queuePosition > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Position {queuePosition} · ~{queuePosition * 3}s remaining
          </motion.div>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={active ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-500 ${
                    done   ? 'bg-emerald-500/20 text-emerald-400' :
                    active ? 'bg-emerald-500/15 text-emerald-300' :
                             'bg-white/[0.04] text-white/20'
                  }`}
                  style={active ? { border: '1px solid rgba(52,211,153,0.3)' } : {}}
                >
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <Icon className="w-4 h-4" />
                  }
                </motion.div>
                <span className={`text-[10px] font-medium transition-colors duration-500 max-w-[72px] text-center leading-tight ${
                  done ? 'text-emerald-400' : active ? 'text-white/70' : 'text-white/20'
                }`}>
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="w-12 h-px mx-1 mb-5 transition-all duration-700"
                  style={{
                    background: done
                      ? 'linear-gradient(90deg,rgba(52,211,153,0.5),rgba(52,211,153,0.2))'
                      : 'rgba(255,255,255,0.06)'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Detail text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-center text-xs text-text-muted mb-8"
        >
          {STEPS[stepIndex]?.detail}
        </motion.p>
      </AnimatePresence>

      {/* Skeleton chat preview */}
      <div
        className="rounded-2xl p-4 space-y-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.05]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <SkeletonLine className="w-32" />
        </div>

        {BUBBLES.map((b, i) => (
          <ChatBubbleSkeleton key={i} {...b} delay={i * 0.15} />
        ))}

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {[0, 0.2, 0.4].map((d, i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 1, delay: d }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Fine print */}
      <p className="text-center text-[11px] text-white/20 mt-4">
        Questions are generated fresh — not recycled from templates
      </p>
    </div>
  );
}
