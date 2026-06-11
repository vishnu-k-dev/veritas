/**
 * RepoParser — Rule-based extraction of meaningful context from raw GitHub data
 * Zero LLM cost: all parsing is deterministic
 */

// Known framework/library detection patterns
const FRAMEWORK_SIGNATURES = {
    'React': { deps: ['react', 'react-dom'], files: ['jsx', 'tsx'] },
    'Next.js': { deps: ['next'], files: ['next.config'] },
    'Vue.js': { deps: ['vue'], files: ['vue'] },
    'Angular': { deps: ['@angular/core'], files: ['angular.json'] },
    'Svelte': { deps: ['svelte'], files: ['svelte.config'] },
    'Express': { deps: ['express'] },
    'FastAPI': { deps: ['fastapi'], pyDeps: ['fastapi'] },
    'Flask': { deps: ['flask'], pyDeps: ['flask'] },
    'Django': { deps: ['django'], pyDeps: ['django'] },
    'Spring Boot': { files: ['pom.xml', 'build.gradle'] },
    'Tailwind CSS': { deps: ['tailwindcss'] },
    'MongoDB': { deps: ['mongoose', 'mongodb'] },
    'PostgreSQL': { deps: ['pg', 'sequelize', 'prisma', 'typeorm'] },
    'SQLite': { deps: ['better-sqlite3', 'sqlite3'] },
    'Firebase': { deps: ['firebase', 'firebase-admin'] },
    'Docker': { files: ['Dockerfile', 'docker-compose.yml'] },
    'TypeScript': { deps: ['typescript'], files: ['tsconfig.json'] },
    'Vite': { deps: ['vite'] },
    'Webpack': { deps: ['webpack'] },
    'Jest': { deps: ['jest'] },
    'Vitest': { deps: ['vitest'] },
    'Prisma': { deps: ['prisma', '@prisma/client'] },
    'Socket.io': { deps: ['socket.io', 'socket.io-client'] },
    'Redux': { deps: ['redux', '@reduxjs/toolkit'] },
    'TensorFlow': { pyDeps: ['tensorflow', 'tf'] },
    'PyTorch': { pyDeps: ['torch', 'pytorch'] },
    'OpenAI': { deps: ['openai'], pyDeps: ['openai'] },
    'LangChain': { deps: ['langchain'], pyDeps: ['langchain'] },
};

/**
 * Extract tech stack from dependencies and file tree
 */
