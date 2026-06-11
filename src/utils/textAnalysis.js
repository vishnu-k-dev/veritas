// Text analysis utilities for authenticity detection

/**
 * Count first-person indicators in text
 * @param {string} text - The text to analyze
 * @returns {number} - Count of first-person indicators
 */
export function countFirstPersonIndicators(text) {
    const firstPersonPatterns = /\b(I|my|me|we|our|us|myself|ourselves)\b/gi;
    const matches = text.match(firstPersonPatterns);
    return matches ? matches.length : 0;
}

/**
 * Detect STAR method components in answer
 * STAR = Situation, Task, Action, Result
 * @param {string} text - The answer to analyze
 * @returns {object} - STAR analysis with component scores
 */
export function detectSTARMethod(text) {
    const textLower = text.toLowerCase();
    let starScore = 0;
    const components = { situation: false, task: false, action: false, result: false };

    // Situation indicators
    const situationPatterns = [
        /when\s+(i|we)\s+(was|were|worked|had)/i,
        /at\s+my\s+(previous|last|former)/i,
        /on\s+(a|the)\s+project/i,
        /the\s+(context|situation|scenario|background)\s+(was|is)/i,
        /there\s+was\s+(a|an)\s+(problem|issue|challenge)/i,
        /we\s+(had|were|needed)\s+to/i,
    ];
    if (situationPatterns.some(p => p.test(textLower))) {
        components.situation = true;
        starScore += 25;
    }

    // Task indicators
    const taskPatterns = [
        /my\s+(role|responsibility|job|task)\s+(was|is)/i,
        /i\s+(was|am)\s+(responsible|tasked|assigned)/i,
        /i\s+needed\s+to/i,
        /goal\s+(was|is)\s+to/i,
        /objective\s+(was|is)/i,
    ];
    if (taskPatterns.some(p => p.test(textLower))) {
        components.task = true;
        starScore += 25;
    }

    // Action indicators
    const actionPatterns = [
        /i\s+(built|created|developed|implemented|wrote|designed|fixed|debugged)/i,
        /i\s+(decided|chose|selected|used|applied)/i,
        /my\s+approach\s+(was|is)/i,
        /i\s+(started|began)\s+by/i,
        /first,?\s+i\s+/i,
        /then\s+i\s+/i,
        /step\s+by\s+step/i,
    ];
    if (actionPatterns.some(p => p.test(textLower))) {
        components.action = true;
        starScore += 25;
    }

    // Result indicators
    const resultPatterns = [
        /result(ed)?\s+(was|in)/i,
        /(reduced|improved|increased|saved)\s+(\d+|by)/i,
        /\d+%\s*(improvement|reduction|increase|faster)/i,
        /outcome\s+(was|is)/i,
        /we\s+(achieved|delivered|shipped|launched)/i,
        /this\s+(led\s+to|resulted\s+in|caused)/i,
        /in\s+the\s+end/i,
        /finally/i,
    ];
    if (resultPatterns.some(p => p.test(textLower))) {
        components.result = true;
        starScore += 25;
    }

    return {
        score: starScore,
        components,
        isComplete: Object.values(components).filter(Boolean).length >= 3,
        componentCount: Object.values(components).filter(Boolean).length,
    };
}

/**
 * Detect metrics and quantifiable data in answer
 * @param {string} text - The answer to analyze
 * @returns {object} - Metrics analysis
 */
export function detectMetrics(text) {
    const metrics = [];

    // Percentage patterns
    const percentageMatches = text.match(/\d+(\.\d+)?%/g);
    if (percentageMatches) {
        metrics.push(...percentageMatches.map(m => ({ type: 'percentage', value: m })));
    }

    // Time measurements
    const timeMatches = text.match(/\d+\s*(ms|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?)/gi);
    if (timeMatches) {
        metrics.push(...timeMatches.map(m => ({ type: 'time', value: m })));
    }

    // User/count numbers
    const countMatches = text.match(/\d+[,\d]*\s*(users?|customers?|requests?|transactions?|records?|lines?|files?)/gi);
    if (countMatches) {
        metrics.push(...countMatches.map(m => ({ type: 'count', value: m })));
    }

    // Money/revenue
    const moneyMatches = text.match(/\$\d+[,\d]*([kKmM])?|\d+[,\d]*\s*(dollars?|revenue)/gi);
    if (moneyMatches) {
        metrics.push(...moneyMatches.map(m => ({ type: 'money', value: m })));
    }

    return {
        hasMetrics: metrics.length > 0,
        count: metrics.length,
        metrics,
        score: Math.min(metrics.length * 20, 100),
    };
}

/**
 * Calculate specificity score based on concrete details
 * @param {string} text - The text to analyze
 * @returns {number} - Specificity score (0-100)
 */
export function calculateSpecificityScore(text) {
    let score = 0;
    const textLower = text.toLowerCase();

    // STAR method bonus
    const starAnalysis = detectSTARMethod(text);
    score += starAnalysis.score * 0.4; // 40% weight for STAR

    // Metrics bonus
    const metricsAnalysis = detectMetrics(text);
    score += metricsAnalysis.score * 0.3; // 30% weight for metrics

    // Check for specific technical terms
    const technicalPatterns = [
        /error:\s*[^\s]+/i,           // error messages
        /version\s*\d+\.\d+/i,        // version numbers
        /\d+\s*(ms|seconds|minutes)/i, // time measurements
        /\d+%/i,                       // percentages
        /\b(bug|issue|ticket)\s*#?\d+/i, // issue references
        /localhost:\d+/i,              // local server ports
        /https?:\/\/[^\s]+/i,          // URLs
        /\.(js|py|java|ts|css|html)/i, // file extensions
    ];

    technicalPatterns.forEach(pattern => {
        if (pattern.test(textLower)) {
            score += 5;
        }
    });

    // Check for specific tool/library names
    const toolMentions = [
        "npm", "pip", "docker", "git", "webpack", "vite", "babel", "eslint",
        "postman", "chrome devtools", "vs code", "intellij", "terminal", "console"
    ];

    toolMentions.forEach(tool => {
        if (textLower.includes(tool)) {
            score += 4;
        }
    });

    // Longer, detailed answers get bonus
    if (text.length > 200) score += 5;
    if (text.length > 400) score += 5;

    return Math.min(Math.round(score), 100);
}

