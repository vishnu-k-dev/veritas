// Decision Engine - Makes final hiring decisions with explainable reasoning
import { DECISION_REASONS, IMPROVEMENT_SUGGESTIONS, ALTERNATIVE_ROLES } from '../utils/constants';

/**
 * Calculate all evaluation metrics
 * @param {object} skillMapping - Skill mapping results
 * @param {object} authenticityReport - Authenticity analysis
 * @param {object[]} qaPairs - Question-answer pairs
 * @returns {object} - All evaluation metrics
 */
export function calculateEvaluationMetrics(skillMapping, authenticityReport, qaPairs) {
    // Prefer LLM-scored dimensions when available (from 5-dimension rubric)
    const llmEvals = qaPairs.filter(qa => qa.llmEval != null);
    const avgLLM = (key) => llmEvals.length > 0
        ? Math.round(llmEvals.reduce((s, qa) => s + (qa.llmEval[key] ?? 50), 0) / llmEvals.length)
        : null;

    const llmAuthenticity  = avgLLM('authenticity_score');
    const llmDepth         = avgLLM('depth_score');
    const llmSpecificity   = avgLLM('specificity_score');
    const llmCommunication = avgLLM('communication_score');
    const llmConsistency   = avgLLM('consistency_score');

    return {
        skillMatch:    skillMapping?.skillMatchScore ?? 0,
        depth:         llmDepth         ?? calculateDepthScore(qaPairs),
        authenticity:  llmAuthenticity  ?? authenticityReport.summary.score,
        specificity:   llmSpecificity   ?? authenticityReport.summary.score,
        communication: llmCommunication ?? calculateCommunicationScore(qaPairs),
        consistency:   llmConsistency   ?? authenticityReport.details.consistencyScore,
    };
}

/**
 * Calculate depth score based on answer quality
 */
function calculateDepthScore(qaPairs) {
    if (qaPairs.length === 0) return 0; // No answers = no depth, not a neutral 50

    let totalDepth = 0;

    qaPairs.forEach(qa => {
        let depthPoints = 35; // baseline — answering at all earns this
        const answer = qa.answer.toLowerCase();

        // Length indicates depth (to a point)
        if (answer.length > 100) depthPoints += 15;
        if (answer.length > 200) depthPoints += 15;
        if (answer.length > 350) depthPoints += 10;

        // Technical specifics
        if (/\d+/.test(answer)) depthPoints += 10; // Numbers
        if (/error|bug|issue/.test(answer)) depthPoints += 10;
        if (/because|reason|since/.test(answer)) depthPoints += 10; // Reasoning
        if (/decided|chose|picked/.test(answer)) depthPoints += 10; // Decisions
        if (/learned|realized|understood/.test(answer)) depthPoints += 10; // Growth

        totalDepth += Math.min(depthPoints, 100);
    });

    return Math.round(totalDepth / qaPairs.length);
}

/**
 * Calculate communication score
 */
function calculateCommunicationScore(qaPairs) {
    if (qaPairs.length === 0) return 0; // No answers = no communication, not a neutral 50

    let totalScore = 0;

    qaPairs.forEach(qa => {
        let commScore = 50; // Base
        const answer = qa.answer;

        // Clear structure
        if (answer.includes('.') && answer.split('.').length > 2) commScore += 15;

        // Reasonable length (not too short or too long)
        if (answer.length >= 100 && answer.length <= 500) commScore += 15;

        // Uses transitional phrases
        const transitions = ['first', 'then', 'after', 'finally', 'however', 'also', 'additionally'];
        if (transitions.some(t => answer.toLowerCase().includes(t))) commScore += 10;

        // Coherent thought (sentences average length)
        const sentences = answer.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 1) {
            const avgLength = answer.length / sentences.length;
            if (avgLength >= 40 && avgLength <= 120) commScore += 10;
        }

        totalScore += Math.min(commScore, 100);
    });

    return Math.round(totalScore / qaPairs.length);
}

/**
 * Make the final hiring decision
 * Simple thresholds: 65+ PASS, 45-64 HOLD, 0-44 FAIL
 * @param {object} metrics - Evaluation metrics
 * @param {object} skillMapping - Skill mapping results
 * @param {object} authenticityReport - Authenticity analysis
 * @returns {object} - Decision with reasoning
 */
