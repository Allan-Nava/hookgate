// One POST to TypeSafe's System One endpoint. No SDK: a hook runs on every tool call
// and start-up cost is the cost. The fetch implementation is injectable for tests.
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export class JevError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function systemone({ state, questions, model, apiKey, timeoutMs, fetchImpl = globalThis.fetch, endpoint = ENDPOINT }) {
  if (!apiKey) throw new JevError('TYPESAFE_API_KEY is not set', { code: 'no-key' })
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'hookgate' },
      body: JSON.stringify({ state, model, questions }),
      signal: ac.signal,
    })
    const latencyMs = Date.now() - t0
    if (!res.ok) throw new JevError(`HTTP ${res.status}`, { status: res.status, code: 'http' })
    const json = await res.json()
    if (!json || typeof json.answers !== 'object') throw new JevError('malformed response: no answers', { code: 'malformed' })
    return { answers: json.answers, model: json.model ?? model, usage: json.usage ?? null, latencyMs }
  } catch (e) {
    if (e instanceof JevError) throw e
    if (e.name === 'AbortError') throw new JevError(`timeout after ${timeoutMs} ms`, { code: 'timeout' })
    throw new JevError(e.message, { code: 'network' })
  } finally {
    clearTimeout(timer)
  }
}
