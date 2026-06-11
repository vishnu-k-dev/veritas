// Resume Parser Utility - Structured parsing of resume content
// Extracts sections, skills with context, and experience levels

/**
 * Common section headers found in resumes
 */
const SECTION_PATTERNS = {
    experience: /^(work\s*experience|experience|employment(\s*history)?|professional\s*experience|career\s*history)/i,
    education: /^(education|academic(\s*background)?|qualifications|degrees?)/i,
    skills: /^(skills|technical\s*skills|core\s*competencies|technologies|tech\s*stack|expertise)/i,
    projects: /^(projects|personal\s*projects|portfolio|key\s*projects|notable\s*projects)/i,
    summary: /^(summary|profile|objective|about(\s*me)?|professional\s*summary)/i,
    certifications: /^(certifications?|licenses?|credentials|courses)/i,
};

/**
 * Parse resume text into structured sections
 * @param {string} resumeText - Raw resume text
 * @returns {object} - Structured resume with sections
 */
export function parseResumeIntoSections(resumeText) {
    const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const sections = {
        summary: [],
        experience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
        other: [],
    };

    let currentSection = 'other';
    let lineBuffer = [];

    for (const line of lines) {
        // Check if this line is a section header
        let foundSection = null;
        for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
            if (pattern.test(line) && line.length < 50) {
                foundSection = sectionName;
                break;
            }
        }

        if (foundSection) {
            // Save previous section content
            if (lineBuffer.length > 0) {
                sections[currentSection].push(...lineBuffer);
            }
            currentSection = foundSection;
            lineBuffer = [];
        } else {
            lineBuffer.push(line);
        }
    }

    // Don't forget the last section
    if (lineBuffer.length > 0) {
        sections[currentSection].push(...lineBuffer);
    }

    return {
        sections,
        raw: resumeText,
        hasSections: Object.values(sections).some(s => s.length > 0 && s !== sections.other),
    };
}

/**
 * Experience level patterns for detection
 */
const EXPERIENCE_PATTERNS = {
    years: /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience)?/gi,
    seniorityKeywords: {
        senior: /\b(senior|sr\.?|lead|principal|staff|architect)\b/gi,
        mid: /\b(mid[- ]?level|intermediate|developer|engineer)\b/gi,
        junior: /\b(junior|jr\.?|entry[- ]?level|associate|intern|trainee|fresher)\b/gi,
    },
};

/**
 * Extract experience level from text
 * @param {string} text - Text to analyze
 * @returns {object} - Experience level info
 */
export function extractExperienceLevel(text) {
    const result = {
        years: null,
        level: 'unknown',
        indicators: [],
    };

    // Find years of experience
    const yearsMatches = [...text.matchAll(EXPERIENCE_PATTERNS.years)];
    if (yearsMatches.length > 0) {
        // Get the highest mentioned years
        const years = yearsMatches.map(m => parseInt(m[1])).filter(y => !isNaN(y));
        if (years.length > 0) {
            result.years = Math.max(...years);
            result.indicators.push(`${result.years} years mentioned`);
        }
    }

    // Check for seniority keywords
    for (const [level, pattern] of Object.entries(EXPERIENCE_PATTERNS.seniorityKeywords)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            result.indicators.push(`${level} keywords found: ${matches.slice(0, 2).join(', ')}`);
            if (result.level === 'unknown') {
                result.level = level;
            }
        }
    }

    // Infer level from years if not already set
    if (result.level === 'unknown' && result.years !== null) {
        if (result.years >= 8) result.level = 'senior';
        else if (result.years >= 4) result.level = 'mid';
        else if (result.years >= 1) result.level = 'junior';
        else result.level = 'entry';
    }

    return result;
}

/**
 * Extract skills with their context and section origin
 * @param {object} parsedResume - Resume parsed into sections
 * @param {string[]} skillsList - List of skills to look for
 * @returns {object[]} - Skills with context
 */
export function extractSkillsWithContext(parsedResume, skillsList) {
    const skillsFound = [];
    const skillsSet = new Set();

    // Check each section
    for (const [sectionName, lines] of Object.entries(parsedResume.sections)) {
        const sectionText = lines.join(' ');

        for (const skill of skillsList) {
            if (skillsSet.has(skill.toLowerCase())) continue;

            const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = sectionText.match(regex);

            if (matches) {
                skillsSet.add(skill.toLowerCase());

                // Find the sentence containing the skill
                const context = findContextSentence(sectionText, skill);
                const experienceInfo = extractExperienceLevel(context);

                skillsFound.push({
                    skill: skill,
                    section: sectionName,
                    mentions: matches.length,
                    context: context,
                    years: experienceInfo.years,
                    level: experienceInfo.level,
                    weight: getSectionWeight(sectionName),
                });
            }
        }
    }

    // Sort by weight (skills in Experience section are more valuable)
    return skillsFound.sort((a, b) => b.weight - a.weight);
}

/**
 * Find the sentence containing a skill
 */
function findContextSentence(text, skill) {
    const regex = new RegExp(`[^.]*\\b${skill}\\b[^.]*\\.?`, 'gi');
    const match = text.match(regex);
    if (match && match[0]) {
        return match[0].trim().slice(0, 200);
    }
    return '';
}

