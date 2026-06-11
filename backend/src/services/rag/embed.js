// backend/src/services/rag/embed.js
// Cohere embed-english-v3.0 — 1024-dimensional text embeddings
// Free tier: https://dashboard.cohere.com/api-keys

const URL = 'https://api.cohere.com/v2/embed'
const MODEL = 'embed-english-v3.0'
const BATCH_SIZE = 90  // Cohere max is 96; stay below

export function isEmbedEnabled() {
  return !!process.env.COHERE_API_KEY
}

async function cohereEmbed(texts, inputType) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      texts,
      input_type: inputType,
      embedding_types: ['float'],
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Cohere ${res.status}: ${body.message || JSON.stringify(body)}`)
  }

  const data = await res.json()
  return data.embeddings.float
}

// Embed an array of strings — returns array of 1024-float arrays
// inputType: 'search_document' for indexing, 'search_query' for retrieval
export async function embedBatch(texts, inputType = 'search_document') {
  if (!process.env.COHERE_API_KEY) throw new Error('COHERE_API_KEY not set')
  if (!texts.length) return []

  const all = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const vecs = await cohereEmbed(batch, inputType)
    all.push(...vecs)
  }
  return all
}

export async function embedOne(text, inputType = 'search_query') {
  const vecs = await embedBatch([text], inputType)
  return vecs[0]
}