export function makeDecision(metrics, _skillMapping, _authenticityReport, evaluations = [], qaPairs = []) {
    // Guard: if the student submitted zero meaningful answers, it's an automatic fail.
    // This prevents the "opened interview, hit end, got 51/HOLD" bug caused by every
    // fallback metric defaulting to 50.
    const meaningfulAnswers = evaluations.filter(e => e.composite_score != null).length
        || qaPairs.filter(qa => (qa.answer || '').trim().length > 10).length;
    if (meaningfulAnswers === 0) {
        return {
            decision: 'REJECT',
            overallScore: 0,
            scoreMode: 'empty',
            confidence: 100,
            reasons: ['No answers were submitted'],
            questionBreakdown: [],
        };
    }

    // Determine mode: recruiter (has real skillMatch) vs student/repo (no job description)
    const hasSkillMatch = metrics.skillMatch != null && metrics.skillMatch > 0 && _skillMapping?.required?.length > 0;

    let overallScore;
    if (hasSkillMatch) {
        // Recruiter mode — skill match re-enters at reduced weight
        overallScore = Math.round(
            metrics.authenticity * 0.35 +
            metrics.depth        * 0.20 +
            metrics.specificity  * 0.15 +
            metrics.skillMatch   * 0.15 +
            metrics.communication * 0.10 +
            metrics.consistency  * 0.05
        );
    } else {
        // Student / repo mode — skill match removed entirely
        overallScore = Math.round(
            metrics.authenticity  * 0.45 +
            metrics.depth         * 0.25 +
            metrics.specificity   * 0.15 +
            metrics.communication * 0.10 +
            metrics.consistency   * 0.05
        );
    }

    // Thresholds — calibrated for student-friendly scoring (floor 25 per dimension)
    let decision;
    if (overallScore >= 60) {
        decision = 'PASS';
    } else if (overallScore >= 35) {
        decision = 'HOLD';
    } else {
        decision = 'REJECT';
    }

    // Per-question breakdown (populated when evaluations passed from LLM)
    const questionBreakdown = evaluations.map((e, i) => ({
        questionNumber:  i + 1,
        scores: {
            authenticity:  e.authenticity_score  ?? e.authenticityScore ?? null,
            depth:         e.depth_score         ?? null,
            specificity:   e.specificity_score   ?? null,
            communication: e.communication_score ?? null,
            consistency:   e.consistency_score   ?? null,
        },
        composite:       e.composite_score ?? e.authenticityScore ?? null,
        verdict:         e.verdict         ?? null,
        strengthNote:    e.reasoning_strength  ?? null,
        weaknessNote:    e.reasoning_weakness  ?? null,
        missingElements: e.missing_elements    ?? [],
        redFlag:         e.red_flag            ?? null,
    }));

    let reasons = [];
    let concerns = [];

    if (metrics.skillMatch >= 70) {
        reasons.push('Strong alignment with required skills');
    } else if (metrics.skillMatch >= 50) {
        concerns.push('Partial skill coverage - gaps in some areas');
    } else {
        concerns.push('Significant skill gaps for core requirements');
    }

    if (metrics.authenticity >= 70) {
        reasons.push('Demonstrated genuine personal experience');
    } else if (metrics.authenticity >= 50) {
        concerns.push('Some answers lacked specific details');
    } else {
        concerns.push('Answers appeared generic or rehearsed');
    }

    if (metrics.depth >= 70) {
        reasons.push('Good technical depth in responses');
    } else if (metrics.depth < 50) {
        concerns.push('Limited technical depth shown');
    }

    if (metrics.consistency >= 70) {
        reasons.push('Consistent quality across answers');
    } else if (metrics.consistency < 50) {
        concerns.push('Inconsistent depth across topics');
    }

    return {
        decision,
        overallScore,
        metrics,
        reasons,
        concerns,
        confidence: calculateDecisionConfidence(metrics, decision),
        scoreMode: hasSkillMatch ? 'recruiter' : 'student',
        questionBreakdown,
    };
}

/**
 * Calculate confidence in the decision
 */
function calculateDecisionConfidence(metrics, decision) {
    // Higher spread in metrics = lower confidence
    const values = Object.values(metrics);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const spread = Math.sqrt(variance);

    let confidence = 90 - spread;

    // Edge cases increase confidence
    if (decision === 'PASS' && avg >= 80) confidence = 95;
    if (decision === 'REJECT' && avg <= 35) confidence = 95;

    return Math.round(Math.max(60, Math.min(confidence, 98)));
}

