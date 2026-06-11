// src/services/githubService.js
// Direct GitHub REST API — public repos, no auth required
// ~8 API calls per session; well within 60 req/hour unauthenticated

const GH = 'https://api.github.com'
const GITHUB_TOKEN = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GITHUB_TOKEN : null

export function parseGitHubUrl(url) {
  const cleaned = url.trim().replace(/\/$/, '').replace(/\.git$/, '')
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/)
  if (match) return { owner: match[1], repo: match[2] }
  // bare "owner/repo" format
  const bare = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (bare) return { owner: bare[1], repo: bare[2] }
  return null
}

async function ghGet(path, token = GITHUB_TOKEN) {
  const headers = { Accept: 'application/vnd.github.v3+json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${GH}${path}`, { headers })
  if (res.status === 404) throw new Error('Repository not found or is private')
  if (res.status === 403) throw new Error('GitHub API rate limit reached — try again in a minute')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub error ${res.status}`)
  }
  return res.json()
}

// Exported for legacy repoIntel.js compatibility
export async function fetchFileContent(owner, repo, path) {
  return ghContent(owner, repo, path)
}

async function ghContent(owner, repo, path) {
  try {
    const file = await ghGet(`/repos/${owner}/${repo}/contents/${path}`)
    if (!file.content) return null
    return atob(file.content.replace(/\n/g, ''))
  } catch {
    return null
  }
}

export async function analyzeRepository(owner, repo, onProgress) {
  onProgress?.('Fetching repository metadata…')
  const meta = await ghGet(`/repos/${owner}/${repo}`)
  if (meta.private) throw new Error('Repository is private — please use a public repository')

  const branch = meta.default_branch || 'main'

  onProgress?.('Loading commit history…')
  const [commits, languages] = await Promise.all([
    ghGet(`/repos/${owner}/${repo}/commits?per_page=20`).catch(() => []),
    ghGet(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
  ])

  onProgress?.('Reading project structure…')
  const [treeData, readme, packageJson, requirementsTxt] = await Promise.all([
    ghGet(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`).catch(() => ({ tree: [] })),
    ghContent(owner, repo, 'README.md'),
    ghContent(owner, repo, 'package.json').then(t => { try { return JSON.parse(t) } catch { return null } }),
    ghContent(owner, repo, 'requirements.txt'),
  ])

  const fileTree = (treeData.tree || [])
    .filter(f => f.type === 'blob')
    .map(f => f.path)
    .slice(0, 400)

  onProgress?.('Building examination context…')

  return {
    owner, repo,
    name:          meta.name,
    fullName:      meta.full_name,
    description:   meta.description || '',
    defaultBranch: branch,
    stars:         meta.stargazers_count || 0,
    forks:         meta.forks_count     || 0,
    language:      meta.language        || '',
    topics:        meta.topics          || [],
    createdAt:     meta.created_at,
    updatedAt:     meta.updated_at,
    languages,
    commits: commits.map(c => ({
      sha:     c.sha,
      message: c.commit?.message?.split('\n')[0]?.slice(0, 120) || '',
      author:  c.commit?.author?.name || c.commit?.committer?.name || 'unknown',
      date:    c.commit?.author?.date || c.commit?.committer?.date || '',
    })),
    fileTree,
    readme:          (readme          || '').slice(0, 4000),
    packageJson,
    requirementsTxt: requirementsTxt || '',
  }
}
