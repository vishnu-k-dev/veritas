// ============================================================
// VERITAS RAG — Question Generator (v2: Cost-Optimized)
// ─────────────────────────────────────────────────────────────
// v1: GPT-4o-mini for selection → ~₹0.10/interview
// v2: Gemini 2.0 Flash-Lite → ~₹0.02/interview (10x cheaper)
//
// Falls back to GPT-4o-mini if Gemini API key not set.
// ============================================================

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { retrieveQuestions } from './retriever.js'

// Lazy init — don't crash at import time if key is missing
let _openai = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// Gemini client — lazy init
let gemini = null
function getGemini() {
  if (!gemini && process.env.GOOGLE_AI_API_KEY) {
    gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  }
  return gemini
}

// ── Generate next question ────────────────────────────────
export async function generateQuestion({
  context,        // fingerprint (github) or structured resume
  difficulty,
  history     = [],
  usedIds     = [],
  questionNum = 1,
  totalQ      = 8,
}) {

  // Step 1: Retrieve top 5 relevant questions from RAG
  const candidates = await retrieveQuestions({
    context,
    difficulty,
    alreadyUsed: usedIds,
    count: 5,
  })

  if (!candidates.length) {
    return generateFromScratch({ context, difficulty, history, questionNum, totalQ })
  }

  // Step 2: Pick the best candidate and personalize it
  const question = await pickAndPersonalize({
    candidates, context, history, difficulty, questionNum, totalQ,
  })

  return {
    question:    question.text,
    questionId:  question.sourceId,
    topic:       question.topic,
    type:        question.type,
    difficulty,
    fromRAG:     true,
  }
}

// ── Pick best candidate and personalize (Gemini first, GPT fallback) ──
async function pickAndPersonalize({ candidates, context, history, difficulty, questionNum, totalQ }) {
  const historyBlock = history.slice(-4).map(m =>
    `${m.role === 'assistant' ? 'Q' : 'A'}: ${m.content.slice(0, 150)}`
  ).join('\n')

  const candidateList = candidates.map((c, i) =>
    `[${i + 1}] (${c.question_type}, similarity: ${c.similarity?.toFixed(2)}) ${c.question}`
  ).join('\n')

  const contextBlock = buildContextBlock(context)

  const prompt = `You are picking and personalizing the best interview question for this candidate.

${contextBlock}

Recent conversation:
${historyBlock || 'None yet'}

Question ${questionNum} of ${totalQ} — difficulty: ${difficulty}

Candidate questions (pick ONE and personalize it to reference this specific candidate's work):
${candidateList}

Rules:
- Pick the question that creates the most insightful, unexpected angle into candidate's work
- Strongly vary question types across the interview (don't repeat the same style twice in a row)
- Personalize it: replace generic terms with their specific project/tech/role details
- Do NOT pick a topic already covered in recent conversation
- Avoid the most obvious or textbook question — dig into something only this candidate would face
- Keep it to 1-2 sentences max
- Sound like a curious, experienced human interviewer — not a form or a checklist

Return ONLY valid JSON:
{
  "selectedIndex": 1-5,
  "question": "the personalized question text",
  "topic": "1-3 word topic label",
  "reasoning": "why this question for this candidate"
}`

  let raw

  // Try Gemini first (10x cheaper)
  const g = getGemini()
  if (g) {
    try {
      const model = g.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
      const result = await model.generateContent(prompt)
      raw = result.response.text().replace(/```json|```/g, '').trim()
    } catch (err) {
      console.warn('Gemini question gen failed, falling back to GPT-4o-mini:', err.message)
      raw = null
    }
  }

  // Fallback to GPT-4o-mini
  if (!raw) {
    const res = await getOpenAI().chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  250,
      temperature: 0.6,
      messages:    [{ role: 'user', content: prompt }]
    })
    raw = res.choices[0].message.content.replace(/```json|```/g, '').trim()
  }

  const parsed = JSON.parse(raw)
  const chosen = candidates[(parsed.selectedIndex || 1) - 1]

  return {
    text:     parsed.question,
    topic:    parsed.topic,
    type:     chosen?.question_type,
    sourceId: chosen?.id,
  }
}

// ── Fallback: generate from scratch (Gemini first) ────────
async function generateFromScratch({ context, difficulty, history, questionNum, totalQ }) {
  const contextBlock  = buildContextBlock(context)
  const historyBlock  = history.slice(-4).map(m =>
    `${m.role === 'assistant' ? 'Q' : 'A'}: ${m.content.slice(0, 150)}`
  ).join('\n')

  const prompt = `You are a technical interviewer for VERITAS.

${contextBlock}

Recent conversation:
${historyBlock || 'None yet'}

Generate ONE interview question for question ${questionNum} of ${totalQ}.
Difficulty: ${difficulty}

Rules:
- Only ask about something specific to THIS candidate's actual project or experience
- Never ask generic textbook questions
- ${difficulty === 'warm_up' ? 'Be welcoming and broad' : ''}
- ${difficulty === 'medium' ? 'Focus on implementation specifics' : ''}
- ${difficulty === 'deep' ? 'Ask something only the real author can answer' : ''}
- ${difficulty === 'pressure' ? 'Target the most likely gap or exaggeration' : ''}
- 1-2 sentences only

Return just the question, nothing else.`

  let questionText = null

  // Try Gemini first
  const g = getGemini()
  if (g) {
    try {
      const model = g.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
      const result = await model.generateContent(prompt)
      questionText = result.response.text().trim()
    } catch (err) {
      console.warn('Gemini scratch gen failed, falling back:', err.message)
    }
  }

  // Fallback to GPT-4o-mini
  if (!questionText) {
    const res = await getOpenAI().chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  150,
      temperature: 0.7,
      messages:    [{ role: 'user', content: prompt }]
    })
    questionText = res.choices[0].message.content.trim()
  }

  return {
    question:   questionText,
    questionId: null,
    topic:      difficulty,
    type:       'generated',
    difficulty,
    fromRAG:    false,
  }
}

// ── Build context block ───────────────────────────────────
function buildContextBlock(context) {
  if (context.source === 'github') {
    return [
      `Project: ${context.repoName}`,
      `Tech stack: ${(context.techStack || []).join(', ')}`,
      `Architecture: ${context.architecture || 'unknown'}`,
      context.pressureTopics?.length
        ? `Known pressure points: ${context.pressureTopics.join(', ')}` : '',
    ].filter(Boolean).join('\n')
  }
  return [
    `Candidate role: ${context.currentRole}`,
    `Experience: ${context.totalExperience}`,
    `Skills: ${[
      ...(context.skills?.languages || []),
      ...(context.skills?.frameworks || []),
    ].join(', ')}`,
    context.biggestClaims?.length
      ? `Claims to verify: ${context.biggestClaims.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