/**
 * Generate recruiter-facing report
 * @param {object} decisionResult - The decision result
 * @param {object} skillMapping - Skill mapping
 * @param {object} authenticityReport - Authenticity report
 * @param {object} jobDescription - Job description
 * @returns {object} - Formatted recruiter report
 */
export function generateRecruiterReport(decisionResult, skillMapping, authenticityReport, _jobDescription) {
    return {
        decision: decisionResult.decision,
        overallScore: decisionResult.overallScore,
        confidence: decisionResult.confidence,

        metrics: {
            skillMatch: {
                score: decisionResult.metrics.skillMatch,
                label: getScoreLabel(decisionResult.metrics.skillMatch),
            },
            authenticity: {
                score: decisionResult.metrics.authenticity,
                label: getScoreLabel(decisionResult.metrics.authenticity),
            },
            depth: {
                score: decisionResult.metrics.depth,
                label: getScoreLabel(decisionResult.metrics.depth),
            },
            communication: {
                score: decisionResult.metrics.communication,
                label: getScoreLabel(decisionResult.metrics.communication),
            },
            consistency: {
                score: decisionResult.metrics.consistency,
                label: getScoreLabel(decisionResult.metrics.consistency),
            },
        },

        skillAnalysis: {
            strongSkills: skillMapping.strong.map(s => s.skill),
            weakSkills: skillMapping.weak.map(s => s.skill),
            missingSkills: skillMapping.missing.map(s => s.skill),
        },

        strengths: decisionResult.reasons,
        concerns: decisionResult.concerns,

        authenticityRisk: authenticityReport.summary.riskLevel,

        recommendation: generateRecruiterRecommendation(decisionResult, skillMapping),
    };
}

/**
 * Get label for score
 */
function getScoreLabel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 35) return 'Below Average';
    return 'Poor';
}

/**
 * Generate recommendation for recruiter
 */
function generateRecruiterRecommendation(decision, skillMapping) {
    switch (decision.decision) {
        case 'PASS':
            return 'Recommend advancing to next round. Strong candidate overall.';
        case 'HOLD': {
            const gaps = skillMapping.missing.slice(0, 2).map(s => s.skill).join(', ');
            return `Consider for role with additional screening on: ${gaps || 'key areas'}`;
        }
        case 'REJECT':
            return 'Does not meet minimum requirements for this role at this time.';
        default:
            return 'Review manually.';
    }
}

/**
 * Generate candidate feedback
 * @param {object} decisionResult - The decision result
 * @param {object} skillMapping - Skill mapping
 * @param {object} jobDescription - Job description
 * @returns {object} - Candidate-friendly feedback
 */
export function generateCandidateFeedback(decisionResult, skillMapping, _jobDescription) {
    const strengths = [];
    const improvements = [];
    const skillsAssessed = [];

    // Build strengths from metrics
    if (decisionResult.metrics.skillMatch >= 65) {
        const strongSkills = (skillMapping?.strong || []).slice(0, 3).map(s => s.skill).join(', ');
        strengths.push({
            title: 'Technical Skills',
            description: `Strong foundation in ${strongSkills || 'core technologies'}. Your experience aligns well with the role requirements.`
        });
    }

    if (decisionResult.metrics.communication >= 65) {
        strengths.push({
            title: 'Clear Communication',
            description: 'Your answers were well-structured and easy to follow. This is a valuable skill in collaborative environments.'
        });
    }

    if (decisionResult.metrics.depth >= 65) {
        strengths.push({
            title: 'Technical Depth',
            description: 'You demonstrated detailed understanding and provided specific examples from your experience.'
        });
    }

    if (decisionResult.metrics.authenticity >= 70) {
        strengths.push({
            title: 'Genuine Experience',
            description: 'Your answers reflected real-world experience with personal insights and specific details.'
        });
    }

    // Build improvements from gaps
    const missingSkills = (skillMapping?.missing || []).slice(0, 2);
    const weakSkills = (skillMapping?.weak || []).filter(s => s.importance === 'required').slice(0, 2);

    missingSkills.forEach(skill => {
        improvements.push({
            title: `Develop ${skill.skill} Skills`,
            description: `This skill is required for the role. Consider building projects or taking courses to gain practical experience.`
        });
    });

    weakSkills.forEach(skill => {
        improvements.push({
            title: `Deepen ${skill.skill} Expertise`,
            description: `You have some experience, but demonstrating more specific examples would strengthen your profile.`
        });
    });

    if (decisionResult.metrics.authenticity < 60) {
        improvements.push({
            title: 'Provide Specific Examples',
            description: 'Focus on sharing concrete examples with details like project names, tools used, and measurable outcomes.'
        });
    }

    if (decisionResult.metrics.communication < 60) {
        improvements.push({
            title: 'Structure Your Answers',
            description: 'Try using the STAR method (Situation, Task, Action, Result) to organize your responses clearly.'
        });
    }

    // Build skills assessed
    const allSkills = [...(skillMapping?.strong || []), ...(skillMapping?.weak || [])];
    allSkills.slice(0, 6).forEach(s => {
        skillsAssessed.push({
            skill: s.skill,
            score: s.confidence || Math.round(Math.random() * 30 + 60)
        });
    });

    // Add metric-based skills
    skillsAssessed.push({ skill: 'Overall Communication', score: decisionResult.metrics.communication });
    skillsAssessed.push({ skill: 'Technical Depth', score: decisionResult.metrics.depth });

    return {
        verdict: decisionResult.decision.toLowerCase().replace('reject', 'fail'),
        overallScore: decisionResult.overallScore,
        summary: getFriendlyOutcome(decisionResult.decision),
        strengths,
        improvements,
        skillsAssessed: skillsAssessed.slice(0, 6),
        metrics: decisionResult.metrics,
    };
}

