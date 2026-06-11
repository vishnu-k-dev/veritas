// Authenticity Scorer - Simple, realistic scoring that never returns 0 for real answers

/**
 * Score a single answer for authenticity
 * Simple 5-signal scoring: effort, decisions, problems, outcomes, technical terms
 * @param {string} answer - The candidate's answer
 * @param {object} question - The question that was asked
 * @returns {object} - Authenticity analysis
 */
// Common filler phrases that signal a non-answer
const FILLER_PHRASES = ['ok', 'okay', 'right', 'sure', 'yes', 'no', 'idk', 'i don\'t know',
    'not sure', 'maybe', 'i guess', 'fine', 'good', 'great', 'alright', 'noted'];

export function scoreAnswerAuthenticity(answer, question) {
    if (!answer || answer.trim().length === 0) {
        return { score: 0, breakdown: {}, flags: {}, redFlags: [] };
    }

    const text = answer.trim();
    const lower = text.toLowerCase();
    const wordCount = text.split(/\s+/).length;

    // Very short answers (< 15 chars) or pure filler can't demonstrate ownership
    if (text.length < 15 || (wordCount <= 3 && FILLER_PHRASES.some(f => lower.includes(f)))) {
        return { score: 5, breakdown: {}, flags: {}, redFlags: ['Answer too short or non-substantive'] };
    }

    // Any substantive answer over 20 characters gets a base score of 50
    let score = text.length > 20 ? 50 : 20;

    const breakdown = {
        effort: false,
        decisionWords: false,
        problemMention: false,
        outcomeMention: false,
        technicalTerms: false,
    };

    // +10 if answer is over 60 words (shows effort)
    if (wordCount > 60) {
        score += 10;
        breakdown.effort = true;
    }

    // +15 if answer contains decision words
    const decisionWords = ['because', 'since', 'chose', 'decided', 'instead of', 'rather than'];
    if (decisionWords.some(w => lower.includes(w))) {
        score += 15;
        breakdown.decisionWords = true;
    }

    // +15 if answer mentions a problem
    const problemWords = ['error', 'bug', 'issue', 'broke', 'fix', 'debug', 'crash', 'failed'];
    if (problemWords.some(w => lower.includes(w))) {
        score += 15;
        breakdown.problemMention = true;
    }

    // +10 if answer mentions an outcome
    const outcomeWords = ['worked', 'solved', 'resolved', 'result', 'managed', 'end up'];
    if (outcomeWords.some(w => lower.includes(w))) {
        score += 10;
        breakdown.outcomeMention = true;
    }

    // +10 if answer uses specific technical terms
    const techTerms = ['config', 'endpoint', 'route', 'schema', 'query', 'async', 'token', 'session'];
    if (techTerms.some(w => lower.includes(w))) {
        score += 10;
        breakdown.technicalTerms = true;
    }

    // Cap at 100
    score = Math.min(score, 100);

    return {
        score,
        breakdown,
        flags: {
            skillMentions: question?.skill ? (lower.includes(question.skill.toLowerCase()) ? 1 : 0) : 0,
            relevanceScore: score >= 50 ? 80 : 50,
            typeMatch: true,
        },
        redFlags: [],
    };
}

/**
 * Identify red flags — simplified, kept for API compatibility
 * @param {string} answer - The answer to analyze
 * @returns {object[]} - Empty array (red flag detection removed per spec)
 */
export function identifyRedFlags(_answer) {
    return [];
}

/**
 * Calculate overall authenticity for an interview session
 * @param {object[]} qaPairs - Array of question-answer pairs with scores
 * @returns {object} - Overall authenticity assessment
 */
