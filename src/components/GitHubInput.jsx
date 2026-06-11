import { useState } from 'react';
import { motion } from 'framer-motion';
import { Github, Loader2, AlertCircle, ExternalLink, GitBranch, Star, Code2, FolderTree } from 'lucide-react';

/**
 * GitHubInput — Input component for GitHub repo URL
 * Validates URL, fetches repo preview, shows parsed repo summary
 */
export default function GitHubInput({ onAnalysisComplete, onBack, candidateName }) {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [repoPreview, setRepoPreview] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);

    const validateUrl = (url) => {
        return /(?:https?:\/\/)?github\.com\/[^/]+\/[^/]+/.test(url.trim()) ||
            /^[^/]+\/[^/]+$/.test(url.trim());
    };

    const handleAnalyze = async () => {
        if (!validateUrl(repoUrl)) {
            setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Dynamic imports to keep initial bundle small
            const { analyzeRepository } = await import('../services/githubService');
            const { parseRepository } = await import('../engine/RepoParser');
            const { buildRepoContext, buildRepoSummary } = await import('../engine/RepoContextBuilder');

            // Step 1: Fetch raw data from GitHub
            const rawData = await analyzeRepository(repoUrl);

            // Step 2: Parse into structured analysis
            const parsed = parseRepository(rawData);

            // Step 3: Build context for LLM
            const repoContext = buildRepoContext(parsed);
            const repoSummary = buildRepoSummary(repoContext);

            setRepoPreview(repoSummary);
            setAnalysisResult({ repoContext, parsed, rawData });

        } catch (err) {
            console.error('Repo analysis failed:', err);
            if (err.message.includes('404') || err.message.includes('Not Found')) {
                setError('Repository not found. Make sure it\'s a public repository and the URL is correct.');
            } else if (err.message.includes('403')) {
                setError('GitHub API rate limit reached. Please wait a moment and try again.');
            } else {
                setError(`Failed to analyze repository: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleProceed = () => {
        if (analysisResult) {
            onAnalysisComplete(analysisResult);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-6"
                    >
                        <Github className="w-10 h-10 text-emerald-400" />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-white mb-2">GitHub Project Examination</h1>
                    <p className="text-text-muted max-w-md mx-auto">
                        Paste your GitHub repository URL. We'll analyze your project and ask questions only the real builder can answer.
                    </p>
                    {candidateName && (
                        <p className="text-sm text-emerald-400 mt-2">Welcome, {candidateName}</p>
                    )}
                </div>

                {/* Input Card */}
                <div className="bg-card-dark/50 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-8">
                    {/* URL Input */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-muted mb-2">
                            GitHub Repository URL
                        </label>
                        <div className="relative">
                            <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                            <input
                                type="text"
                                value={repoUrl}
                                onChange={(e) => { setRepoUrl(e.target.value); setError(''); }}
                                placeholder="https://github.com/username/project"
                                className="w-full pl-12 pr-4 py-3.5 bg-background-dark/60 border border-white/[0.08] rounded-xl text-white placeholder:text-text-muted/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
                                disabled={loading}
                            />
                        </div>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 mt-3 text-red-400 text-sm"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Analyze Button */}
                    {!repoPreview && (
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !repoUrl.trim()}
                            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-900/30"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Analyzing Repository...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Code2 className="w-5 h-5" />
                                    Analyze Repository
                                </span>
                            )}
                        </button>
                    )}

                    {/* Loading state with progress */}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6 space-y-3"
                        >
                            {['Fetching repository metadata...', 'Analyzing file structure...', 'Parsing dependencies...', 'Building context...'].map((step, i) => (
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.8 }}
                                    className="flex items-center gap-3 text-sm text-text-muted"
                                >
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: i * 0.8 }}
                                        className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                                    />
                                    {step}
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {/* Repo Preview */}
                    {repoPreview && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2"
                        >
                            {/* Repo header */}
                            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/[0.06]">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Github className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        {repoPreview.title}
                                        <a href={repoPreview.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-emerald-400 transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </h3>
                                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{repoPreview.description}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                                        <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {repoPreview.stars}</span>
                                        <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {repoPreview.commits} commits</span>
                                        <span className="flex items-center gap-1"><FolderTree className="w-3.5 h-3.5" /> {repoPreview.totalFiles} files</span>
                                    </div>
                                </div>
                            </div>

                            {/* Analysis Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-background-dark/40 rounded-xl p-4 border border-white/[0.04]">
                                    <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">Languages</div>
                                    <div className="text-sm text-white">{repoPreview.languages}</div>
                                </div>
                                <div className="bg-background-dark/40 rounded-xl p-4 border border-white/[0.04]">
                                    <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">Architecture</div>
                                    <div className="text-sm text-white capitalize">{repoPreview.architecture}</div>
                                </div>
                                <div className="col-span-2 bg-background-dark/40 rounded-xl p-4 border border-white/[0.04]">
                                    <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">Tech Stack Detected</div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {repoPreview.frameworks.split(', ').map(fw => (
                                            <span key={fw} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                                {fw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Proceed Button */}
                            <button
                                onClick={handleProceed}
                                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-900/30 transition-all"
                            >
                                Start Interview →
                            </button>

                            {/* Re-analyze option */}
                            <button
                                onClick={() => { setRepoPreview(null); setAnalysisResult(null); }}
                                className="w-full mt-3 py-2 text-sm text-text-muted hover:text-white transition-colors"
                            >
                                Use a different repository
                            </button>
                        </motion.div>
                    )}
                </div>

                {/* Back button */}
                <div className="text-center mt-6">
                    <button onClick={onBack} className="text-sm text-text-muted hover:text-white transition-colors">
                        ← Back
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