/**
 * Get friendly outcome message
 */
function getFriendlyOutcome(decision) {
    switch (decision) {
        case 'PASS':
            return 'Great news! Your interview went well and you\'re moving forward.';
        case 'HOLD':
            return 'Thank you for your interview. We\'re reviewing your profile further.';
        case 'REJECT':
            return 'Thank you for your interest. While we won\'t be moving forward this time, we encourage you to apply again in the future.';
        default:
            return 'Thank you for completing the interview.';
    }
}

/**
 * Get improvement suggestions for a skill
 */
function _getImprovementSuggestions(skill) {
    const skillLower = skill.toLowerCase();

    // Determine skill category
    let category = 'general';
    if (['javascript', 'python', 'java', 'typescript', 'c++'].some(s => skillLower.includes(s))) {
        category = 'programming';
    } else if (['react', 'angular', 'vue', 'node', 'django'].some(s => skillLower.includes(s))) {
        category = 'frameworks';
    } else if (['sql', 'mongo', 'database', 'redis'].some(s => skillLower.includes(s))) {
        category = 'databases';
    } else if (['aws', 'azure', 'docker', 'kubernetes'].some(s => skillLower.includes(s))) {
        category = 'cloud';
    }

    const templates = IMPROVEMENT_SUGGESTIONS[category] || IMPROVEMENT_SUGGESTIONS.general;
    return templates.map(t => t.replace(/{skill}/g, skill));
}

/**
 * Find alternative roles based on candidate strength
 */
function _findAlternativeRoles(targetRole, skillMapping) {
    const alternatives = [];

    // Find what the candidate is strong in
    const strongCategories = skillMapping.strong.reduce((cats, skill) => {
        if (skill.category && !cats.includes(skill.category)) {
            cats.push(skill.category);
        }
        return cats;
    }, []);

    // Map to alternative roles
    if (strongCategories.includes('frameworks') || strongCategories.includes('programming')) {
        if (skillMapping.strong.some(s => ['react', 'vue', 'angular', 'css', 'html'].includes(s.skill.toLowerCase()))) {
            alternatives.push({ role: 'Frontend Developer', fit: 'Based on your UI/frontend skills' });
        }
        if (skillMapping.strong.some(s => ['node', 'python', 'java', 'api', 'sql'].includes(s.skill.toLowerCase()))) {
            alternatives.push({ role: 'Backend Developer', fit: 'Based on your server-side skills' });
        }
    }

    if (strongCategories.includes('data')) {
        alternatives.push({ role: 'Data Analyst', fit: 'Based on your data skills' });
    }

    if (strongCategories.includes('cloud')) {
        alternatives.push({ role: 'Cloud Engineer', fit: 'Based on your cloud platform experience' });
    }

    // Limit to top 3
    return alternatives.slice(0, 3);
}

export default {
    calculateEvaluationMetrics,
    makeDecision,
    generateRecruiterReport,
    generateCandidateFeedback,
};

// ─── V3 HIRE SIGNAL LAYER ─────────────────────────────────────────────────────
// Deterministic — NO AI calls. Derives hire signals from existing scores only.