export function extractTechStack(rawData) {
    const { packageJson, requirementsTxt, pubspecYaml, languages, tree } = rawData;
    const detected = [];

    const allDeps = {};
    if (packageJson) {
        Object.assign(allDeps, packageJson.dependencies || {}, packageJson.devDependencies || {});
    }

    const pyDeps = [];
    if (requirementsTxt) {
        requirementsTxt.split('\n').forEach(line => {
            const pkg = line.trim().split(/[>=<\[]/)[0].toLowerCase();
            if (pkg) pyDeps.push(pkg);
        });
    }

    // Parse pubspec.yaml for Flutter/Dart projects (simple line-by-line, no YAML parser needed)
    const dartDeps = [];
    if (pubspecYaml) {
        let inDeps = false;
        pubspecYaml.split('\n').forEach(line => {
            if (/^dependencies:/i.test(line.trim()) || /^dev_dependencies:/i.test(line.trim())) {
                inDeps = true;
                return;
            }
            if (/^\S/.test(line) && inDeps) {
                inDeps = false; // New top-level key — stop
                return;
            }
            if (inDeps) {
                const match = line.match(/^\s{2}(\w[\w_-]*):/);
                if (match && match[1] !== 'flutter' && match[1] !== 'flutter_test') {
                    dartDeps.push(match[1]);
                    allDeps[match[1]] = 'dart';
                }
            }
        });
    }

    const filePaths = (tree || []).map(f => f.path.toLowerCase());

    for (const [name, sig] of Object.entries(FRAMEWORK_SIGNATURES)) {
        let found = false;

        // Check npm deps
        if (sig.deps && sig.deps.some(d => allDeps[d])) found = true;
        // Check python deps
        if (sig.pyDeps && sig.pyDeps.some(d => pyDeps.includes(d))) found = true;
        // Check file presence
        if (sig.files && sig.files.some(f => filePaths.some(fp => fp.includes(f.toLowerCase())))) found = true;

        if (found) {
            detected.push({
                name,
                version: allDeps[sig.deps?.[0]] || null,
                category: categorizeTech(name),
            });
        }
    }

    // Detect Flutter specifically
    if (pubspecYaml && /flutter:/i.test(pubspecYaml)) {
        if (!detected.some(d => d.name === 'Flutter')) {
            detected.push({ name: 'Flutter', version: null, category: 'frontend' });
        }
    }

    // Add primary languages
    const langEntries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
    const totalBytes = langEntries.reduce((s, [, v]) => s + v, 0) || 1;

    const primaryLanguages = langEntries.slice(0, 5).map(([lang, bytes]) => ({
        name: lang,
        percentage: Math.round((bytes / totalBytes) * 100),
    }));

    return { detected, primaryLanguages, allDependencies: Object.keys(allDeps) };
}

function categorizeTech(name) {
    const categories = {
        frontend: ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Tailwind CSS', 'Redux'],
        backend: ['Express', 'FastAPI', 'Flask', 'Django', 'Spring Boot'],
        database: ['MongoDB', 'PostgreSQL', 'SQLite', 'Firebase', 'Prisma'],
        devtools: ['TypeScript', 'Vite', 'Webpack', 'Docker', 'Jest', 'Vitest'],
        ai: ['OpenAI', 'LangChain', 'TensorFlow', 'PyTorch'],
        realtime: ['Socket.io'],
    };
    for (const [cat, members] of Object.entries(categories)) {
        if (members.includes(name)) return cat;
    }
    return 'other';
}

/**
 * Extract project architecture from file tree
 */
export function extractArchitecture(tree) {
    if (!tree || tree.length === 0) return { pattern: 'unknown', layers: [], keyFiles: [] };

    const paths = tree.map(f => f.path);
    const dirs = [...new Set(paths.map(p => p.split('/')[0]).filter(d => !d.startsWith('.')))];

    // Detect architecture patterns
    let pattern = 'flat';
    const layers = [];

    if (dirs.some(d => ['src', 'app', 'lib'].includes(d))) {
        pattern = 'standard';
    }

    // Detect MVC
    if (paths.some(p => p.includes('controllers/') || p.includes('controller/')) &&
        paths.some(p => p.includes('models/') || p.includes('model/'))) {
        pattern = 'MVC';
        layers.push('controllers', 'models');
        if (paths.some(p => p.includes('views/') || p.includes('view/'))) layers.push('views');
    }

    // Detect component-based (React, Vue)
    if (paths.some(p => p.includes('components/'))) {
        pattern = paths.some(p => p.includes('pages/') || p.includes('routes/'))
            ? 'page-based SPA' : 'component-based';
        layers.push('components');
        if (paths.some(p => p.includes('pages/'))) layers.push('pages');
        if (paths.some(p => p.includes('hooks/'))) layers.push('hooks');
    }

    // Detect service layer
    if (paths.some(p => p.includes('services/'))) layers.push('services');
    if (paths.some(p => p.includes('utils/') || p.includes('helpers/'))) layers.push('utilities');
    if (paths.some(p => p.includes('engine/'))) layers.push('engine');
    if (paths.some(p => p.includes('api/'))) layers.push('api');
    if (paths.some(p => p.includes('middleware/'))) layers.push('middleware');
    if (paths.some(p => p.includes('tests/') || p.includes('__tests__/'))) layers.push('tests');

    // Key config files
    const keyFiles = paths.filter(p =>
        /^(package\.json|tsconfig\.json|vite\.config|next\.config|webpack\.config|\.env|Dockerfile|docker-compose|requirements\.txt|setup\.py|pyproject\.toml|Makefile|README)/i.test(p.split('/').pop())
    ).slice(0, 15);

    // Top-level directory structure
    const topDirs = dirs.filter(d =>
        !['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.vscode', '.idea'].includes(d)
    );

    return { pattern, layers, keyFiles, topDirs, totalFiles: tree.filter(f => f.type === 'blob').length };
}

/**
 * Analyze commit patterns
 */
export function analyzeCommits(commits) {
    if (!commits || commits.length === 0) {
        return { pattern: 'no-data', frequency: 'unknown', keyCommits: [], commitCount: 0 };
    }

    // Categorize commits
    const categories = {
        feature: /^(feat|add|implement|create|new)/i,
        fix: /^(fix|bug|patch|resolve|hotfix)/i,
        refactor: /^(refactor|restructure|clean|improve|optimize)/i,
        docs: /^(doc|readme|update doc|comment)/i,
        setup: /^(init|setup|config|install|add dep)/i,
        style: /^(style|css|ui|design|layout)/i,
        test: /^(test|spec|coverage)/i,
    };

    const categorized = commits.map(c => {
        const msg = c.message.split('\n')[0]; // first line only
        let category = 'other';
        for (const [cat, re] of Object.entries(categories)) {
            if (re.test(msg)) { category = cat; break; }
        }
        return { ...c, category, shortMessage: msg.slice(0, 100) };
    });

    // Detect patterns
    const featureCount = categorized.filter(c => c.category === 'feature').length;
    const fixCount = categorized.filter(c => c.category === 'fix').length;

    let pattern = 'mixed';
    if (featureCount > commits.length * 0.6) pattern = 'feature-heavy';
    if (fixCount > commits.length * 0.4) pattern = 'fix-heavy';

    // Key commits (most significant-looking ones)
    const keyCommits = categorized
        .filter(c => c.category !== 'other' && c.shortMessage.length > 10)
        .slice(0, 8);

    return {
        pattern,
        commitCount: commits.length,
        categories: Object.fromEntries(
            Object.keys(categories).map(cat => [cat, categorized.filter(c => c.category === cat).length])
        ),
        keyCommits,
        authors: [...new Set(commits.map(c => c.author))],
    };
}

/**
 * Extract project purpose from README
 */
export function parseReadme(readmeContent) {
    if (!readmeContent) return { summary: null, hasSetup: false, hasTechStack: false, sections: [] };

    const lines = readmeContent.split('\n');
    const sections = [];
    let currentSection = null;

    for (const line of lines) {
        const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headerMatch) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: headerMatch[2].trim(), level: headerMatch[1].length, content: '' };
        } else if (currentSection) {
            currentSection.content += line + '\n';
        }
    }
    if (currentSection) sections.push(currentSection);

    // Extract first meaningful paragraph as summary
    const summaryLines = lines
        .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('!') && !l.startsWith('[') && l.length > 20)
        .slice(0, 3);

    return {
        summary: summaryLines.join(' ').slice(0, 500) || null,
        hasSetup: sections.some(s => /install|setup|getting started|quick start/i.test(s.title)),
        hasTechStack: sections.some(s => /tech|stack|built with|technologies/i.test(s.title)),
        sections: sections.map(s => s.title).slice(0, 10),
        fullText: readmeContent.slice(0, 3000), // Cap for LLM context
    };
}

/**
 * Master parse function — takes raw GitHub data and returns structured analysis
 */
export function parseRepository(rawData) {
    const techStack = extractTechStack(rawData);
    const architecture = extractArchitecture(rawData.tree);
    const commitAnalysis = analyzeCommits(rawData.commits);
    const readmeAnalysis = parseReadme(rawData.readme);

    return {
        projectName: rawData.metadata.name,
        fullName: rawData.metadata.fullName,
        description: rawData.metadata.description,
        htmlUrl: rawData.metadata.htmlUrl,
        techStack,
        architecture,
        commitAnalysis,
        readmeAnalysis,
        // Carry raw data for CodeScope
        _rawTree: rawData.tree || [],
        _rawCommits: rawData.commits || [],
        metadata: {
            stars: rawData.metadata.stars,
            forks: rawData.metadata.forks,
            language: rawData.metadata.language,
            license: rawData.metadata.license,
            createdAt: rawData.metadata.createdAt,
            size: rawData.metadata.size,
            defaultBranch: rawData.metadata.defaultBranch || 'main',
        },
    };
}

export default {
    parseRepository,
    extractTechStack,
    extractArchitecture,
    analyzeCommits,
    parseReadme,
};
