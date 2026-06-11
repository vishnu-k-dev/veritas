// FeedbackForm.jsx — Compulsory post-interview feedback sheet
// Shown before SkillPassport. All 5 questions visible at once.
// No skip option — submit required to unlock results.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { apiRequest } from '../services/api';

// ── Question config ────────────────────────────────────────────────────────────

const MCQ_QUESTIONS = [
  {
    id: 'assessmentAccuracy',
    question: 'How accurately did VERITAS assess your actual skill level?',
    options: [
      { value: 1, label: 'Very accurately',    sub: 'The questions genuinely tested my understanding' },
      { value: 2, label: 'Mostly accurately',  sub: 'A few felt off, but overall fair' },
      { value: 3, label: 'Somewhat',           sub: 'Several questions didn\'t match my skills' },
      { value: 4, label: 'Not accurately',     sub: 'The assessment missed what I actually know' },
    ],
  },
  {
    id: 'questionSpecificity',
    question: 'Did the questions feel specific to your project, or generic?',
    options: [
      { value: 1, label: 'Highly specific',   sub: 'Referenced my actual code and decisions' },
      { value: 2, label: 'Mostly specific',   sub: 'Most were relevant, a few felt generic' },
      { value: 3, label: 'Mixed',             sub: 'Some specific, some could apply to any project' },
      { value: 4, label: 'Generic',           sub: 'I could answer these without building this project' },
    ],
  },
  {
    id: 'feedbackActionability',
    question: 'After this interview, do you know what to improve?',
    options: [
      { value: 1, label: 'Yes, very clearly',  sub: 'I know my weak areas and what to study next' },
      { value: 2, label: 'Somewhat',           sub: 'Useful feedback, could be more specific' },
      { value: 3, label: 'Not really',         sub: 'The feedback was too vague' },
      { value: 4, label: 'Not at all',         sub: 'I just got a score with no explanation' },
    ],
  },
  {
    id: 'recommendationScore',
    question: 'Would you recommend VERITAS to a friend preparing for technical assessments?',
    options: [
      { value: 1, label: 'Definitely yes',     sub: 'This should be mandatory for all tech students' },
      { value: 2, label: 'Probably yes',       sub: 'It\'s useful, I\'d mention it if asked' },
      { value: 3, label: 'Maybe',              sub: 'I\'m not sure yet' },
      { value: 4, label: 'Probably not',       sub: 'It needs work before I\'d recommend it' },
      { value: 5, label: 'Definitely not',     sub: 'I wouldn\'t suggest this to anyone' },
    ],
  },
];

