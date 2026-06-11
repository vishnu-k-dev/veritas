// Heuristic AI-usage detector for exam answers
// Runs inline in the evaluate route — zero API cost, zero latency overhead.
// Looks for ChatGPT-characteristic patterns: opener phrases, closer phrases,
// filler language, impersonal structure, and high word-count with zero specifics.

const OPENER_RE = [
  /^certainly[!,\s]/i,
  /^of course[!,\s]/i,
  /^great question[!,\s]/i,
  /^sure[!,\s]/i,
  /^absolutely[!,\s]/i,
  /^as an ai\b/i,
  /^as a language model\b/i,
  /^that'?s a great/i,
  /^happy to (help|explain)/i,
]

const CLOSER_RE = [
  /in conclusion[,\s]/i,
  /to summarize[,\s]/i,
  /to sum up[,\s]/i,
  /i hope this (helps|answers)/i,
  /feel free to (ask|reach out)/i,
  /let me know if you (have|need)/i,
  /hope that (helps|answers|clarifies)/i,
  /if you('?d like| want) (more|further) (information|detail)/i,
]

const FILLER_RE = [
  /it'?s important to note\b/i,
  /it'?s worth (noting|mentioning)\b/i,
  /one thing to (note|consider|mention|keep in mind)\b/i,
  /this is (particularly|especially) important\b/i,
  /at (its|the) core\b/i,
  /\bleverag(e|ing) (the|its|this)\b/i,
  /\bseamlessly\b/i,
  /\brobust (solution|approach|system|architecture|framework)\b/i,
  /\bscalab(le|ility)\b.*\b(solution|approach)\b/i,
  /\bbest practices\b/i,
  /\bensures? (that|the)\b/i,
  /\befficiently (handle|manage|process)\b/i,
  /various (factors|aspects|components|considerations)/i,
  /a variety of\b/i,
  /\bstate-of-the-art\b/i,
  /\buser-friendly\b/i,
  /\bseamless(ly)? integrat/i,
]

export function detectAIUsage(answerText, { pasteDetected = false, wpm = 0 } = {}) {
  const text = (answerText || '').trim()
  if (!text) return { suspicionScore: 0, signals: [], verdict: 'clean' }

  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  const signals = []
  let score = 0

  // ── Opener phrases (strong signal — GPT very commonly starts with these) ─────
  if (OPENER_RE.some(r => r.test(text))) {
    signals.push('ai_opener_phrase')
    score += 40
  }

  // ── Closer phrases (strong signal) ───────────────────────────────────────────
  if (CLOSER_RE.some(r => r.test(text))) {
    signals.push('ai_closer_phrase')
    score += 25
  }

  // ── Filler language count ─────────────────────────────────────────────────────
  const fillerHits = FILLER_RE.filter(r => r.test(text)).length
  if (fillerHits >= 2) {
    signals.push('ai_filler_language')
    score += Math.min(fillerHits * 8, 24)
  }

  // ── Bullet point density (AI over-structures short answers) ──────────────────
  const bulletLines = (text.match(/^[-*•]\s/gm) || []).length
  const bulletRatio = wordCount > 0 ? bulletLines / (wordCount / 10) : 0
  if (bulletRatio > 0.5 && wordCount > 80) {
    signals.push('high_bullet_density')
    score += 15
  }

  // ── No first-person pronouns in a long answer ─────────────────────────────────
  const firstPerson = (text.match(/\b(I|my|me|mine|we|our)\b/gi) || []).length
  const fpDensity = wordCount > 0 ? firstPerson / wordCount : 0
  if (wordCount > 100 && fpDensity < 0.01) {
    signals.push('no_first_person')
    score += 15
  }

  // ── Long answer with zero technical specifics ─────────────────────────────────
  const hasSpecifics = /\b([a-zA-Z_/-]+\.(js|ts|py|go|java|rb|rs|jsx|tsx|css|html|json|yml|yaml)|error:|exception:|line \d+|port \d{4}|v\d+\.\d+|\d+ms|\d+s latency|commit [a-f0-9]{5,}|localhost|npm|yarn|docker|git (commit|push|merge))/i.test(text)
  if (wordCount > 150 && !hasSpecifics) {
    signals.push('generic_long_answer')
    score += 15
  }

  // ── Proctoring signals ────────────────────────────────────────────────────────
  if (pasteDetected) {
    signals.push('paste_detected')
    score += 25
  } else if (wpm > 180 && wordCount > 60) {
    signals.push('anomalous_typing_speed')
    score += 15
  }

  score = Math.min(100, score)
  const verdict = score >= 60 ? 'flagged' : score >= 30 ? 'suspicious' : 'clean'

  return { suspicionScore: score, signals, verdict }
}
