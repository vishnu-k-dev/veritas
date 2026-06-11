// ============================================================
// VERITAS RAG Engine — DROP-IN PLUGIN (v2: Cost-Optimized)
// ============================================================
// Cost comparison:
//   v1: ~₹2.50 per interview (GPT-4o per-answer scoring)
//   v2: ~₹0.13 per interview (Gemini + batch eval)
//
// API:
//   RAG.nextQuestion(params)    — generate next question
//   RAG.analyzeAnswer(params)   — live follow-up (rule-based, free)
//   RAG.batchEvaluate(params)   — score all answers at end (1 API call)
//   RAG.getFollowup(params)     — manual follow-up retrieval
// ============================================================

import { generateQuestion }             from './generator.js'
import { analyzeAnswer, batchEvaluate }  from './analyzer.js'
import { retrieveFollowups }             from './retriever.js'

export const RAG = {

  // ── Generate next question (Gemini Flash-Lite → GPT-4o-mini fallback) ──
  // Returns: { question, questionId, topic, type, difficulty, fromRAG }
  async nextQuestion({
    context,       // fingerprint or resume object
    difficulty,    // 'warm_up' | 'medium' | 'deep' | 'pressure'
    history,       // conversation history array
    usedIds,       // question IDs used so far
    questionNum,
    totalQ,
  }) {
    return generateQuestion({ context, difficulty, history, usedIds, questionNum, totalQ })
  },

  // ── Live answer analysis (rule-based, ZERO AI cost) ──────
  // Returns: { scores: null, followup, action }
  // NOTE: scores are null during interview — call batchEvaluate after
  async analyzeAnswer({
    question,
    answer,
    context,
    questionType,
    difficulty,
    followupCount = 0,
    questionId    = null,
  }) {
    return analyzeAnswer({
      question, answer, context, questionType,
      difficulty, followupCount, questionId,
    })
  },

  // ── Batch evaluate ALL answers after interview ends ───────
  // ONE API call (GPT-4o-mini) instead of 8 × GPT-4o
  // Cost: ~₹0.08 instead of ~₹1.80
  // Returns: Array of { q, authenticity, depth, clarity, overall, verdict, reasoning }
  async batchEvaluate({
    allQAPairs,     // [{ question, answer, difficulty, questionId, followupTriggered?, followupReason? }]
    context,        // fingerprint or resume
    interviewId,    // for logging
  }) {
    return batchEvaluate({ allQAPairs, context, interviewId })
  },

  // ── Manual follow-up retrieval (optional) ─────────────────
  async getFollowup({ question, answer, triggerType, context }) {
    const results = await retrieveFollowups({ question, answer, triggerType, context })
    return results[0]?.question || null
  },
}

// ── Example integration ─────────────────────────────────────
//
// import { RAG } from './VERITAS-rag/index.js'
//
// // During interview — per question:
// const q = await RAG.nextQuestion({ context, difficulty, history, usedIds, questionNum, totalQ })
// await saveMessage({ role: 'assistant', content: q.question })
// usedIds.push(q.questionId)
//
// // After candidate answers:
// const analysis = await RAG.analyzeAnswer({
//   question: q.question, answer: userAnswer, context,
//   questionType: q.type, difficulty, followupCount, questionId: q.questionId,
// })
//
// if (analysis.action === 'followup') {
//   await saveMessage({ role: 'assistant', content: analysis.followup.question })
//   followupCount++
//   // Collect for batch: allQAPairs.push({ question, answer, difficulty, questionId, followupTriggered: true })
// } else {
//   followupCount = 0
//   questionsAsked++
//   // Collect for batch: allQAPairs.push({ question, answer, difficulty, questionId })
// }
//
// // After ALL questions done:
// const evaluations = await RAG.batchEvaluate({ allQAPairs, context, interviewId })
// // evaluations[i].overall, evaluations[i].verdict, etc.

