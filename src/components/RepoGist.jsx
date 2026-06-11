import { motion } from 'framer-motion';
import { Code2, GitBranch, Folder, Package, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { cleanSummary } from '../utils/textSanitize';

/**
 * RepoGist — Pre-interview project summary
 * Shows what VERITAS understood about the candidate's repo before starting questions.
 * Prevents hallucination by letting the candidate confirm the scope.
 */
export default function RepoGist({ gist, loading, isGenerating, onConfirm }) {
  if (loading || !gist) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">Analyzing your repository...</h3>
          <p className="text-text-muted text-sm">Reading files, dependencies, and structure</p>
        </div>
      </div>
    );
  }

  const {
    projectName,
    description,
    languages = [],
    frameworks = [],
    dependencies = [],
    directories = [],
    architecturePattern,
    totalFiles,
    totalDeps = 0,
    totalCommits = 0,
    recentCommits = [],
    focusAreas = [],
  } = gist;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      {/* Header badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Repository Analysis Complete
        </span>
      </div>

      {/* Main card */}
      <div className="bg-card-dark border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />

        <div className="p-6 space-y-6">
          {/* Project header */}
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{projectName}</h2>
            {description && (
              <p className="text-text-muted text-sm leading-relaxed">{cleanSummary(description)}</p>
            )}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{totalFiles || '—'}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Files</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-cyan-400">{totalDeps || dependencies.length}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Dependencies</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-amber-400">{totalCommits || recentCommits.length}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Commits</div>
            </div>
          </div>

          {/* Tech stack */}
          {(languages.length > 0 || frameworks.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Tech Stack</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {frameworks.map(fw => (
                  <span key={fw} className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    {fw}
                  </span>
                ))}
                {languages.map(lang => (
                  <span key={lang} className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-text-cream/70">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Project structure */}
          {directories.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Folder className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Project Structure</span>
              </div>
              <div className="bg-black/30 rounded-lg p-3 font-mono text-xs text-text-muted space-y-1">
                {directories.map(dir => (
                  <div key={dir} className="flex items-center gap-2">
                    <span className="text-cyan-400/60">📁</span>
                    <span>{dir}/</span>
                  </div>
                ))}
                {architecturePattern && architecturePattern !== 'unknown' && (
                  <div className="mt-2 pt-2 border-t border-white/[0.05] text-text-muted/60">
                    Pattern: {architecturePattern}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key dependencies */}
          {dependencies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Package className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Key Dependencies</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dependencies.map(dep => (
                  <span key={dep} className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-text-muted">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent commits */}
          {recentCommits.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <GitBranch className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Recent Activity</span>
              </div>
              <div className="space-y-1.5">
                {recentCommits.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-purple-400/60 mt-0.5">{c.sha || '•'}</span>
                    <span className="text-text-muted leading-relaxed">{(c.message || '').split('\n')[0].slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What we'll focus on */}
          {focusAreas.length > 0 && (
            <div className="bg-emerald-500/[0.06] border border-emerald-500/[0.15] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">What we'll focus on</span>
              </div>
              <ul className="space-y-1.5">
                {focusAreas.map((area, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-200/80">
                    <span className="text-emerald-400 mt-0.5">→</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={onConfirm}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating your questions…
              </>
            ) : (
              <>
                Looks right — Start Interview
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-text-muted mt-2">
            Questions will be based only on what's shown above
          </p>
        </div>
      </div>
    </motion.div>
  );
}
