import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from './ui/Card';
import Button from './ui/Button';
import { login, register } from '../services/api';

/**
 * Recruiter Auth Component
 * Login and registration for recruiters
 */
export default function RecruiterAuth({ onSuccess, onBack }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        company: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            let result;
            if (mode === 'login') {
                result = await login(formData.email, formData.password);
            } else {
                if (!formData.name) {
                    setError('Name is required');
                    setIsLoading(false);
                    return;
                }
                result = await register(formData.email, formData.password, formData.name, formData.company);
            }
            onSuccess(result.recruiter);
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-text-muted hover:text-white mb-8 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>Back to role selection</span>
                </button>

                <Card padding="lg">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-[#856504] shadow-glow-primary flex items-center justify-center text-black">
                                <span className="material-symbols-outlined text-2xl">token</span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Institution Portal</h1>
                        <p className="text-text-muted text-sm mt-1">
                            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="John Smith"
                                        className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">Company (Optional)</label>
                                    <input
                                        type="text"
                                        name="company"
                                        value={formData.company}
                                        onChange={handleChange}
                                        placeholder="Acme Corp"
                                        className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="you@company.com"
                                className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                required
                                minLength={6}
                            />
                            {mode === 'register' && (
                                <p className="text-xs text-text-muted mt-1">Minimum 6 characters</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-flagged/10 border border-flagged/20 text-flagged text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit Button with Sheen Effect */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="relative w-full bg-primary hover:bg-primary/90 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,191,0,0.15)] hover:shadow-[0_0_30px_rgba(255,191,0,0.3)] flex items-center justify-center gap-2 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {/* Sheen Effect */}
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"></span>

                            {isLoading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">login</span>
                                    <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle mode */}
                    <div className="mt-6 text-center text-sm">
                        {mode === 'login' ? (
                            <p className="text-text-muted">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('register')}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Register
                                </button>
                            </p>
                        ) : (
                            <p className="text-text-muted">
                                Already have an account?{' '}
                                <button
                                    onClick={() => setMode('login')}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