/**
 * Detect generic/textbook patterns in text
 * @param {string} text - The text to analyze
 * @returns {object} - { isGeneric: boolean, patterns: string[] }
 */
export function detectGenericPatterns(text) {
    const textLower = text.toLowerCase();
    const foundPatterns = [];

    const genericPhrases = [
        "in general",
        "typically",
        "usually",
        "best practice",
        "standard approach",
        "most developers",
        "it depends",
        "is defined as",
        "refers to",
        "allows developers",
        "is used for",
        "is a technique",
        "is a method",
        "helps in",
        "enables",
        "facilitates",
    ];

    genericPhrases.forEach(phrase => {
        if (textLower.includes(phrase)) {
            foundPatterns.push(phrase);
        }
    });

    // Check for overly polished language
    const polishedPhrases = [
        "seamlessly",
        "flawlessly",
        "perfectly",
        "without any issues",
        "worked as expected",
        "no problems",
        "everything went smoothly",
    ];

    polishedPhrases.forEach(phrase => {
        if (textLower.includes(phrase)) {
            foundPatterns.push(phrase);
        }
    });

    return {
        isGeneric: foundPatterns.length >= 2,
        patterns: foundPatterns,
        genericScore: Math.min(foundPatterns.length * 15, 100),
    };
}

/**
 * Check for imperfect/realistic narrative
 * @param {string} text - The text to analyze
 * @returns {number} - Imperfection score (0-100)
 */
export function calculateImperfectionScore(text) {
    const textLower = text.toLowerCase();
    let score = 0;

    // Positive indicators - admits mistakes, confusion, learning
    const positiveIndicators = [
        "mistake",
        "error",
        "wrong",
        "confused",
        "struggle",
        "difficult",
        "challenge",
        "learned",
        "realized",
        "should have",
        "could have",
        "in hindsight",
        "looking back",
        "at first",
        "initially",
        "didn't know",
        "wasn't aware",
        "took time",
        "failed",
        "broke",
        "crashed",
    ];

    positiveIndicators.forEach(indicator => {
        if (textLower.includes(indicator)) {
            score += 12;
        }
    });

    return Math.min(score, 100);
}

/**
 * Calculate overall authenticity score
 * @param {string} text - The text to analyze
 * @returns {object} - Detailed authenticity analysis
 */
export function calculateAuthenticityScore(text) {
    const firstPersonCount = countFirstPersonIndicators(text);
    const specificityScore = calculateSpecificityScore(text);
    const { isGeneric, patterns, genericScore } = detectGenericPatterns(text);
    const imperfectionScore = calculateImperfectionScore(text);

    // Calculate individual component scores
    const personalContextScore = Math.min(firstPersonCount * 10, 100);
    const naturalLanguageScore = 100 - genericScore;

    // Weighted average
    const weights = {
        personalContext: 0.25,
        specificDetails: 0.25,
        imperfectNarrative: 0.20,
        naturalLanguage: 0.20,
        depthConsistency: 0.10, // This would need multiple answers to calculate
    };

    const overallScore = Math.round(
        personalContextScore * weights.personalContext +
        specificityScore * weights.specificDetails +
        imperfectionScore * weights.imperfectNarrative +
        naturalLanguageScore * weights.naturalLanguage +
        50 * weights.depthConsistency // Default to neutral
    );

    return {
        overall: Math.min(Math.max(overallScore, 0), 100),
        breakdown: {
            personalContext: personalContextScore,
            specificDetails: specificityScore,
            imperfectNarrative: imperfectionScore,
            naturalLanguage: naturalLanguageScore,
        },
        flags: {
            isGeneric,
            genericPatterns: patterns,
            firstPersonCount,
            textLength: text.length,
        },
    };
}

/**
 * Analyze multiple answers for consistency
 * @param {string[]} answers - Array of answer texts
 * @returns {number} - Consistency score (0-100)
 */
export function analyzeConsistency(answers) {
    if (answers.length < 2) return 50;

    // Calculate average detail level
    const detailLevels = answers.map(a => calculateSpecificityScore(a));
    const avgDetail = detailLevels.reduce((a, b) => a + b, 0) / detailLevels.length;

    // Calculate variance
    const variance = detailLevels.reduce((sum, level) => {
        return sum + Math.pow(level - avgDetail, 2);
    }, 0) / detailLevels.length;

    // Lower variance = higher consistency
    const consistencyScore = 100 - Math.min(Math.sqrt(variance) * 2, 50);

    return Math.round(consistencyScore);
}

/**
 * Extract key topics from text
 * @param {string} text - The text to analyze
 * @returns {string[]} - Array of extracted topics
 */
export function extractTopics(text) {
    const textLower = text.toLowerCase();
    const topics = [];

    // Common technologies and concepts
    const techKeywords = [
        "api", "database", "frontend", "backend", "server", "client",
        "authentication", "authorization", "testing", "deployment",
        "debugging", "optimization", "refactoring", "architecture",
        "performance", "security", "scalability", "cache", "queue",
    ];

    techKeywords.forEach(keyword => {
        if (textLower.includes(keyword)) {
            topics.push(keyword);
        }
    });

    return [...new Set(topics)];
}
