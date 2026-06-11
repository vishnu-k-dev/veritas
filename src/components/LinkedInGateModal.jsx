/**
 * LinkedInGateModal — shown to college students after completing an interview.
 * Requires them to share their result on LinkedIn before the full passport unlocks.
 * Only rendered when the user's profile has a college_id (institute-linked student).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Linkedin, ExternalLink, CheckCircle2, X } from 'lucide-react';

export default function LinkedInGateModal({ isOpen, onComplete, onSkip, candidateName, trustScore, verdict, verificationId }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const shareText = encodeURIComponent(
    `I just completed an AI-powered competency examination on VERITAS and scored ${trustScore}/100 🎯\n` +
    `Verdict: ${(verdict || '').toUpperCase()} ✅\n` +
    `Verified at: tryveritas.app/verify/${verificationId}\n` +
    `#VERITAS #CompetencyVerification #SkillPassport`
  );
  const linkedInUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`https://tryveritas.app/verify/${verificationId}`)}&title=${encodeURIComponent(`${candidateName}'s VERITAS Competency Passport`)}&summary=${shareText}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please paste your LinkedIn post URL.');
      return;
    }
    // Basic LinkedIn URL validation
    if (!url.includes('linkedin.com')) {
      setError('That doesn\'t look like a LinkedIn URL. Please paste the link to your post.');
      return;
    }
    setSubmitting(true);
    try {
      // Fire-and-forget save to backend (non-critical)
      const { getAuthToken } = await import('../lib/supabase');
      const token = await getAuthToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      await fetch(`${API_BASE}/api/interview/linkedin-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ linkedinUrl: url, verificationId }),
      }).catch(() => {});
    } finally {
      setSubmitting(false);
      onComplete(url);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md glass-panel rounded-2xl p-8 border border-[#0A66C2]/30"
        >
          {/* Skip (subtle) */}
          {onSkip && (
            <button onClick={onSkip} className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}

          {/* LinkedIn logo badge */}
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#0A66C2]/20 border border-[#0A66C2]/30 flex items-center justify-center">
            <Linkedin className="w-7 h-7 text-[#0A66C2]" />
          </div>

          <h2 className="text-xl font-bold text-white text-center mb-2">Share your result on LinkedIn</h2>
          <p className="text-text-muted text-sm text-center mb-6">
            Your institution requires you to share your VERITAS result. Paste the LinkedIn post URL below to unlock your full Competency Passport.
          </p>

          {/* Pre-filled share text preview */}
          <div className="bg-[#0A66C2]/10 border border-[#0A66C2]/20 rounded-xl p-4 mb-5 text-sm text-text-muted leading-relaxed">
            <p className="font-semibold text-[#70a9d6] mb-2 text-xs uppercase tracking-wide">Suggested post text</p>
            <p>I just completed an AI-powered competency examination on VERITAS and scored <strong className="text-white">{trustScore}/100</strong> 🎯</p>
            <p>Verdict: <strong className="text-white">{(verdict || '').toUpperCase()}</strong> ✅</p>
            <p className="text-xs mt-2 text-text-muted/70">Verified at: tryveritas.app/verify/{verificationId}</p>
          </div>

          {/* Open LinkedIn button */}
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white font-semibold rounded-xl transition-colors mb-4 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Open LinkedIn to Post
          </a>

          {/* URL paste form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="url"
              placeholder="Paste your LinkedIn post URL here..."
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              className="w-full bg-black/30 border border-card-border rounded-xl px-4 py-3 text-text text-sm placeholder-text-muted focus:outline-none focus:border-[#0A66C2]/60"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Confirming...' : 'Confirm & View Passport'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
