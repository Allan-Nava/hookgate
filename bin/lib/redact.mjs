// State never carries secrets. A command line can hold a token; a tool result can hold
// a whole .env. Redact before the request, then cap the size — Jev's state limit is
// 32k tokens and a hook should not be the thing that ships a log file to an API.
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<redacted:private-key>'],
  [/\b(sk|rk|pk)[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{16,}/g, '<redacted:key>'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '<redacted:github-token>'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '<redacted:github-token>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<redacted:aws-key-id>'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '<redacted:slack-token>'],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, '<redacted:google-key>'],
  [/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/g, '$1 <redacted>'],
  [/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, '<redacted:jwt>'],
  [/(\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)[A-Z0-9_]*\s*[=:]\s*)(["']?)[^\s"'&]{6,}\2/gi, '$1$2<redacted>$2'],
  [/(--?(?:password|passwd|token|api[-_]?key|secret)[= ])\S+/gi, '$1<redacted>'],
  [/(https?:\/\/[^\s/@:]+:)[^\s/@]+@/g, '$1<redacted>@'],
  [/\b[A-Fa-f0-9]{40,}\b/g, '<redacted:hex>'],
]

export function redact(text) {
  let out = String(text ?? '')
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep)
  return out
}

export function truncate(text, max) {
  const s = String(text ?? '')
  if (s.length <= max) return s
  const head = Math.floor(max * 0.7)
  const tail = max - head
  return `${s.slice(0, head)}\n…[${s.length - max} chars elided by hookgate]…\n${s.slice(-tail)}`
}

export const prepare = (text, max) => truncate(redact(text), max)
