/**
 * repoScraper.js — Parallel GitHub repo scraper using Promise.allSettled
 * Fetches README, file tree, commits, and deps all at once
 */

const GITHUB_API = 'https://api.github.com';

/**
 * Parse a GitHub URL into owner/repo
 */
function parseGitHubUrl(url) {
    const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
    const match = cleaned.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    return { owner: match[1], repo: match[2] };
}

/**
 * Scrape a GitHub repo in parallel — README, file tree, commits, deps
 * Uses Promise.allSettled so one failure does not break the others
 * @param {string} repoUrl - GitHub repo URL or owner/repo
 * @returns {object} - { readme, files, commits, deps, stack }
 */
export async function scrapeRepo(repoUrl) {
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const token = import.meta.env?.VITE_GITHUB_TOKEN
    const headers = {
        Accept: 'application/vnd.github.v3+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const base = `${GITHUB_API}/repos/${owner}/${repo}`;

    // Fetch all 4 resources in parallel
    const [readmeRes, treeRes, commitsRes, pkgRes] = await Promise.allSettled([
        fetch(`${base}/readme`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`${base}/git/trees/HEAD?recursive=1`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`${base}/commits?per_page=20`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`${base}/contents/package.json`, { headers })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.content) return JSON.parse(atob(data.content));
                // Fallback to requirements.txt
                return fetch(`${base}/contents/requirements.txt`, { headers })
                    .then(r => r.ok ? r.json() : null)
                    .then(d => d?.content ? { _type: 'python', raw: atob(d.content) } : null);
            }),
    ]);

    // Decode README from base64
    let readme = '';
    if (readmeRes.status === 'fulfilled' && readmeRes.value?.content) {
        try {
            readme = atob(readmeRes.value.content);
        } catch {
            readme = readmeRes.value.content;
        }
    }

    // Extract file paths from tree
    const files = [];
    if (treeRes.status === 'fulfilled' && treeRes.value?.tree) {
        treeRes.value.tree.forEach(item => {
            if (item.type === 'blob') files.push(item.path);
        });
    }

    // Extract commit messages
    const commits = [];
    if (commitsRes.status === 'fulfilled' && Array.isArray(commitsRes.value)) {
        commitsRes.value.forEach(c => {
            commits.push(c.commit?.message?.split('\n')[0] || '');
        });
    }

    // Extract deps
    let deps = [];
    const pkgData = pkgRes.status === 'fulfilled' ? pkgRes.value : null;
    if (pkgData) {
        if (pkgData._type === 'python') {
            // requirements.txt
            deps = pkgData.raw.split('\n').map(l => l.trim().split('==')[0].split('>=')[0]).filter(Boolean);
        } else {
            // package.json
            deps = [
                ...Object.keys(pkgData.dependencies || {}),
                ...Object.keys(pkgData.devDependencies || {}),
            ];
        }
    }

    // Auto-detect stack from deps and file extensions
    const stack = detectStack(deps, files);

    return { readme, files, commits, deps, stack, repoName: repo, owner };
}

/**
 * Auto-detect the tech stack from deps and file contents
 */
function detectStack(deps, files) {
    const detected = [];
    const allDeps = deps.map(d => d.toLowerCase());
    const allFiles = files.map(f => f.toLowerCase());

    const stacks = {
        react: () => allDeps.includes('react'),
        vue: () => allDeps.includes('vue'),
        angular: () => allDeps.includes('@angular/core'),
        express: () => allDeps.includes('express'),
        fastapi: () => allDeps.includes('fastapi'),
        flask: () => allDeps.includes('flask'),
        django: () => allDeps.includes('django'),
        spring: () => allFiles.some(f => f.includes('pom.xml') || f.includes('build.gradle')),
        rails: () => allFiles.some(f => f.includes('gemfile')),
        nextjs: () => allDeps.includes('next'),
        svelte: () => allDeps.includes('svelte'),
        tailwind: () => allDeps.includes('tailwindcss'),
        sqlite: () => allDeps.includes('better-sqlite3') || allDeps.includes('sqlite3'),
        mongodb: () => allDeps.includes('mongoose') || allDeps.includes('mongodb'),
        postgres: () => allDeps.includes('pg') || allDeps.includes('psycopg2'),
    };

    Object.entries(stacks).forEach(([name, check]) => {
        if (check()) detected.push(name);
    });

    return detected;
}

/**
 * Generate a 2-3 sentence human-readable project summary
 * @param {object} scrapedData - Output from scrapeRepo()
 * @returns {string} - Human-readable summary
 */
export function generateProjectSummary(scrapedData) {
    const { readme, stack, commits, files, deps, repoName } = scrapedData;

    // First part: what the project is
    let summary = '';

    // Extract first 3 sentences from README
    if (readme) {
        const cleaned = readme
            .replace(/^#.*$/gm, '')      // Remove markdown headers
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip links
            .replace(/[*_`]/g, '')       // Strip markdown formatting
            .trim();
        const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
        if (sentences.length > 0) {
            summary = sentences.slice(0, 3).join(' ');
        }
    }

    if (!summary) {
        summary = `${repoName} is a project with ${files.length} files and ${deps.length} dependencies.`;
    }

    // Second part: tech stack
    if (stack.length > 0) {
        summary += ` Built with ${stack.join(', ')}.`;
    }

    // Third part: recent activity from fix/feature commits
    const recentActivity = commits
        .filter(msg => /^(fix|feat|add|implement|update|refactor)/i.test(msg))
        .slice(0, 2);
    if (recentActivity.length > 0) {
        summary += ` Recent work includes: "${recentActivity.join('", "')}"`;
    }

    return summary.trim();
}

export default { scrapeRepo, generateProjectSummary };
