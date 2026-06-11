/**
 * RepoContextBuilder — Builds structured JSON context from parsed repo data
 * This is the single artifact that bridges repo parsing → question generation
 * Designed to be compact enough for a single LLM call
 */

/**
 * Build the structured context for LLM question generation
 * @param {object} parsedRepo — Output from RepoParser.parseRepository()
 * @returns {object} — Compact, structured context ready for LLM prompt
 */
export function buildRepoContext(parsedRepo) {
    return {
        projectName: parsedRepo.projectName,
        projectDescription: parsedRepo.description || parsedRepo.readmeAnalysis.summary || 'No description',
        repoUrl: parsedRepo.htmlUrl,

        // Tech stack summary
        techStack: {
            primaryLanguage: parsedRepo.metadata.language,
            languages: parsedRepo.techStack.primaryLanguages.map(l => `${l.name} (${l.percentage}%)`),
            frameworks: parsedRepo.techStack.detected.map(t => ({
                name: t.name,
                category: t.category,
                version: t.version,
            })),
            totalDependencies: parsedRepo.techStack.allDependencies.length,
            keyDependencies: parsedRepo.techStack.allDependencies.slice(0, 20),
        },

        // Architecture summary
        architecture: {
            pattern: parsedRepo.architecture.pattern,
            layers: parsedRepo.architecture.layers,
            topDirectories: parsedRepo.architecture.topDirs || [],
            totalFiles: parsedRepo.architecture.totalFiles,
            keyConfigFiles: parsedRepo.architecture.keyFiles,
            // Keep the raw file tree for CodeScope to pick files from
            fileTree: parsedRepo._rawTree || [],
        },

        // Commit history
        developmentHistory: {
            commitPattern: parsedRepo.commitAnalysis.pattern,
            totalCommitsAnalyzed: parsedRepo.commitAnalysis.commitCount,
            commitBreakdown: parsedRepo.commitAnalysis.categories || {},
            keyCommits: (parsedRepo.commitAnalysis.keyCommits || []).map(c => ({
                message: c.shortMessage,
                category: c.category,
                sha: c.sha || '',
            })),
            authors: parsedRepo.commitAnalysis.authors || [],
            // Keep raw commits for gist display
            rawCommits: parsedRepo._rawCommits || [],
        },

        // README insights
        documentation: {
            hasDocs: !!parsedRepo.readmeAnalysis.summary,
            summary: parsedRepo.readmeAnalysis.summary,
            sections: parsedRepo.readmeAnalysis.sections,
            hasSetupGuide: parsedRepo.readmeAnalysis.hasSetup,
            hasTechStackSection: parsedRepo.readmeAnalysis.hasTechStack,
        },

        // Project metadata
        projectMeta: {
            stars: parsedRepo.metadata.stars,
            forks: parsedRepo.metadata.forks,
            license: parsedRepo.metadata.license,
            size: parsedRepo.metadata.size,
            defaultBranch: parsedRepo.metadata.defaultBranch || 'main',
        },
    };
}

/**
 * Build a compact text summary for display in the interview sidebar
 */
export function buildRepoSummary(repoContext) {
    const { techStack, architecture, developmentHistory } = repoContext;

    const frameworkList = techStack.frameworks.map(f => f.name).join(', ') || 'None detected';
    const langList = techStack.languages.join(', ') || techStack.primaryLanguage;

    return {
        title: repoContext.projectName,
        description: repoContext.projectDescription,
        url: repoContext.repoUrl,
        languages: langList,
        frameworks: frameworkList,
        architecture: architecture.pattern,
        layers: architecture.layers,
        totalFiles: architecture.totalFiles,
        commits: developmentHistory.totalCommitsAnalyzed,
        commitPattern: developmentHistory.commitPattern,
        authors: developmentHistory.authors,
        stars: repoContext.projectMeta.stars,
    };
}

/**
 * Build the LLM prompt context string (for embedding in the question generation prompt)
 * Includes specific file paths, dependency names, and commit messages for maximum specificity
 */
export function buildPromptContext(repoContext) {
    const parts = [];

    parts.push(`PROJECT: ${repoContext.projectName}`);
    parts.push(`DESCRIPTION: ${repoContext.projectDescription}`);
    parts.push('');

    // Tech Stack — with specific dependency names
    parts.push('TECH STACK:');
    parts.push(`  Primary Language: ${repoContext.techStack.primaryLanguage}`);
    parts.push(`  Languages: ${repoContext.techStack.languages.join(', ')}`);
    if (repoContext.techStack.frameworks.length > 0) {
        parts.push(`  Frameworks/Libraries: ${repoContext.techStack.frameworks.map(f => `${f.name}${f.version ? ' ' + f.version : ''} (${f.category})`).join(', ')}`);
    }
    parts.push(`  All Dependencies: ${repoContext.techStack.keyDependencies.slice(0, 25).join(', ')}`);
    parts.push(`  Total Dependencies: ${repoContext.techStack.totalDependencies}`);
    parts.push('');

    // Architecture — with specific file/directory names
    parts.push('ARCHITECTURE:');
    parts.push(`  Pattern: ${repoContext.architecture.pattern}`);
    parts.push(`  Layers: ${repoContext.architecture.layers.join(', ')}`);
    parts.push(`  Top-Level Directories: ${repoContext.architecture.topDirectories.join(', ')}`);
    parts.push(`  Total Files: ${repoContext.architecture.totalFiles}`);
    if (repoContext.architecture.keyConfigFiles.length > 0) {
        parts.push(`  Config Files Found: ${repoContext.architecture.keyConfigFiles.join(', ')}`);
    }
    parts.push('');

    // Development History — with actual commit messages
    parts.push('DEVELOPMENT HISTORY:');
    parts.push(`  Commit Pattern: ${repoContext.developmentHistory.commitPattern}`);
    parts.push(`  Total Commits Analyzed: ${repoContext.developmentHistory.totalCommitsAnalyzed}`);
    parts.push(`  Authors: ${repoContext.developmentHistory.authors.join(', ')}`);
    if (repoContext.developmentHistory.commitBreakdown) {
        const bd = repoContext.developmentHistory.commitBreakdown;
        parts.push(`  Commit Types: ${Object.entries(bd).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    }
    if (repoContext.developmentHistory.keyCommits.length > 0) {
        parts.push('  Recent Key Commits:');
        repoContext.developmentHistory.keyCommits.slice(0, 8).forEach(c => {
            parts.push(`    - [${c.category}] "${c.message}"`);
        });
    }
    parts.push('');

    // README — include actual content for maximum specificity
    if (repoContext.documentation.summary) {
        parts.push('README CONTENT:');
        parts.push(`  ${repoContext.documentation.summary.slice(0, 800)}`);
        if (repoContext.documentation.sections.length > 0) {
            parts.push(`  README Sections: ${repoContext.documentation.sections.join(', ')}`);
        }
    }

    return parts.join('\n');
}

export default {
    buildRepoContext,
    buildRepoSummary,
    buildPromptContext,
};