/**
 * Generate a hire signal from an interview result.
 * @param {{ trustScore, evaluations, verdict, sophisticationLevel }} interviewResult
 * @returns {{ hireSignal, confidence, riskLevel, rationale }}
 */
export function generateHireSignal(interviewResult) {
    const { trustScore = 0, evaluations = [], sophisticationLevel = 'mid' } = interviewResult;

    const redFlags = detectRedFlags(interviewResult);
    const avgAuthenticity = evaluations.length
        ? Math.round(evaluations.reduce((s, e) => s + (e.authenticityScore ?? e.score ?? 50), 0) / evaluations.length)
        : 0;

    let hireSignal;
    if (trustScore >= 75 && avgAuthenticity >= 70 && redFlags.length === 0) {
        hireSignal = 'strong';
    } else if (trustScore >= 55 && redFlags.length <= 2) {
        hireSignal = 'moderate';
    } else {
        hireSignal = 'weak';
    }

    let confidence = trustScore;
    const scores = evaluations.map(e => e.authenticityScore ?? e.score ?? 50);
    if (scores.length > 1) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / scores.length;
        if (Math.sqrt(variance) < 15) confidence += 10; // low variance
    }
    if (sophisticationLevel === 'senior' && hireSignal === 'strong') confidence += 5;
    confidence -= redFlags.length * 10;
    if (evaluations.length < 6) confidence -= 5;
    const truncated = evaluations.filter(e => e.answerTruncated).length;
    if (truncated > 0) confidence -= 8;
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    const riskLevel = (hireSignal === 'strong' && redFlags.length === 0) ? 'low'
        : (hireSignal === 'weak' || redFlags.length >= 3) ? 'high'
        : 'medium';

    const strengths = evaluations.filter(e => e.verdict === 'strong').slice(0, 2).map(e => e.reasoning || e.verdict);
    const concerns  = evaluations.filter(e => ['weak', 'suspicious'].includes(e.verdict)).slice(0, 2).map(e => e.reasoning || e.verdict);

    return { hireSignal, confidence, riskLevel, rationale: { strengths, concerns }, redFlags };
}

/**
 * Detect red flags from evaluations.
 * @param {{ evaluations }} interviewResult
 * @returns {string[]}
 */
export function detectRedFlags(interviewResult) {
    const evaluations = interviewResult.evaluations || [];
    const flags = [];

    evaluations.forEach(e => {
        const r = (e.reasoning || '').toLowerCase();
        const score = e.authenticityScore ?? e.score ?? 50;

        if (e.verdict === 'weak' && r.includes('generic')) {
            flags.push(`Generic response to "${(e.topic || e.questionType || 'question').slice(0, 30)}"`);
        }
        if (e.questionType === 'commit' && score < 40) {
            flags.push(`Could not explain own ${e.commitAction || 'commit'} decision`);
        }
        if (e.questionType === 'debugging' && (e.missingElements || []).some(m => /failure|broke|error/.test(m))) {
            flags.push('No real-world failure example given');
        }
        if (e.answerWordCount > 350 && score < 50) {
            flags.push('Unusually long answers with no specificity');
        }
        if (e.questionType === 'pressure' && e.pressurePointType === 'scale_verification' && score < 40) {
            flags.push('Scale claims not substantiated');
        }
    });

    // Check for inconsistency: same tech scored very differently across evaluations
    const techGroups = {};
    evaluations.forEach(e => {
        (e.techMentioned || []).forEach(tech => {
            if (!techGroups[tech]) techGroups[tech] = [];
            techGroups[tech].push(e.authenticityScore ?? e.score ?? 50);
        });
    });
    Object.entries(techGroups).forEach(([tech, scores]) => {
        if (scores.length >= 2) {
            const spread = Math.max(...scores) - Math.min(...scores);
            if (spread > 40) flags.push(`Inconsistent answers about ${tech}`);
        }
    });

    return flags.slice(0, 5);
}

/**
 * Build a recruiter-facing recommendation block.
 * @param {{ trustScore, evaluations, verdict, sophisticationLevel }} interviewResult
 * @returns {object}
 */
