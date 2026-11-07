import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MESSAGE_NAMESPACES } from '../types';
import { messages, getNamespaces } from '../../i18n';

// Spec 040 — full namespace + per-key parity contract. The namespace-level
// drift this pins previously shipped silently: MESSAGE_NAMESPACES listed a
// phantom "trw" namespace and omitted 7 real ones; the shared i18n registry
// lacked materials/schedules. Per-key parity was "enforced at PR time"
// (manual review per i18n-messages.md) — this test makes it mechanical.

const here = path.dirname(fileURLToPath(import.meta.url));
// __tests__ -> messages -> src -> shared; the JSONs live at shared/src/messages
const messagesDir = path.resolve(here, '../../..', 'src/messages');

function namespacesOnDisk(locale: 'ar' | 'en'): Set<string> {
  return new Set(
    fs
      .readdirSync(path.join(messagesDir, locale))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, '')),
  );
}

/** Flatten a namespace object into dot-path keys (objects recurse). */
function flatten(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

function placeholders(value: string): string[] {
  // Interpolation placeholders are identifier-shaped ({count}, {lectureKey}).
  // The JSONs also contain locale-specific display tokens like
  // `{# فلاتر نشطة}` / `{ملخص واحد}` inside braces — those are rendered
  // text, not TranslationValues keys, and legitimately differ per locale.
  return (value.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? []).sort();
}

describe('MESSAGE_NAMESPACES contract', () => {
  it('lists exactly the ar/*.json namespaces on disk (no phantom, no omission)', () => {
    const disk = namespacesOnDisk('ar');
    const listed: Set<string> = new Set(MESSAGE_NAMESPACES);
    const phantom = [...listed].filter((n) => !disk.has(n));
    const missing = [...disk].filter((n) => !listed.has(n));
    expect(phantom, `phantom namespaces not on disk: ${phantom.join(', ')}`).toEqual([]);
    expect(missing, `disk namespaces missing from the list: ${missing.join(', ')}`).toEqual([]);
    expect(listed.size).toBe(disk.size);
  });

  it('ar and en expose the identical namespace file set', () => {
    expect(namespacesOnDisk('ar')).toEqual(namespacesOnDisk('en'));
  });
});

describe('shared i18n registry parity', () => {
  it.each(['ar', 'en'] as const)('%s registry exposes exactly MESSAGE_NAMESPACES', (locale) => {
    expect(getNamespaces(locale).sort()).toEqual([...MESSAGE_NAMESPACES].sort());
  });
});

describe('full per-key ar/en parity (every leaf, every namespace)', () => {
  it.each([...MESSAGE_NAMESPACES])('%s: same key set in both locales', (ns) => {
    const arKeys = flatten(messages.ar[ns]).sort();
    const enKeys = flatten(messages.en[ns]).sort();
    const arOnly = arKeys.filter((k) => !enKeys.includes(k));
    const enOnly = enKeys.filter((k) => !arKeys.includes(k));
    expect(
      arOnly,
      `keys present only in ar/${ns}.json: ${arOnly.join(', ')}`,
    ).toEqual([]);
    expect(
      enOnly,
      `keys present only in en/${ns}.json: ${enOnly.join(', ')}`,
    ).toEqual([]);
  });

  it.each([...MESSAGE_NAMESPACES])(
    '%s: non-empty leaves and identical {placeholder} sets per key',
    (ns) => {
      const arKeys = flatten(messages.ar[ns]);
      expect(arKeys.length, `${ns} is empty in ar`).toBeGreaterThan(0);
      for (const key of arKeys) {
        // Flat-key lookup first, then dot-path walk — same as t().
        const get = (table: unknown): unknown => {
          const record = table as Record<string, unknown>;
          if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
          return key.split('.').reduce<unknown>(
            (acc, seg) =>
              acc && typeof acc === 'object'
                ? (acc as Record<string, unknown>)[seg]
                : undefined,
            table,
          );
        };
        const arValue = get(messages.ar[ns]);
        const enValue = get(messages.en[ns]);
        expect(arValue, `${ns}.${key} empty in ar`).not.toBe('');
        expect(enValue, `${ns}.${key} empty in en`).not.toBe('');
        expect(
          placeholders(String(arValue)),
          `${ns}.${key} placeholder drift ar vs en`,
        ).toEqual(placeholders(String(enValue)));
      }
    },
  );
});