/**
 * Get weight multiplier for section (experience > projects > skills > other)
 */
function getSectionWeight(sectionName) {
    const weights = {
        experience: 1.5,
        projects: 1.3,
        skills: 1.0,
        summary: 0.9,
        education: 0.7,
        certifications: 0.8,
        other: 0.5,
    };
    return weights[sectionName] || 0.5;
}

/**
 * Get overall candidate experience summary
 * @param {object} parsedResume - Parsed resume
 * @returns {object} - Experience summary
 */
export function getExperienceSummary(parsedResume) {
    // Check experience section first
    const experienceText = parsedResume.sections.experience.join(' ');
    const summaryText = parsedResume.sections.summary.join(' ');

    const fromExperience = extractExperienceLevel(experienceText);
    const fromSummary = extractExperienceLevel(summaryText);

    // Prefer years from summary (often more accurate), level from experience
    return {
        years: fromSummary.years || fromExperience.years,
        level: fromExperience.level !== 'unknown' ? fromExperience.level : fromSummary.level,
        indicators: [...fromExperience.indicators, ...fromSummary.indicators],
    };
}

/**
 * Extract dynamic skills not in hardcoded list
 * Detects potential skills using patterns and context
 * @param {object} parsedResume - Parsed resume
 * @param {Set} knownSkills - Already found skills to exclude
 * @returns {object[]} - Dynamically detected skills
 */
export function extractDynamicSkills(parsedResume, knownSkills = new Set()) {
    const dynamicSkills = [];
    const foundSkills = new Set(knownSkills);

    // Combine skills and projects sections (most likely to have unlisted technologies)
    const skillsText = parsedResume.sections.skills.join(' ');
    const projectsText = parsedResume.sections.projects.join(' ');
    const combinedText = skillsText + ' ' + projectsText;

    // Pattern 1: CamelCase or PascalCase words (common for technologies)
    // e.g., GraphQL, TailwindCSS, FastAPI
    const camelCasePattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]{2,}[a-z]+)\b/g;
    const camelMatches = combinedText.match(camelCasePattern) || [];

    for (const match of camelMatches) {
        const lower = match.toLowerCase();
        if (!foundSkills.has(lower) && match.length >= 3 && match.length <= 20) {
            foundSkills.add(lower);
            dynamicSkills.push({
                skill: match,
                section: 'dynamic',
                mentions: 1,
                context: findContextSentence(combinedText, match),
                detectionMethod: 'camelCase',
                weight: 0.8,
            });
        }
    }

    // Pattern 2: Words ending in common tech suffixes
    // e.g., Kubernetes, TensorFlow, GraphDB
    const techSuffixes = /\b(\w+(?:JS|DB|SQL|API|ML|AI|UI|UX|CI|CD|IO|OS))\b/gi;
    const suffixMatches = combinedText.match(techSuffixes) || [];

    for (const match of suffixMatches) {
        const lower = match.toLowerCase();
        if (!foundSkills.has(lower) && match.length >= 3) {
            foundSkills.add(lower);
            dynamicSkills.push({
                skill: match,
                section: 'dynamic',
                mentions: 1,
                context: findContextSentence(combinedText, match),
                detectionMethod: 'techSuffix',
                weight: 0.7,
            });
        }
    }

    // Pattern 3: Comma-separated lists in skills section (often technologies)
    const listPatterns = /(?:[:,]\s*)([A-Z][a-zA-Z0-9.]+)(?:\s*[,|])/g;
    const listMatches = [...skillsText.matchAll(listPatterns)];

    for (const match of listMatches) {
        if (match[1]) {
            const skill = match[1].trim();
            const lower = skill.toLowerCase();
            if (!foundSkills.has(lower) && skill.length >= 2 && skill.length <= 25) {
                foundSkills.add(lower);
                dynamicSkills.push({
                    skill: skill,
                    section: 'skills',
                    mentions: 1,
                    context: '',
                    detectionMethod: 'commaSeparated',
                    weight: 0.6,
                });
            }
        }
    }

    // Pattern 4: Versioned technologies (e.g., Python 3.9, Node 18, ES2020)
    const versionedPattern = /\b([A-Z][a-zA-Z]+)\s*(?:v\.?)?(\d+(?:\.\d+)*)\b/gi;
    const versionMatches = [...combinedText.matchAll(versionedPattern)];

    for (const match of versionMatches) {
        if (match[1]) {
            const skill = match[1].trim();
            const lower = skill.toLowerCase();
            if (!foundSkills.has(lower) && skill.length >= 2) {
                foundSkills.add(lower);
                dynamicSkills.push({
                    skill: skill,
                    section: 'dynamic',
                    mentions: 1,
                    context: match[0],
                    detectionMethod: 'versioned',
                    version: match[2],
                    weight: 0.9,
                });
            }
        }
    }

    return dynamicSkills;
}

export default {
    parseResumeIntoSections,
    extractExperienceLevel,
    extractSkillsWithContext,
    getExperienceSummary,
    extractDynamicSkills,
};