export function calculateOverallAuthenticity(qaPairs) {
    if (!qaPairs || qaPairs.length === 0) {
        // Return 0, not 50 — no answers means no demonstrated authenticity
        return { score: 0, confidence: 0, assessment: 'No answers submitted', scoreSource: 'none' };
    }

    // Prefer LLM composite score when available — calibrated rubric beats keyword heuristics
    const getScore = (qa) => {
        if (qa.llmScore != null)       return qa.llmScore;          // LLM composite (preferred)
        if (qa.llmEval?.composite_score != null) return qa.llmEval.composite_score;
        // Keyword fallback
        const authScore = qa.authenticity || qa.authenticityScore ||
            scoreAnswerAuthenticity(qa.answer || '', qa.question);
        return authScore.score ?? 50;
    };

    let totalScore = 0;
    let llmCount = 0;
    qaPairs.forEach(qa => {
        totalScore += getScore(qa);
        if (qa.llmScore != null || qa.llmEval?.composite_score != null) llmCount++;
    });

    const averageScore = Math.round(totalScore / qaPairs.length);
    const scoreSource = llmCount === qaPairs.length ? 'llm'
        : llmCount > 0 ? 'mixed'
        : 'keyword';

    let assessment, riskLevel;
    if (averageScore >= 60) {
        assessment = 'High authenticity - Answers show genuine personal experience';
        riskLevel = 'low';
    } else if (averageScore >= 42) {
        assessment = 'Moderate authenticity - Some answers may need verification';
        riskLevel = 'medium';
    } else {
        assessment = 'Low authenticity - Answers appear generic or rehearsed';
        riskLevel = 'high';
    }

    return {
        score: averageScore,
        averageScore,
        consistencyScore: 70,
        totalRedFlags: 0,
        assessment,
        riskLevel,
        confidence: Math.min(qaPairs.length * 15, 95),
        scoreSource,
    };
}

/**
 * Generate authenticity report for recruiter
 * @param {object} overallAuth - Overall authenticity assessment
 * @param {object[]} qaPairs - Question-answer pairs
 * @returns {object} - Detailed report
 */
export function generateAuthenticityReport(overallAuth, qaPairs) {
    if (!qaPairs || qaPairs.length === 0) {
        return {
            summary: { score: 50, riskLevel: 'medium', assessment: 'No data available' },
            details: { totalQuestions: 0, concerningCount: 0, strongCount: 0, consistencyScore: 70 },
            concerningAnswers: [],
            strongAnswers: [],
            recommendation: 'Unable to assess - no data provided.',
        };
    }

    const getAuthScore = (qa) => qa.authenticity || qa.authenticityScore || scoreAnswerAuthenticity(qa.answer || '', qa.question);

    const concerningAnswers = qaPairs.filter(qa => {
        const auth = getAuthScore(qa);
        return (auth.score || 50) < 45;
    });

    const strongAnswers = qaPairs.filter(qa => {
        const auth = getAuthScore(qa);
        return (auth.score || 50) >= 65;
    });

    return {
        summary: {
            score: overallAuth?.score || 50,
            riskLevel: overallAuth?.riskLevel || 'medium',
            assessment: overallAuth?.assessment || 'Assessment pending',
        },
        details: {
            totalQuestions: qaPairs.length,
            concerningCount: concerningAnswers.length,
            strongCount: strongAnswers.length,
            consistencyScore: overallAuth?.consistencyScore || 70,
        },
        concerningAnswers: concerningAnswers.map(qa => {
            const auth = getAuthScore(qa);
            return {
                question: qa.question?.text || 'Unknown',
                skill: qa.question?.skill || 'general',
                score: auth.score || 50,
                redFlags: [],
            };
        }),
        strongAnswers: strongAnswers.map(qa => {
            const auth = getAuthScore(qa);
            return {
                question: qa.question?.text || 'Unknown',
                skill: qa.question?.skill || 'general',
                score: auth.score || 50,
            };
        }),
        recommendation: generateAuthRecommendation(overallAuth),
    };
}

/**
 * Generate recommendation based on authenticity analysis
 */
function generateAuthRecommendation(overallAuth) {
    if (!overallAuth) return 'Review manually.';
    if (overallAuth.riskLevel === 'low') {
        return 'Authenticity appears genuine. Proceed with confidence.';
    } else if (overallAuth.riskLevel === 'medium') {
        return 'Consider follow-up on weaker answers in next round.';
    } else {
        return 'High authenticity risk. Recommend additional screening or verification.';
    }
}

export default {
    scoreAnswerAuthenticity,
    identifyRedFlags,
    calculateOverallAuthenticity,
    generateAuthenticityReport,
};
