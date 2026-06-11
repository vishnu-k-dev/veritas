// Skill Mapper Engine - Maps resume content to job requirements
import { SKILL_CATEGORIES, SKILL_ALIASES } from '../utils/constants';
import { parseResumeIntoSections, extractSkillsWithContext, getExperienceSummary } from '../utils/resumeParser';

/**
 * Normalize a skill name by finding its canonical form
 * @param {string} skill - The skill to normalize
 * @returns {string} - The canonical skill name
 */
function normalizeSkill(skill) {
    const skillLower = skill.toLowerCase().trim();

    // Check if this skill is already canonical
    if (SKILL_ALIASES[skillLower]) {
        return skillLower;
    }

    // Check if this skill is an alias
    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        if (aliases.includes(skillLower)) {
            return canonical;
        }
    }

    return skillLower;
}

/**
 * Check if a skill matches (exact or via alias)
 * @param {string} skill1 - First skill
 * @param {string} skill2 - Second skill
 * @returns {boolean} - Whether they match
 */
function _skillsMatch(skill1, skill2) {
    const s1 = skill1.toLowerCase().trim();
    const s2 = skill2.toLowerCase().trim();

    // Direct match
    if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) {
        return true;
    }

    // Normalize both and compare
    const n1 = normalizeSkill(s1);
    const n2 = normalizeSkill(s2);

    if (n1 === n2) {
        return true;
    }

    // Check if either is an alias of the other's canonical form
    const aliases1 = SKILL_ALIASES[n1] || [];
    const aliases2 = SKILL_ALIASES[n2] || [];

    if (aliases1.includes(s2) || aliases2.includes(s1)) {
        return true;
    }

    return false;
}

/**
 * Extract skills from resume text with section awareness
 * @param {string} resumeText - The resume text to parse
 * @returns {object[]} - Array of extracted skills with context
 */
export function extractSkillsFromResume(resumeText) {
    // Parse resume into sections first
    const parsedResume = parseResumeIntoSections(resumeText);

    // Get all skills to look for
    const allSkillNames = Object.values(SKILL_CATEGORIES).flat();

    // Also add aliases
    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        allSkillNames.push(canonical, ...aliases);
    }

    // Extract skills using section-aware parser
    const sectionAwareSkills = extractSkillsWithContext(parsedResume, [...new Set(allSkillNames)]);

    // Get overall experience summary
    const experienceSummary = getExperienceSummary(parsedResume);

    // Transform to expected format and add category info
    const extractedSkills = sectionAwareSkills.map(skill => {
        // Find category for this skill
        let category = 'tools';
        const normalizedSkill = normalizeSkill(skill.skill);
        for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
            if (skills.some(s => s.toLowerCase() === normalizedSkill || s.toLowerCase() === skill.skill.toLowerCase())) {
                category = cat;
                break;
            }
        }

        return {
            skill: normalizedSkill,
            originalMatch: skill.skill,
            category,
            mentions: skill.mentions,
            context: skill.context,
            evidence: skill.context.slice(0, 100) + (skill.context.length > 100 ? '...' : ''),
            section: skill.section,
            years: skill.years,
            level: skill.level,
            weight: skill.weight,
        };
    });

    // Attach experience summary to the result
    extractedSkills.experienceSummary = experienceSummary;

    return extractedSkills;
}

/**
 * Find context around a skill mention in text
 */
function findSkillContext(text, skill) {
    const regex = new RegExp(`[^.]*\\b${skill}\\b[^.]*\\.`, 'gi');
    const matches = text.match(regex);
    return matches ? matches[0].trim() : '';
}

/**
 * Parse job description to extract requirements
 * @param {object} jobDescription - The job description object
 * @returns {object} - Parsed requirements
 */
export function parseJobRequirements(jobDescription) {
    const { requiredSkills, preferredSkills, experienceLevel, roleExpectations } = jobDescription;

    return {
        mustHave: requiredSkills.map(skill => ({
            skill: skill.toLowerCase(),
            importance: 'required',
            weight: 1.0,
        })),
        niceToHave: preferredSkills.map(skill => ({
            skill: skill.toLowerCase(),
            importance: 'preferred',
            weight: 0.5,
        })),
        experienceLevel,
        expectations: roleExpectations,
    };
}

/**
 * Map resume skills to job requirements
 * @param {string} resumeText - The resume text
 * @param {object} jobDescription - The job description
 * @returns {object} - Skill mapping analysis
 */
