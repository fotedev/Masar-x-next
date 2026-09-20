import { describe, expect, it } from 'vitest';

import { extractPuterChunkText } from '../ai/puter-client';

describe('extractPuterChunkText (spec 011)', () => {
  it('extracts plain { text } chunks', () => {
    expect(extractPuterChunkText({ text: 'مرحبا' })).toBe('مرحبا');
  });

  it('extracts bare string chunks', () => {
    expect(extractPuterChunkText('hello')).toBe('hello');
  });

  it('extracts { message: { content: string } } deltas', () => {
    expect(extractPuterChunkText({ message: { content: 'partial' } })).toBe('partial');
  });

  it('extracts { message: { content: [{ text }] } } content-array deltas and joins runs', () => {
    expect(
      extractPuterChunkText({ message: { content: [{ type: 'text', text: 'a' }, { text: 'b' }] } }),
    ).toBe('ab');
  });

  it('extracts from a top-level content array fallback', () => {
    expect(extractPuterChunkText({ content: [{ text: 'x' }, 'y'] })).toBe('xy');
  });

  it('returns empty string for unparseable shapes', () => {
    expect(extractPuterChunkText(null)).toBe('');
    expect(extractPuterChunkText(undefined)).toBe('');
    expect(extractPuterChunkText(42)).toBe('');
    expect(extractPuterChunkText({})).toBe('');
    expect(extractPuterChunkText({ message: {} })).toBe('');
    expect(extractPuterChunkText({ message: { content: null } })).toBe('');
    expect(extractPuterChunkText({ done: true })).toBe('');
  });

  it('returns empty string when text is present but not a string type', () => {
    expect(extractPuterChunkText({ text: 7 })).toBe('');
  });

  it('multi-chunk concatenation reconstructs the full reply', () => {
    const chunks = [{ text: 'The ' }, { text: 'answer ' }, { message: { content: [{ text: 'is 42' }] } }];
    const full = chunks.map(extractPuterChunkText).join('');
    expect(full).toBe('The answer is 42');
  });
});
