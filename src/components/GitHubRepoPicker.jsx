import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Search, Star, GitFork, Clock, Lock, Globe, Loader2, ArrowRight, LogIn } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * GitHubRepoPicker — OAuth sign-in + repo list for candidates
 * Flow: Sign in with GitHub → Fetch repos → Search/filter → Select → onSelect(repo)
 * If githubToken is provided (from Firebase GitHub sign-in), skips OAuth entirely.
 */
export default function GitHubRepoPicker({ onSelect, onSkip, githubToken: preAuthToken }) {
    const [step, setStep] = useState(preAuthToken ? 'loading' : 'signin'); // Skip signin if token exists
    const [githubToken, setGithubToken] = useState(preAuthToken || null);
    const [githubUser, setGithubUser] = useState(null);
    const [repos, setRepos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [error, setError] = useState(null);

    // If we have a pre-auth token from Firebase GitHub sign-in, load repos immediately
    useEffect(() => {
        if (preAuthToken && step === 'loading') {
            loadGitHubData(preAuthToken);
        }
    }, [preAuthToken]);

    // Load GitHub user + repos using a token (routed through backend proxy)
    const loadGitHubData = async (token) => {
        try {
            const [userRes, reposRes] = await Promise.all([
                fetch(`${API_BASE}/api/github/user`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                }),
                fetch(`${API_BASE}/api/github/repos`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                }),
            ]);
            if (userRes.ok) {
                const userData = await userRes.json();
                setGithubUser(userData);
            }
            if (reposRes.ok) {
                const reposData = await reposRes.json();
                setRepos(Array.isArray(reposData) ? reposData : []);
            }
            setStep('repos');
        } catch (err) {
            console.error('GitHub data load error:', err);
            setError('Failed to load GitHub data. Try again.');
            setStep('signin');
        }
    };

    // Listen for OAuth code from popup via localStorage (reliable) or postMessage (fallback)
    useEffect(() => {
        // 1. postMessage listener (works if window.opener isn't severed)
        const handleMessage = (event) => {
            if (event.data?.type === 'github-oauth-callback' && event.data?.code) {
                exchangeCodeForToken(event.data.code);
            }
        };
        window.addEventListener('message', handleMessage);

        // 2. localStorage listener — fired when popup writes the code
        // This is the PRIMARY channel since COOP severs window.opener
        const handleStorage = (event) => {
            if (event.key === 'VERITAS_github_oauth_code' && event.newValue) {
                localStorage.removeItem('VERITAS_github_oauth_code');
                exchangeCodeForToken(event.newValue);
            }
        };
        window.addEventListener('storage', handleStorage);

        // 3. Check if App.jsx already exchanged the code and stored a token
        if (!preAuthToken && !githubToken) {
            const storedToken = sessionStorage.getItem('VERITAS_github_token');
            if (storedToken) {
                setGithubToken(storedToken);
                setStep('loading');
                loadGitHubData(storedToken);
            }
        }

        // 4. Check if localStorage code was set before this component mounted
        const pendingCode = localStorage.getItem('VERITAS_github_oauth_code');
        if (pendingCode) {
            localStorage.removeItem('VERITAS_github_oauth_code');
            exchangeCodeForToken(pendingCode);
        }

        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Start GitHub OAuth flow (handles Render cold start ~30s)
    const [connecting, setConnecting] = useState(false);

    const startOAuth = async () => {
        setError(null);
        setConnecting(true);

        try {
            // No timeout — Render free tier can take up to 60s on cold start
            const redirectUri = encodeURIComponent(window.location.origin);
            const res = await fetch(`${API_BASE}/api/github/auth-url?redirect_uri=${redirectUri}`);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || `Server error (${res.status})`);
                setConnecting(false);
                return;
            }

            const data = await res.json();
            setConnecting(false);

            if (data.error) {
                setError(data.error);
                return;
            }

            // Open OAuth in popup
            const width = 600, height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            // Mark that THIS is our repo OAuth, not Firebase auth
            sessionStorage.setItem('VERITAS_repo_oauth_pending', 'true');

            // NOTE: do NOT use noopener/noreferrer — we need window.opener for
            // postMessage and window.close() to work reliably in the popup.
            const popup = window.open(
                data.url,
                'github-oauth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
            );

            if (!popup || popup.closed) {
                // Popup blocked — fall back to same-tab redirect.
                // Store a return flag so App.jsx restores the GitHub picker after OAuth.
                localStorage.setItem('VERITAS_github_oauth_return', 'true');
                window.location.href = data.url;
                return;
            }

            // Listen for postMessage from the popup
            const pollTimer = setInterval(() => {
                if (!popup || popup.closed) {
                    clearInterval(pollTimer);
                }
            }, 500);

            // The postMessage listener is setup in useEffect


        } catch (err) {
            console.error('OAuth start error:', err);
            setConnecting(false);
            setError('Could not reach the server. It may be waking up — please try again in a few seconds.');
        }
    };

    // Exchange authorization code for access token
    const exchangeCodeForToken = async (code) => {
        setStep('loading');
        try {
            const res = await fetch(`${API_BASE}/api/github/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();

            if (data.error) {
                setError(data.error);
                setStep('signin');
                return;
            }

            setGithubToken(data.access_token);
            await Promise.all([fetchUser(data.access_token), fetchRepos(data.access_token)]);
            setStep('repos');
        } catch (err) {
            setError('Failed to complete GitHub sign-in');
            setStep('signin');
            console.error('Token exchange error:', err);
        }
    };

    // Fetch GitHub user profile
    const fetchUser = async (token) => {
        const res = await fetch(`${API_BASE}/api/github/user`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const user = await res.json();
        setGithubUser(user);
    };

    // Fetch user's repos
    const fetchRepos = async (token) => {
        const res = await fetch(`${API_BASE}/api/github/repos`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        setRepos(Array.isArray(data) ? data : []);
    };

    // Filter repos by search
    const filteredRepos = repos.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.language || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Format relative time
    const timeAgo = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    // Handle repo selection
    const handleSelect = () => {
        if (selectedRepo) {
            onSelect({
                full_name: selectedRepo.full_name,
                html_url: selectedRepo.html_url,
                name: selectedRepo.name,
                description: selectedRepo.description,
                language: selectedRepo.language,
                default_branch: selectedRepo.default_branch,
                githubToken,
            });
        }
    };

    // SIGN IN STEP
    if (step === 'signin') {
        return (
            <div className="max-w-lg mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center">
                        <Github className="w-10 h-10 text-white" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">GitHub Project Examination</h2>
                    <p className="text-text-muted mb-8 max-w-md mx-auto">
                        Sign in with GitHub to select a project you've built. We'll generate questions that only the real builder can answer.
                    </p>

                    {error && (
                        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={startOAuth}
                        disabled={connecting}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all shadow-lg shadow-white/10 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {connecting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Connecting to server...
                            </>
                        ) : (
                            <>
                                <Github className="w-5 h-5" />
                                Sign in with GitHub
                            </>
                        )}
                    </button>

                    {connecting && (
                        <p className="text-xs text-text-muted mt-3 animate-pulse">
                            Server may take up to 30s to wake up on first visit
                        </p>
                    )}

                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="block mx-auto mt-4 text-sm text-text-muted hover:text-white transition-colors"
                        >
                            Skip — paste a repo URL instead
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    // LOADING STEP
    if (step === 'loading') {
        return (
            <div className="max-w-lg mx-auto text-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Connecting to GitHub...</p>
            </div>
        );
    }

    // REPOS LIST STEP
    return (
        <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {githubUser?.avatar_url && (
                            <img
                                src={githubUser.avatar_url}
                                alt={githubUser.login}
                                className="w-10 h-10 rounded-full border-2 border-white/20"
                            />
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white">Select a Project</h2>
                            <p className="text-sm text-text-muted">
                                Signed in as <span className="text-white font-medium">{githubUser?.login}</span> · {repos.length} repos
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSelect}
                        disabled={!selectedRepo}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                    >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search repos by name, description, or language..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all text-sm"
                    />
                </div>

                {/* Repo List */}
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredRepos.length === 0 ? (
                        <div className="text-center py-12 text-text-muted">
                            {searchQuery ? 'No repos match your search' : 'No repositories found'}
                        </div>
                    ) : (
                        filteredRepos.map(repo => (
                            <motion.button
                                key={repo.id}
                                onClick={() => setSelectedRepo(repo)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedRepo?.id === repo.id
                                    ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20'
                                    : 'bg-card-dark/50 border-white/[0.06] hover:border-white/20'
                                    }`}
                                whileHover={{ scale: 1.005 }}
                                whileTap={{ scale: 0.995 }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {repo.private ? (
                                                <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                            ) : (
                                                <Globe className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                                            )}
                                            <h3 className="font-semibold text-white text-sm truncate">{repo.name}</h3>
                                        </div>
                                        {repo.description && (
                                            <p className="text-xs text-text-muted mt-1 line-clamp-1">{repo.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-[11px] text-text-muted">
                                            {repo.language && (
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                                    {repo.language}
                                                </span>
                                            )}
                                            {repo.stargazers_count > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Star className="w-3 h-3" />
                                                    {repo.stargazers_count}
                                                </span>
                                            )}
                                            {repo.forks_count > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <GitFork className="w-3 h-3" />
                                                    {repo.forks_count}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {timeAgo(repo.updated_at)}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedRepo?.id === repo.id && (
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">✓</span>
                                        </div>
                                    )}
                                </div>
                            </motion.button>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}

