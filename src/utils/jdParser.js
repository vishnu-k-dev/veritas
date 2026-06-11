// JD Parser Utility - Extracts structured data from job description text
import { SKILL_CATEGORIES, EXPERIENCE_LEVELS } from './constants';

/**
 * Extract structured job description data from raw text
 * @param {string} jdText - Raw job description text
 * @returns {object} - Extracted job description fields
 */
export function extractJobData(jdText) {
    const textLower = jdText.toLowerCase();

    return {
        title: extractJobTitle(jdText),
        requiredSkills: extractSkills(textLower, 'required'),
        preferredSkills: extractSkills(textLower, 'preferred'),
        experienceLevel: extractExperienceLevel(textLower),
        roleExpectations: extractRoleExpectations(jdText),
    };
}

/**
 * Extract job title from JD text
 */
function extractJobTitle(text) {
    // Common patterns for job titles
    const patterns = [
        /(?:job\s*title|position|role)\s*[:-]?\s*(.+?)(?:\n|$)/i,
        /^(.+?(?:developer|engineer|designer|manager|analyst|scientist|architect|lead|specialist|consultant|coordinator))/im,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim().substring(0, 100);
        }
    }

    // Return first significant line as fallback
    const firstLine = text.split('\n').find(line => line.trim().length > 5);
    return firstLine ? firstLine.trim().substring(0, 100) : '';
}

/**
 * Extract skills from JD text
 */
function extractSkills(textLower, type) {
    const allSkills = Object.values(SKILL_CATEGORIES).flat();
    const foundSkills = new Set();

    // Find section-based skills
    const requiredPatterns = [
        /(?:required|must\s*have|requirements|qualifications|essential)\s*[:-]?\s*([\s\S]*?)(?=preferred|nice|bonus|optional|responsibilities|about|$)/i,
        /(?:you\s*(?:will|should|must)\s*have|we\s*(?:require|need))\s*[:-]?\s*([\s\S]*?)(?=preferred|nice|bonus|$)/i,
    ];

    const preferredPatterns = [
        /(?:preferred|nice\s*to\s*have|bonus|optional|desired)\s*[:-]?\s*([\s\S]*?)(?=responsibilities|about|benefits|$)/i,
    ];

    const patterns = type === 'required' ? requiredPatterns : preferredPatterns;
    let targetSection = '';

    for (const pattern of patterns) {
        const match = textLower.match(pattern);
        if (match && match[1]) {
            targetSection += match[1] + ' ';
        }
    }

    // If no section found, search entire text for required skills
    const searchText = targetSection || textLower;

    // Find skills mentioned in the text
    allSkills.forEach(skill => {
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(searchText)) {
            foundSkills.add(skill);
        }
    });

    // Also extract skills with common patterns
    const skillPatterns = [
        /experience\s+(?:with|in|using)\s+([a-z0-9\s,+#.]+)/gi,
        /proficient\s+(?:with|in)\s+([a-z0-9\s,+#.]+)/gi,
        /knowledge\s+of\s+([a-z0-9\s,+#.]+)/gi,
        /familiar(?:ity)?\s+with\s+([a-z0-9\s,+#.]+)/gi,
    ];

    skillPatterns.forEach(pattern => {
        const matches = searchText.matchAll(pattern);
        for (const match of matches) {
            const skills = match[1].split(/[,/]/).map(s => s.trim().toLowerCase());
            skills.forEach(s => {
                if (s.length > 1 && s.length < 30) {
                    // Check if it's a known skill
                    const knownSkill = allSkills.find(ks =>
                        ks.toLowerCase() === s || s.includes(ks.toLowerCase())
                    );
                    if (knownSkill) {
                        foundSkills.add(knownSkill);
                    }
                }
            });
        }
    });

    return Array.from(foundSkills).slice(0, 10); // Limit to 10 skills
}

/**
 * Extract experience level from JD text
 */
function extractExperienceLevel(textLower) {
    // Look for year patterns
    const yearPatterns = [
        /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i,
        /(?:experience|exp)\s*[:-]?\s*(\d+)\+?\s*(?:years?|yrs?)/i,
    ];

    for (const pattern of yearPatterns) {
        const match = textLower.match(pattern);
        if (match && match[1]) {
            const years = parseInt(match[1]);

            if (years <= 2) return 'entry';
            if (years <= 4) return 'junior';
            if (years <= 6) return 'mid';
            if (years <= 10) return 'senior';
            return 'lead';
        }
    }

    // Check for level keywords
    if (textLower.includes('senior') || textLower.includes('sr.')) return 'senior';
    if (textLower.includes('lead') || textLower.includes('principal')) return 'lead';
    if (textLower.includes('junior') || textLower.includes('jr.')) return 'junior';
    if (textLower.includes('entry') || textLower.includes('graduate')) return 'entry';

    return 'mid'; // Default
}

/**
 * Extract role expectations from JD text
 */
function extractRoleExpectations(text) {
    const patterns = [
        /(?:responsibilities|what\s*you(?:'ll)?\s*do|role\s*description|about\s*the\s*role)\s*[:-]?\s*([\s\S]*?)(?=requirements|qualifications|skills|benefits|about\s*us|$)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Clean up bullet points and extra whitespace
            let expectations = match[1]
                .replace(/^[\s\u2022\-*]+/gm, '• ')
                .replace(/\n\s*\n/g, '\n')
                .trim();

            return expectations.substring(0, 500);
        }
    }

    // Fallback: return first 200 chars of the JD
    return text.substring(0, 200).trim() + '...';
}

/**
 * Validate and enhance extracted data
 */
export function validateExtractedData(data) {
    const issues = [];

    if (!data.title) {
        issues.push('Could not auto-detect job title');
    }

    if (data.requiredSkills.length === 0) {
        issues.push('No required skills detected - please add manually');
    }

    if (!data.roleExpectations) {
        issues.push('Could not extract role expectations');
    }

    return {
        data,
        issues,
        isComplete: issues.length === 0,
    };
}

export default {
    extractJobData,
    validateExtractedData,
};
