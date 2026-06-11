// backend/src/middleware/sanitiser.js
// Input sanitisation + prompt injection defence
const MAX_ANSWER_LENGTH = 2000
const MAX_FIELD_LENGTH = 500

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[INST\]|\[\/INST\]/i,
  /forget\s+everything/i,
  /<\|im_start\|>|<\|im_end\|>/i,
  /###\s*instruction/i,
  /act\s+as\s+(a\s+)?(different|new|another)/i,
]

export function sanitiseAnswer(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid answer format')
  }

  // Truncate
  let clean = input.trim().slice(0, MAX_ANSWER_LENGTH)

  // Detect and neutralise injection attempts
  let injectionDetected = false
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      injectionDetected = true
      clean = clean.replace(pattern, '[content removed]')
    }
  }

  // Log suspicious input for abuse monitoring
  if (injectionDetected) {
    console.warn('⚠️  Prompt injection attempt detected', {
      sample: input.slice(0, 100)
    })
  }

  // Strip null bytes and control characters
  clean = clean.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')

  return clean
}

export function sanitiseField(input, maxLength = MAX_FIELD_LENGTH) {
  if (!input) return ''
  return String(input).trim().slice(0, maxLength)
}

// Express middleware version
export function sanitiseBody(fields) {
  return (req, res, next) => {
    try {
      if (fields.includes('answer') && req.body.answer) {
        req.body.answer = sanitiseAnswer(req.body.answer)
      }
      fields.filter(f => f !== 'answer').forEach(f => {
        if (req.body[f]) req.body[f] = sanitiseField(req.body[f])
      })
      next()
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  }
}
