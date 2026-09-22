import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const tmp = () => mkdtempSync(join(tmpdir(), 'hookgate-'))

// A fake fetch answering with the given Jev answers, recording calls.
export function fakeFetch(answers, { status = 200, delayMs = 0, model = 'jev-1.13.0' } = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    if (delayMs) await new Promise((r, rej) => {
      const t = setTimeout(r, delayMs)
      init.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        const e = new Error('aborted')
        e.name = 'AbortError'
        rej(e)
      })
    })
    return { ok: status < 400, status, json: async () => ({ model, answers, usage: { input_tokens: 42, output_tokens: 0 } }) }
  }
  fn.calls = calls
  return fn
}

export const env = (dir, extra = {}) => ({ TYPESAFE_API_KEY: 'sk-test-0123456789abcdef', HOOKGATE_DATA: dir, CLAUDE_PLUGIN_ROOT: '/plugin', ...extra })
export const preInput = (command, extra = {}) => ({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_input: { command }, cwd: '/tmp/repo', ...extra })
