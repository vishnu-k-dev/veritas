// src/engine/repoAnalysis.js
// Deterministic repo parsing — zero LLM, pure rule-based analysis

const FRAMEWORKS = {
  // Frontend
  react:     ['react', 'react-dom'],
  vue:       ['vue', '@vue/core'],
  angular:   ['@angular/core'],
  nextjs:    ['next'],
  nuxtjs:    ['nuxt'],
  svelte:    ['svelte'],
  astro:     ['astro'],
  // Backend JS
  express:   ['express'],
  fastify:   ['fastify'],
  nestjs:    ['@nestjs/core'],
  hono:      ['hono'],
  // Backend Python (requirements.txt)
  django:    ['django', 'Django'],
  fastapi:   ['fastapi', 'FastAPI'],
  flask:     ['flask', 'Flask'],
  // Data / ML
  tensorflow: ['tensorflow', '@tensorflow/tfjs'],
  pytorch:    ['torch'],
  pandas:     ['pandas'],
  sklearn:    ['scikit-learn', 'sklearn'],
  // DB / ORM
  prisma:    ['prisma', '@prisma/client'],
  mongoose:  ['mongoose'],
  drizzle:   ['drizzle-orm'],
  // State
  redux:     ['redux', '@reduxjs/toolkit'],
  zustand:   ['zustand'],
  // Testing
  jest:      ['jest'],
  vitest:    ['vitest'],
  pytest:    ['pytest'],
  // Infra
  docker:    ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
  ghactions: ['.github/workflows'],
  // Mobile
  reactnative: ['react-native'],
  expo:        ['expo'],
}

const SYSTEM_SIGNALS = {
  backend_api:   ['express', 'fastify', 'nestjs', 'hono', 'django', 'fastapi', 'flask', 'routes/', 'controllers/', 'middleware/'],
  frontend_app:  ['react', 'vue', 'angular', 'nextjs', 'svelte', 'components/', 'pages/', 'public/'],
  full_stack:    ['next', 'nuxt'],
  ml_system:     ['tensorflow', 'pytorch', 'pandas', 'sklearn', 'model/', 'train.py', 'notebook', '.ipynb'],
  data_pipeline: ['airflow', 'kafka', 'celery', 'pipeline', 'etl', 'worker', 'queue'],
  mobile:        ['react-native', 'expo', 'flutter', 'swift', 'kotlin', 'android/', 'ios/'],
  cli_tool:      ['bin/', 'cmd/', 'commander', 'yargs', 'argparse'],
  library:       ['lib/', 'dist/', 'index.ts', 'src/index'],
}

export function extractTechStack(data) {
  const { packageJson, requirementsTxt, fileTree } = data
  const found = new Set()

  const deps = {
    ...(packageJson?.dependencies    || {}),
    ...(packageJson?.devDependencies || {}),
  }

  for (const [name, sigs] of Object.entries(FRAMEWORKS)) {
    if (sigs.some(s => deps[s] || (fileTree || []).some(p => p.includes(s)) || (requirementsTxt || '').toLowerCase().includes(s.toLowerCase()))) {
      found.add(name)
    }
  }

  // Languages from GitHub API
  const langs = Object.keys(data.languages || {})
  langs.forEach(l => found.add(l))

  return [...found].slice(0, 14)
}

export function detectSystemType(data) {
  const { packageJson, fileTree, readme, requirementsTxt } = data
  const deps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) }
  const paths   = (fileTree       || []).join(' ').toLowerCase()
  const rdLower = (readme         || '').toLowerCase()
  const reqLow  = (requirementsTxt || '').toLowerCase()

  const scores = {}
  for (const [type, sigs] of Object.entries(SYSTEM_SIGNALS)) {
    scores[type] = sigs.filter(s =>
      deps[s] || paths.includes(s.toLowerCase()) || rdLower.includes(s.toLowerCase()) || reqLow.includes(s.toLowerCase())
    ).length
  }

  // Full-stack: both frontend + backend signals
  if (scores.frontend_app >= 1 && scores.backend_api >= 1) return 'full_stack'

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const top = sorted[0]
  return (top && top[1] > 0) ? top[0] : 'software_project'
}

export function detectArchitecture(data) {
  const paths = (data.fileTree || []).join(' ').toLowerCase()

  if (paths.includes('components/') && paths.includes('pages/')) return 'component-based SPA'
  if (paths.includes('controllers/') && paths.includes('models/')) return 'MVC'
  if (paths.includes('services/') && paths.includes('routes/')) return 'service-layer API'
  if (paths.includes('cmd/') || paths.includes('bin/')) return 'CLI application'
  if (paths.includes('lib/') && paths.includes('index')) return 'library / module'
  if (paths.includes('notebooks/') || paths.includes('.ipynb')) return 'notebook / ML pipeline'
  return 'standard project layout'
}

export function buildRepoContext(rawData) {
  const techStack    = extractTechStack(rawData)
  const systemType   = detectSystemType(rawData)
  const architecture = detectArchitecture(rawData)

  const totalLangBytes = Object.values(rawData.languages || {}).reduce((s, v) => s + v, 0)
  const langPercents   = totalLangBytes === 0
    ? {}
    : Object.fromEntries(
        Object.entries(rawData.languages || {}).map(([l, b]) => [l, Math.round((b / totalLangBytes) * 100)])
      )

  return {
    name:        rawData.name,
    fullName:    rawData.fullName,
    description: rawData.description,
    languages:   langPercents,
    techStack,
    systemType,
    architecture,
    commits:     rawData.commits || [],
    readme:      rawData.readme  || '',
    fileCount:   rawData.fileTree?.length || 0,
    repoUrl:     `https://github.com/${rawData.owner}/${rawData.repo}`,
    stars:       rawData.stars  || 0,
    topics:      rawData.topics || [],
  }
}