const TEXT_PLACEHOLDER = [
  '"Show me the correct answers after the interview"',
  '"Let me pause and resume the interview"',
  '"Explain exactly why my answer was marked wrong"',
  '"Give me practice questions before the real thing"',
].join('\n');

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    zIndex: 1000,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    background: '#0f172a',
    borderRadius: '20px 20px 0 0',
    width: '100%',
    maxWidth: 560,
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '20px 16px 24px',
    boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '1px solid #1e293b',
    position: 'sticky',
    top: -20,
    background: '#0f172a',
    zIndex: 2,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 16, fontWeight: 700, color: '#e5e7eb', margin: '0 0 4px 0',
  },
  headerSub: {
    fontSize: 12, color: '#6b7280',
  },
  questionBlock: {
    marginBottom: 18,
  },
  questionText: {
    fontSize: 14, fontWeight: 600, color: '#e5e7eb',
    marginBottom: 10, lineHeight: 1.5,
  },
  option: (selected, hasError) => ({
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '10px 12px',
    borderRadius: 10,
    border: selected
      ? '1.5px solid #a78bfa'
      : hasError ? '1.5px solid #ef444444' : '1px solid #1e293b',
    background: selected ? '#4f46e511' : '#0f172a',
    cursor: 'pointer',
    marginBottom: 6,
    transition: 'border-color 0.15s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
  }),
  radioCircle: (selected) => ({
    width: 18, height: 18, borderRadius: '50%',
    border: selected ? '5px solid #a78bfa' : '2px solid #374151',
    flexShrink: 0, marginTop: 2,
    transition: 'border 0.15s',
  }),
  optionLabel: {
    fontSize: 13.5, fontWeight: 500, color: '#e5e7eb', marginBottom: 2,
  },
  optionSub: {
    fontSize: 12, color: '#6b7280',
  },
  textarea: {
    width: '100%', boxSizing: 'border-box',
    background: '#1e293b', border: '1px solid #374151',
    borderRadius: 10, padding: '12px 14px',
    color: '#e5e7eb', fontSize: 13, lineHeight: 1.6,
    resize: 'vertical', minHeight: 90, maxHeight: 200,
    outline: 'none', fontFamily: 'inherit',
  },
  charCount: {
    textAlign: 'right', fontSize: 11, color: '#475569', marginTop: 4,
  },
  errorBanner: {
    background: '#1f0000', border: '1px solid #dc262644',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: '#fca5a5', marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: (submitting) => ({
    width: '100%', padding: '14px',
    borderRadius: 12, border: 'none',
    background: submitting ? '#1e293b' : '#4f46e5',
    color: submitting ? '#6b7280' : '#fff',
    fontSize: 15, fontWeight: 700,
    cursor: submitting ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.2s',
  }),
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.interviewId — used for API submission
 * @param {Function} props.onComplete — called when feedback submitted (or network failure)
 */
export default function FeedbackForm({ interviewId, onComplete }) {
  const [responses, setResponses] = useState({
    assessmentAccuracy:    null,
    questionSpecificity:   null,
    feedbackActionability: null,
    recommendationScore:   null,
    improvementSuggestion: '',
  });
  const [startTime]    = useState(Date.now());
  const [submitting,   setSubmitting]   = useState(false);
  const [errorFields,  setErrorFields]  = useState([]);
  const [showError,    setShowError]    = useState(false);

  const MCQ_IDS = MCQ_QUESTIONS.map(q => q.id);

  function select(id, value) {
    setResponses(r => ({ ...r, [id]: value }));
    // Clear error for this field if it was highlighted
    setErrorFields(prev => prev.filter(f => f !== id));
  }

  async function handleSubmit() {
    // Validate all 4 MCQs answered
    const unanswered = MCQ_IDS.filter(id => responses[id] === null);
    if (unanswered.length > 0) {
      setErrorFields(unanswered);
      setShowError(true);
      // Scroll to first unanswered
      document.getElementById(`q-${unanswered[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setShowError(false);

    const timeToCompleteSec = Math.round((Date.now() - startTime) / 1000);

    try {
      await apiRequest(`/api/interview/${interviewId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          assessmentAccuracy:    responses.assessmentAccuracy,
          questionSpecificity:   responses.questionSpecificity,
          feedbackActionability: responses.feedbackActionability,
          recommendationScore:   responses.recommendationScore,
          improvementSuggestion: responses.improvementSuggestion || null,
          timeToCompleteSec,
          skipped: false,
        }),
      });
    } catch (err) {
      // Never block results on feedback failure, but log so issues are visible.
      console.error('[FeedbackForm] Submission failed:', err?.message || err);
    } finally {
      onComplete();
    }
  }

  const charCount = responses.improvementSuggestion.length;
  const allAnswered = MCQ_IDS.every(id => responses[id] !== null);

  return (
    <div style={S.overlay}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        style={S.sheet}
      >
        {/* Header */}
        <div style={S.header}>
          <p style={S.headerTitle}>Before your results — quick feedback</p>
          <p style={S.headerSub}>Takes under 2 minutes · Helps us improve VERITAS for everyone</p>
        </div>

        {/* MCQ Questions */}
        {MCQ_QUESTIONS.map((q) => {
          const hasError = errorFields.includes(q.id);
          return (
            <div key={q.id} id={`q-${q.id}`} style={S.questionBlock}>
              <p style={{
                ...S.questionText,
                color: hasError ? '#fca5a5' : '#e5e7eb',
              }}>
                {q.question}
                <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
              </p>
              {q.options.map(opt => {
                const selected = responses[q.id] === opt.value;
                return (
                  <div
                    key={opt.value}
                    style={S.option(selected, hasError && !responses[q.id])}
                    onClick={() => select(q.id, opt.value)}
                    role="radio"
                    aria-checked={selected}
                  >
                    <div style={S.radioCircle(selected)} />
                    <div>
                      <div style={S.optionLabel}>{opt.label}</div>
                      <div style={S.optionSub}>{opt.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Text question */}
        <div style={S.questionBlock}>
          <p style={S.questionText}>
            What's one thing that would make VERITAS 10x better?
            <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 400, marginLeft: 6 }}>(optional)</span>
          </p>
          <textarea
            style={S.textarea}
            placeholder={TEXT_PLACEHOLDER}
            value={responses.improvementSuggestion}
            onChange={e => setResponses(r => ({ ...r, improvementSuggestion: e.target.value.slice(0, 500) }))}
            maxLength={500}
          />
          <div style={S.charCount}>{charCount} / 500</div>
        </div>

        {/* Validation error */}
        {showError && (
          <div style={S.errorBanner}>
            Please answer all required questions above before submitting.
          </div>
        )}

        {/* Submit — sticky so CTA is always in view on mobile */}
        <div style={{
          position: 'sticky',
          bottom: -24,
          background: '#0f172a',
          padding: '12px 0 4px',
          borderTop: '1px solid #1e293b',
          marginTop: 16,
        }}>
        <button
          style={S.submitBtn(submitting)}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid #475569', borderTopColor: '#a78bfa',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Submitting…
            </>
          ) : (
            <>Submit &amp; see my results →</>
          )}
        </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </div>
  );
}
