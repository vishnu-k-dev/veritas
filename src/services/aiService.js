/**
 * AI Service — Proxies all AI calls through the server
 * API key stays server-side (never exposed to client)
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Check if AI is available (server-side)
 */
let _aiAvailable = null;

export async function checkAIStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/ai/status`);
        const data = await res.json();
        _aiAvailable = data.available;
        return data.available;
    } catch {
        _aiAvailable = false;
        return false;
    }
}

export function isAIAvailable() {
    // Optimistic: assume available until first check completes
    if (_aiAvailable === null) {
        checkAIStatus(); // fire and forget
        return true; // optimistic
    }
    return _aiAvailable;
}

/**
 * Parse resume with AI to extract structured data
 */
export async function parseResumeWithAI(resumeText, jobDescription) {
    try {
        const res = await fetch(`${API_BASE}/api/ai/parse-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText, jobDescription }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('AI resume parse failed:', err.error);
            return null;
        }

        return await res.json();
    } catch (error) {
        console.error('AI Resume parsing error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate AI-powered interview report
 */
export async function generateAIReport(interviewData, resumeData, jobDescription) {
    try {
        const res = await fetch(`${API_BASE}/api/ai/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interviewData, resumeData, jobDescription }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('AI report gen failed:', err.error);
            return null;
        }

        return await res.json();
    } catch (error) {
        console.error('AI Report generation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate contextual follow-up question using AI
 */
export async function generateAIFollowUp(originalQuestion, answer, skill) {
    try {
        const res = await fetch(`${API_BASE}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: `You're conducting a technical interview. The candidate gave a vague answer.

Question: ${originalQuestion}
Answer: ${answer.slice(0, 500)}
Skill being tested: ${skill}

Generate ONE short, specific follow-up question that:
1. References something specific from their answer
2. Asks for measurable results or concrete examples
3. Cannot be answered with generic knowledge

Return ONLY the question text, no quotes or explanation.`,
                options: { temperature: 0.7, maxTokens: 100 },
            }),
        });

        if (!res.ok) return null;

        const result = await res.json();
        return result.data?.trim().replace(/^["']|["']$/g, '') || null;
    } catch (error) {
        console.error('AI Follow-up generation error:', error);
        return null;
    }
}

/**
 * Generate repo-specific interview questions using AI (VERITAS 2.0)
 */
export async function generateRepoQuestions(questionPrompt) {
    const maxAttempts = 2;

    const baseSystemPrompt = `You are a senior engineer conducting a code-review-style interview about a specific GitHub repository.

STRICT RULES:
1. Generate ONLY questions that reference actual file names, function names, class names, frameworks, dependencies, or commit messages from the provided project context.
2. Each question MUST be answerable only by someone who actually wrote/read this specific code. A generic developer should NOT be able to answer.
3. NEVER ask generic questions about: OOP principles, SOLID, design patterns, clean code, testing philosophy, "walk me through your approach", "what would you do differently", tradeoffs between technologies in general.
4. Prefer questions that quote or reference a specific identifier (file path, function name, variable name, dependency) from the context.
5. Vary the files/functions referenced across questions — do not keep asking about the same file.
6. COMMIT-AWARE: When COMMIT-DERIVED QUESTION SEEDS appear in the prompt, **exactly ONE** question (no more, no fewer) should reference a specific commit. Pick the single most technically meaningful commit from the seeds — one that reveals a real engineering decision, bug fix, or refactor. The remaining questions MUST reference files, functions, dependencies, or architecture — NOT commits.
7. DOMAIN-AWARE: When DOMAIN-SPECIFIC PROBING appears in the prompt, at least 1 question MUST target one of the listed engineering decisions (not a generic version of it).
8. RAG-GROUNDED: When RETRIEVAL CONTEXT appears in the prompt, at least 2 questions MUST directly reference specific items from that context (personalized to this project, not copied verbatim).
9. PRESSURE LAST: The final question MUST be the truth-check from the PRESSURE QUESTION instruction — do not reorder it.
10. QUALITY GATE: Every question must fail the "random developer" test — someone who hasn't read this specific repo should NOT be able to answer it.
11. CALIBRATION: Question depth MUST match the CANDIDATE SOPHISTICATION LEVEL in the prompt — do not ask junior questions to senior candidates or vice versa.
12. CIM-READY: Questions must be specific enough to train a model from — no questions answerable from a Google search about the technology.

FORBIDDEN PATTERNS (do NOT generate questions like these):
- "What is the difference between X and Y?" (generic comparison)
- "Why did you choose framework X?" (unless tied to a specific file/decision)
- "How do you ensure code quality?"
- "Walk me through your thought process"
- "What are the tradeoffs of...?"
- Any question that could be asked about any project.`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const retrySuffix = attempt > 0
                ? '\n\nPREVIOUS ATTEMPT PRODUCED SIMILAR/DUPLICATE QUESTIONS. Pivot to completely different files, functions, or dependencies this time. Do not repeat topics from the previous attempt.'
                : '';

            const res = await fetch(`${API_BASE}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: questionPrompt + retrySuffix,
                    options: {
                        temperature: 0.9,
                        maxTokens: 2000,
                        systemPrompt: baseSystemPrompt,
                    },
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const result = await res.json();
            const text = result.data || '';

            let jsonStr = text;
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            const parsed = JSON.parse(jsonStr.trim());
            const questions = Array.isArray(parsed) ? parsed : [];

            // Check for duplicates — if found, retry
            if (questions.length >= 2 && attempt < maxAttempts - 1) {
                const hasDupes = checkForDuplicates(questions);
                if (hasDupes) {
                    console.warn('Duplicate questions detected from LLM, retrying...');
                    continue;
                }
            }

            return { success: true, data: questions, source: 'openai' };
        } catch (error) {
            console.error(`AI Repo question generation error (attempt ${attempt + 1}):`, error);
            if (attempt === maxAttempts - 1) {
                return { success: false, error: error.message, source: 'openai' };
            }
        }
    }
}

/**
 * Check if question array contains duplicates (Jaccard similarity > 0.4)
 */
function checkForDuplicates(questions) {
    const getWords = (text) => new Set((text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3));

    for (let i = 0; i < questions.length; i++) {
        for (let j = i + 1; j < questions.length; j++) {
            const wordsA = getWords(questions[i].text);
            const wordsB = getWords(questions[j].text);
            const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
            const union = new Set([...wordsA, ...wordsB]).size;
            if (union > 0 && intersection / union > 0.55) return true;
        }
    }
    return false;
}

/**
 * Generate AI-personalised resume interview questions.
 * Replaces the deterministic QuestionGenerator so every student gets unique
 * questions based on their actual resume content and role.
 *
 * Returns an array of question objects: [{ text, skill, type, difficulty }]
 * Falls back to null on failure so the caller can use the template generator.
 */
export async function generateAIResumeQuestions(resumeText, jobDescription) {
    try {
        const role = jobDescription?.title || 'Software Engineer';
        const skills = (jobDescription?.requiredSkills || []).slice(0, 6).join(', ') || 'general software skills';
        const resumeSnippet = (resumeText || '').slice(0, 1500);

        const prompt = `You are VERITAS, an AI technical interviewer for a ${role} screening.

Resume (first 1500 chars):
${resumeSnippet}

Required skills: ${skills}

Generate exactly 4 interview questions. Rules:
1. Each question MUST reference something specific from THIS resume — a project name, a technology, a company, a timeframe, or a specific claim made.
2. Never ask generic "tell me about yourself" or "what is X?" questions.
3. Ask about decisions, tradeoffs, problems solved, or measurable outcomes.
4. Questions must be unanswerable by someone who didn't write this resume.

Return ONLY a JSON array, no markdown:
[
  { "text": "<question>", "skill": "<skill being tested>", "type": "technical", "difficulty": "medium" },
  { "text": "<question>", "skill": "<skill>", "type": "behavioral", "difficulty": "medium" },
  { "text": "<question>", "skill": "<skill>", "type": "technical", "difficulty": "hard" },
  { "text": "<question>", "skill": "<skill>", "type": "situational", "difficulty": "hard" }
]`;

        const res = await fetch(`${API_BASE}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                options: {
                    systemPrompt: 'You are a senior technical interviewer. Return only valid JSON. No markdown.',
                    maxTokens: 800,
                    temperature: 0.8,
                },
            }),
        });

        if (!res.ok) return null;
        const result = await res.json();
        if (!result.success || !result.data) return null;

        const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        return parsed;
    } catch (err) {
        console.warn('[AI] Resume question gen failed, falling back to templates:', err.message);
        return null;
    }
}

export default {
    isAIAvailable,
    parseResumeWithAI,
    generateAIReport,
    generateAIFollowUp,
    generateRepoQuestions,
    generateAIResumeQuestions,
};

