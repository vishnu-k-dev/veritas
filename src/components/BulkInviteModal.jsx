/**
 * BulkInviteModal — generates shareable invite links for a list of emails
 * No email sending (no email service configured); recruiter copies & distributes links.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Link2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { bulkInviteCode } from '../services/api';

export default function BulkInviteModal({ isOpen, onClose, screeningCode, roleTitle }) {
    const [rawInput, setRawInput] = useState('');
    const [invites, setInvites] = useState(null); // null = not yet generated
    const [invalid, setInvalid] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [allCopied, setAllCopied] = useState(false);
    const fileRef = useRef();

    if (!isOpen) return null;

    const parseEmails = (text) =>
        text
            .split(/[\n,;]+/)
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            // Support CSV: grab values that look like emails
            const emails = text.match(/[^\s,;"'<>]+@[^\s,;"'<>]+/g) || [];
            setRawInput(prev => (prev ? prev + '\n' : '') + emails.join('\n'));
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleGenerate = async () => {
        const emails = parseEmails(rawInput);
        if (emails.length === 0) {
            setError('Enter at least one email address.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await bulkInviteCode(screeningCode, emails);
            setInvites(result.invites || []);
            setInvalid(result.invalid || []);
        } catch (err) {
            setError(err.message || 'Failed to generate invite links.');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = (link, idx) => {
        navigator.clipboard.writeText(link);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const copyAll = () => {
        const text = invites.map(i => `${i.email}: ${i.link}`).join('\n');
        navigator.clipboard.writeText(text);
        setAllCopied(true);
        setTimeout(() => setAllCopied(false), 2500);
    };

    const reset = () => {
        setRawInput('');
        setInvites(null);
        setInvalid([]);
        setError('');
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/10 max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-lg font-bold text-white">Invite Examinees</h2>
                            <p className="text-sm text-text-muted">
                                Code <span className="font-mono text-primary">{screeningCode}</span>
                                {roleTitle && <span> · {roleTitle}</span>}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4">
                        {!invites ? (
                            <>
                                {/* Email input */}
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Email Addresses
                                        <span className="text-text-muted font-normal ml-1">(one per line, or comma-separated)</span>
                                    </label>
                                    <textarea
                                        value={rawInput}
                                        onChange={e => { setRawInput(e.target.value); setError(''); }}
                                        placeholder={'alice@example.com\nbob@company.org\ncarol@startup.io'}
                                        rows={6}
                                        className="w-full bg-black/30 border border-card-border rounded-xl px-4 py-3 text-white text-sm placeholder-text-muted focus:outline-none focus:border-primary/60 resize-none font-mono"
                                    />
                                    <p className="text-xs text-text-muted mt-1">
                                        {parseEmails(rawInput).length} email{parseEmails(rawInput).length !== 1 ? 's' : ''} detected
                                        {' · '}Max 200 per batch
                                    </p>
                                </div>

                                {/* CSV upload */}
                                <div>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".csv,.txt"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-white/20 text-text-muted hover:text-white hover:border-white/40 transition-colors text-sm w-full justify-center"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload CSV or TXT file
                                    </button>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleGenerate}
                                    disabled={loading || !rawInput.trim()}
                                    className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-40 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <Link2 className="w-4 h-4" />
                                    {loading ? 'Generating links...' : 'Generate Invite Links'}
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Results */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-verified text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {invites.length} invite link{invites.length !== 1 ? 's' : ''} generated
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={copyAll}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-muted hover:text-white transition-colors"
                                        >
                                            {allCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            {allCopied ? 'Copied!' : 'Copy All'}
                                        </button>
                                        <button onClick={reset} className="text-xs text-text-muted hover:text-white underline transition-colors">
                                            Start over
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-text-muted">
                                    Share each link directly with the candidate. The link pre-fills their email and screening code.
                                </p>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {invites.map((inv, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-white font-medium truncate">{inv.email}</p>
                                                <p className="text-xs text-text-muted truncate">{inv.link}</p>
                                            </div>
                                            <button
                                                onClick={() => copyLink(inv.link, idx)}
                                                className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                                            >
                                                {copiedIdx === idx
                                                    ? <Check className="w-3.5 h-3.5 text-verified" />
                                                    : <Copy className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {invalid.length > 0 && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <p className="text-xs text-red-400 font-medium mb-1">
                                            {invalid.length} invalid email{invalid.length !== 1 ? 's' : ''} skipped:
                                        </p>
                                        <p className="text-xs text-red-400/70">{invalid.join(', ')}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="pt-4 mt-4 border-t border-white/5">
                        <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-white/10 text-text-muted hover:text-white hover:border-white/20 transition-colors text-sm">
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
