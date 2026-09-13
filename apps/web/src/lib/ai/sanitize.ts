/**
 * Assistant reply sanitization (spec 004).
 *
 * Keeps the assistant's output conversational: no reflexive greetings
 * when the user asked a direct question, and unstyled code always lands
 * inside a fenced block so the chat renderer highlights it.
 */

export const userMessageLooksLikeGreeting = (query: string) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return false;
  return (
    q === 'hi' ||
    q === 'hello' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.includes('السلام عليكم') ||
    q.includes('سلام عليكم') ||
    q.includes('اهلا') ||
    q.includes('أهلا') ||
    q.includes('أهلاً') ||
    q.includes('مرحبا') ||
    q.includes('مرحباً') ||
    q.includes('مرحبًا')
  );
};

export const stripOpeningGreeting = (text: string) => {
  const raw = String(text ?? '');
  const trimmedStart = raw.replace(/^\s+/, '');

  const patterns: RegExp[] = [
    /^((?:أهلاً|أهلا|اهلا|مرحباً|مرحبًا|مرحبا|السلام عليكم|سلام عليكم)(?:\s+بك|\s+وسهلاً|\s+وسهلا)?)\s*[!！\.،,:؛\-–—]*\s*/i,
    /^(hi|hello|hey)\s*[!！\.，,:;\-–—]*\s*/i,
  ];

  for (const p of patterns) {
    if (p.test(trimmedStart)) {
      const next = trimmedStart.replace(p, '');
      return next.replace(/^\s+/, '');
    }
  }

  return raw;
};

const enforceFencedCodeBlocks = (text: string) => {
  const raw = String(text ?? '');
  if (raw.includes('```')) return raw;

  const lines = raw.split(/\r?\n/);
  const isCodeLine = (line: string) => {
    if (/^\s{4,}\S/.test(line) || /^\t+\S/.test(line)) return true;
    if (/^\s*(def|class)\s+\w+/.test(line)) return true;
    if (/^\s*(function|const|let|var)\s+/.test(line)) return true;
    if (/^\s*import\s+/.test(line)) return true;
    if (/^\s*if\s*\(.*\)\s*\{?\s*$/.test(line)) return true;
    if (/^\s*return\s+/.test(line)) return true;
    if (/^\s*#include\s+/.test(line)) return true;
    return false;
  };

  let bestStart = -1;
  let bestEnd = -1;
  let currentStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const code = isCodeLine(lines[i]);
    if (code && currentStart === -1) currentStart = i;
    if (!code && currentStart !== -1) {
      const end = i - 1;
      if (end - currentStart + 1 >= 2 && end - currentStart > bestEnd - bestStart) {
        bestStart = currentStart;
        bestEnd = end;
      }
      currentStart = -1;
    }
  }
  if (currentStart !== -1) {
    const end = lines.length - 1;
    if (end - currentStart + 1 >= 2 && end - currentStart > bestEnd - bestStart) {
      bestStart = currentStart;
      bestEnd = end;
    }
  }

  if (bestStart === -1) return raw;

  const before = lines.slice(0, bestStart).join('\n').replace(/\s+$/, '');
  const codeBlock = lines.slice(bestStart, bestEnd + 1).join('\n').replace(/^\s+\n+/, '').replace(/\n+\s+$/, '');
  const after = lines.slice(bestEnd + 1).join('\n').replace(/^\s+/, '');

  const wrapped = `${before}${before ? '\n\n' : ''}\
\`\`\`\n${codeBlock}\n\`\`\`\n${after}`;
  return wrapped.replace(/\n{3,}/g, '\n\n').trim();
};

export const sanitizeAssistantReply = (query: string, reply: string) => {
  let out = String(reply ?? '');
  if (!out) return out;

  if (!userMessageLooksLikeGreeting(query)) {
    out = stripOpeningGreeting(out);
  }
  out = enforceFencedCodeBlocks(out);
  return out;
};