export function mapSkillsToRequirements(resumeText, jobDescription) {
    const resumeSkills = extractSkillsFromResume(resumeText);
    const requirements = parseJobRequirements(jobDescription);

    const skillMapping = {
        strong: [],
        weak: [],
        missing: [],
        extra: [],
    };

    // Check required skills
    requirements.mustHave.forEach(req => {
        const match = resumeSkills.find(s =>
            s.skill.toLowerCase() === req.skill.toLowerCase() ||
            s.skill.toLowerCase().includes(req.skill.toLowerCase()) ||
            req.skill.toLowerCase().includes(s.skill.toLowerCase())
        );

        if (match) {
            const confidence = calculateSkillConfidence(match);
            if (confidence >= 70) {
                skillMapping.strong.push({
                    ...req,
                    evidence: match.evidence,
                    confidence,
                    mentions: match.mentions,
                });
            } else {
                skillMapping.weak.push({
                    ...req,
                    evidence: match.evidence,
                    confidence,
                    mentions: match.mentions,
                });
            }
        } else {
            skillMapping.missing.push(req);
        }
    });

    // Check preferred skills
    requirements.niceToHave.forEach(req => {
        const match = resumeSkills.find(s =>
            s.skill.toLowerCase() === req.skill.toLowerCase() ||
            s.skill.toLowerCase().includes(req.skill.toLowerCase())
        );

        if (match) {
            const confidence = calculateSkillConfidence(match);
            if (confidence >= 60) {
                skillMapping.strong.push({
                    ...req,
                    evidence: match.evidence,
                    confidence,
                });
            } else {
                skillMapping.weak.push({
                    ...req,
                    evidence: match.evidence,
                    confidence,
                });
            }
        }
    });

    // Find extra skills not in requirements
    resumeSkills.forEach(skill => {
        const isRequired = requirements.mustHave.some(r =>
            r.skill.toLowerCase() === skill.skill.toLowerCase()
        );
        const isPreferred = requirements.niceToHave.some(r =>
            r.skill.toLowerCase() === skill.skill.toLowerCase()
        );

        if (!isRequired && !isPreferred) {
            skillMapping.extra.push({
                skill: skill.skill,
                category: skill.category,
                confidence: calculateSkillConfidence(skill),
            });
        }
    });

    // Calculate overall match score
    const totalRequired = requirements.mustHave.length;
    const matchedRequired = skillMapping.strong.filter(s => s.importance === 'required').length +
        skillMapping.weak.filter(s => s.importance === 'required').length * 0.5;

    const skillMatchScore = totalRequired > 0
        ? Math.round((matchedRequired / totalRequired) * 100)
        : 50;

    return {
        ...skillMapping,
        skillMatchScore,
        totalRequired,
        totalPreferred: requirements.niceToHave.length,
        requirements,
    };
}

/**
 * Calculate confidence level for a skill based on evidence
 */
function calculateSkillConfidence(skill) {
    let confidence = 50; // Base confidence

    // More mentions = higher confidence
    confidence += Math.min(skill.mentions * 10, 25);

    // Longer context = higher confidence
    if (skill.context) {
        if (skill.context.length > 50) confidence += 10;
        if (skill.context.length > 100) confidence += 10;
    }

    // Check for experience indicators in context
    const contextLower = (skill.context || '').toLowerCase();
    if (contextLower.includes('built') || contextLower.includes('developed')) confidence += 5;
    if (contextLower.includes('led') || contextLower.includes('managed')) confidence += 5;
    if (contextLower.includes('years') || contextLower.includes('experience')) confidence += 5;

    return Math.min(confidence, 100);
}

/**
 * Identify skills to focus on during interview
 * @param {object} skillMapping - The skill mapping result
 * @returns {object[]} - Priority list of skills to test
 */
export function identifyFocusSkills(skillMapping) {
    const focusSkills = [];

    // Required skills with low confidence need testing
    skillMapping.weak
        .filter(s => s.importance === 'required')
        .forEach(s => {
            focusSkills.push({
                skill: s.skill,
                priority: 'high',
                reason: 'Required skill with low confidence - needs verification',
            });
        });

    // Missing required skills need to be addressed
    skillMapping.missing.forEach(s => {
        focusSkills.push({
            skill: s.skill,
            priority: 'high',
            reason: 'Required skill not found in resume - needs discussion',
        });
    });

    // Strong skills should be validated
    skillMapping.strong
        .filter(s => s.importance === 'required')
        .slice(0, 3)
        .forEach(s => {
            focusSkills.push({
                skill: s.skill,
                priority: 'medium',
                reason: 'Key skill to validate depth of experience',
            });
        });

    return focusSkills;
}

export default {
    extractSkillsFromResume,
    parseJobRequirements,
    mapSkillsToRequirements,
    identifyFocusSkills,
};
