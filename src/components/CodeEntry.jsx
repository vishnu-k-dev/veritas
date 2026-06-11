import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from './ui/Card';
import Button from './ui/Button';
import { validateScreeningCode, checkApplicantExists } from '../services/api';

/**
 * Code Entry Component
 * Applicant enters screening code and email
 */
export default function CodeEntry({ onSuccess, onBack }) {
    const [step, setStep] = useState('code'); // 'code' | 'email'
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [screeningDetails, setScreeningDetails] = useState(null);

    // Format code input (auto uppercase and add dash)
    const handleCodeChange = (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

        // Auto-add VRT- prefix if not present
        if (value.length > 0 && !value.startsWith('VRT-') && !value.startsWith('VRT')) {
            if (value.length <= 6) {
                value = `VRT-${value}`;
            }
        }

        setCode(value);
        setError('');
    };

    const handleValidateCode = async () => {
        if (code.length < 8) {
            setError('Please enter a valid code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const screening = await validateScreeningCode(code);
            setScreeningDetails(screening);
            setStep('email');
        } catch (err) {
            setError(err.message || 'Invalid or expired code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartScreening = async () => {
        if (!email || !name) {
            setError('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Check if already taken
            const alreadyTaken = await checkApplicantExists(code, email);
            if (alreadyTaken) {
                setError('You have already completed this assessment. Each examinee can only take it once.');
                setIsLoading(false);
                return;
            }

            onSuccess({
                code,
                email,
                name,
                screening: screeningDetails,
            });
        } catch (err) {
            setError(err.message || 'Failed to start screening');
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
                    onClick={step === 'email' ? () => setStep('code') : onBack}
                    className="flex items-center gap-2 text-text-muted hover:text-white mb-8 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>{step === 'email' ? 'Change code' : 'Back to role selection'}</span>
                </button>

                <Card padding="lg">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="size-12 rounded-xl bg-gradient-to-br from-verified to-green-600 shadow-lg flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-2xl">
                                    {step === 'code' ? 'key' : 'person'}
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white">
                            {step === 'code' ? 'Enter Examination Code' : 'Your Details'}
                        </h1>
                        <p className="text-text-muted text-sm mt-1">
                            {step === 'code'
                                ? 'Enter the code provided by your organization or institution'
                                : 'Tell us about yourself before starting'
                            }
                        </p>
                    </div>

                    {step === 'code' ? (
                        /* Code Entry Step */
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Assessment Code</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={handleCodeChange}
                                    placeholder="VRT-XXXXXX"
                                    className="w-full px-4 py-4 rounded-xl bg-card-dark border border-white/10 text-white text-center text-2xl font-mono tracking-widest placeholder-text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    maxLength={12}
                                    autoFocus
                                />
                                <p className="text-xs text-text-muted mt-2 text-center">
                                    Example: VRT-A7X9K2
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-flagged/10 border border-flagged/20 text-flagged text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={handleValidateCode}
                                disabled={isLoading || code.length < 8}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        Validate Code
                                        <span className="material-symbols-outlined ml-2">arrow_forward</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        /* Email Entry Step */
                        <div className="space-y-6">
                            {/* Show screening details */}
                            <div className="p-4 rounded-xl bg-verified/5 border border-verified/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-verified text-sm">check_circle</span>
                                    <span className="text-sm font-medium text-verified">Valid Code</span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{screeningDetails?.roleTitle}</h3>
                                <p className="text-sm text-text-muted mt-1">
                                    {screeningDetails?.experienceLevel} level • {screeningDetails?.requiredSkills?.length || 0} required skills
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Your Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Smith"
                                    className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Your Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@email.com"
                                    className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    required
                                />
                                <p className="text-xs text-text-muted mt-1">
                                    We'll use this to identify your submission
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-flagged/10 border border-flagged/20 text-flagged text-sm">
                                    {error}
                                </div>
                            )}

                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={handleStartScreening}
                                disabled={isLoading || !email || !name}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        Start Assessment
                                        <span className="material-symbols-outlined ml-2">play_arrow</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Info */}
                <p className="text-center text-text-muted text-xs mt-6">
                    Having trouble? Contact your organization or institution for assistance.
                </p>
            </motion.div>
        </div>
    );
}