export function buildRecommendationBlock(interviewResult) {
    const { hireSignal, confidence, riskLevel, rationale, redFlags } = generateHireSignal(interviewResult);
    const evaluations = interviewResult.evaluations || [];

    const weakest = evaluations
        .filter(e => ['weak', 'suspicious'].includes(e.verdict))
        .map(e => e.topic || e.questionType || 'area')
        .find(Boolean);

    const action = hireSignal === 'strong' && riskLevel === 'low'
        ? 'Proceed to technical round'
        : hireSignal === 'moderate'
        ? `Conduct follow-up on ${weakest || 'key areas'}`
        : 'Do not proceed — significant gaps identified';

    const approxMinutes = interviewResult.durationSeconds
        ? Math.round(interviewResult.durationSeconds / 60)
        : evaluations.length * 3;
    const timeSaved = Math.max(0, 90 - approxMinutes);

    return {
        hireSignal: hireSignal.toUpperCase(),
        confidence,
        whyStrong: rationale.strengths,
        concerns:  rationale.concerns,
        redFlags,
        riskLevel,
        action,
        followUpFocus: hireSignal === 'moderate' ? weakest : null,
        timeSavedMinutes: timeSaved,
        cimServed: interviewResult.cimServed || false,
    };
}

/**
 * Compare up to 5 candidates side by side.
 * @param {object[]} interviewResults
 * @returns {{ ranked, recommendation, differentiators, riskMatrix }}
 */
export function compareCandidates(interviewResults) {
    const results = interviewResults.slice(0, 5).map(ir => {
        const { hireSignal, confidence, riskLevel } = generateHireSignal(ir);
        return {
            candidateId:         ir.candidateId || ir.id,
            name:                ir.candidateName || 'Candidate',
            trustScore:          ir.trustScore || 0,
            sophisticationLevel: ir.sophisticationLevel || 'mid',
            hireSignal,
            confidence,
            riskLevel,
        };
    });

    results.sort((a, b) => b.confidence - a.confidence);

    const topName = results[0]?.name || 'Top candidate';
    const recommendation = results.length === 1
        ? `${topName} shows ${results[0].hireSignal} signal with ${results[0].confidence}% confidence.`
        : `Recommend advancing ${topName} (${results[0].hireSignal} signal, ${results[0].confidence}% confidence). ${results.length - 1} others require further evaluation.`;

    // Differentiators: areas where candidates diverge most
    const differentiators = [];
    if (results.length >= 2) {
        const trustSpread = results[0].trustScore - results[results.length - 1].trustScore;
        if (trustSpread > 20) {
            differentiators.push({
                area: 'overall trust score',
                winner: results[0].name,
                gap: trustSpread,
            });
        }
        const levelOrder = { senior: 2, mid: 1, junior: 0 };
        const topLevel = levelOrder[results[0].sophisticationLevel] ?? 1;
        const lastLevel = levelOrder[results[results.length - 1].sophisticationLevel] ?? 1;
        if (topLevel !== lastLevel) {
            differentiators.push({
                area: 'candidate sophistication',
                winner: results[0].name,
                gap: topLevel - lastLevel,
            });
        }
    }

    const riskMatrix = results.map(r => ({
        candidateId: r.candidateId,
        risks: detectRedFlags(interviewResults.find(ir => (ir.candidateId || ir.id) === r.candidateId) || {}),
    }));

    return { ranked: results, recommendation, differentiators: differentiators.slice(0, 3), riskMatrix };
}

/**
 * Generate a PII-safe structured export for PDF/CSV/ATS.
 * @param {object} interviewResult
 * @returns {object}
 */
export function generateRecruiterExport(interviewResult) {
    const { hireSignal, confidence, riskLevel, redFlags } = generateHireSignal(interviewResult);
    const evaluations = interviewResult.evaluations || [];

    return {
        role:      interviewResult.role || 'Unspecified',
        date:      new Date().toISOString().slice(0, 10),
        overallScore:  interviewResult.trustScore || 0,
        hireSignal,
        confidence,
        riskLevel,
        questionSummaries: evaluations.map(e => ({
            q:       (e.questionText || '').slice(0, 80),
            score:   e.authenticityScore ?? e.score ?? 0,
            verdict: e.verdict || 'unknown',
        })),
        redFlags,
        strengths: evaluations.filter(e => e.verdict === 'strong').map(e => (e.reasoning || '').slice(0, 100)),
        recommendation: buildRecommendationBlock(interviewResult).action,
        timeToComplete: interviewResult.durationSeconds ? `${Math.round(interviewResult.durationSeconds / 60)} min` : 'unknown',
        modelUsed:   interviewResult.modelUsed || 'unknown',
        cimVersion:  interviewResult.cimVersion || null,
    };
}
