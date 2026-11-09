import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DriveManifestSchema, ScheduleSetSchema } from '../index';

// The granular schemas (DriveFileSchema, DriveGroupSchema, DriveSubjectSchema,
// ScheduleSheetSchema) are module-private since spec 041 #204 — the
// dead-export guard wants the `export` keyword off internal building blocks.
// Their semantics are still pinned here, through the exported envelope
// schemas (DriveManifestSchema / ScheduleSetSchema) that compose them.
//
// These envelopes guard two module-import-time parse sites: the web app's
// materials accessor safeParses the real manifest.json at import and the
// schedules accessor parses 4 timetable JSONs — schema drift crashes every
// materials/schedules page. The real-data block at the bottom pins the
// production contract.

const here = path.dirname(fileURLToPath(import.meta.url));
// __tests__ -> schemas -> types -> src -> shared -> packages -> repo root
const repoRoot = path.resolve(here, '../../../../../..');

const file = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lecture 1.pdf',
  fileId: '1AbCdEfGhIjK',
  type: 'application/pdf',
  modified: '2026-01-02T03:04:05.000Z',
  ...overrides,
});

const group = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lectures',
  nameAr: 'المحاضرات',
  folderId: 'folder-abc',
  files: [] as unknown[],
  ...overrides,
});

const subject = (overrides: Record<string, unknown> = {}) => ({
  slug: 'math-2',
  name: 'Math 2',
  nameAr: 'رياضيات ٢',
  icon: '📘',
  folderId: null,
  groups: [] as unknown[],
  level: 1,
  semester: 1,
  stub: true,
  ...overrides,
});

const manifestEnvelope = (subjects: unknown[]) => ({
  generated: '2026-11-07T00:00:00.000Z',
  source: { name: 'Drive', folderId: 'root', url: 'https://x' },
  embedFormat: 'iframe',
  subjects,
});

describe('DriveFileSchema (via DriveManifestSchema envelope)', () => {
  const manifestWithFile = (row: Record<string, unknown>) =>
    manifestEnvelope([subject({ groups: [group({ files: [row] })] })]);

  it('accepts a well-formed file row', () => {
    expect(DriveManifestSchema.safeParse(manifestWithFile(file())).success).toBe(
      true,
    );
  });

  it('tolerates a null modified date (Drive omits it sometimes)', () => {
    const result = DriveManifestSchema.safeParse(
      manifestWithFile(file({ modified: null })),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a short fileId (min 10 — Drive ids are long)', () => {
    expect(
      DriveManifestSchema.safeParse(manifestWithFile(file({ fileId: 'short' })))
        .success,
    ).toBe(false);
  });
});

describe('DriveGroupSchema (recursive via z.lazy, via manifest envelope)', () => {
  it('accepts nested children two levels deep', () => {
    const nested = subject({
      groups: [
        group({
          children: [
            group({
              name: 'Week 1',
              nameAr: 'الأسبوع ١',
              folderId: 'folder-child',
              files: [file()],
              children: [
                group({
                  name: 'Deep',
                  nameAr: 'عميق',
                  folderId: 'folder-deep',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const result = DriveManifestSchema.safeParse(manifestEnvelope([nested]));
    expect(result.success).toBe(true);
  });

  it('rejects children that do not satisfy the group shape', () => {
    const broken = subject({
      groups: [group({ children: [{ name: 'incomplete' }] })],
    });
    expect(
      DriveManifestSchema.safeParse(manifestEnvelope([broken])).success,
    ).toBe(false);
  });
});

describe('DriveSubjectSchema (via manifest envelope)', () => {
  it('accepts a stub subject (folderId null)', () => {
    const result = DriveManifestSchema.safeParse(manifestEnvelope([subject()]));
    expect(result.success).toBe(true);
  });

  it('rejects non-positive level/semester', () => {
    expect(
      DriveManifestSchema.safeParse(manifestEnvelope([subject({ level: 0 })]))
        .success,
    ).toBe(false);
    expect(
      DriveManifestSchema.safeParse(manifestEnvelope([subject({ semester: -2 })]))
        .success,
    ).toBe(false);
  });
});

describe('DriveManifestSchema', () => {
  it('accepts a minimal manifest envelope', () => {
    expect(
      DriveManifestSchema.safeParse(manifestEnvelope([])).success,
    ).toBe(true);
  });

  it('tolerates an absent lastSyncRun and rejects a malformed source', () => {
    expect(
      DriveManifestSchema.safeParse({
        ...manifestEnvelope([]),
        lastSyncRun: 'run-1',
      }).success,
    ).toBe(true);
    expect(
      DriveManifestSchema.safeParse({
        ...manifestEnvelope([]),
        source: { name: 'x' },
      }).success,
    ).toBe(false);
  });
});

describe('ScheduleSheetSchema / ScheduleSetSchema', () => {
  const sheet = {
    id: 'f1',
    docId: '1AbCdEfGhIjKlMnOp',
    tab: 'الفرقة الأولى',
    gid: '0',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    sourceUrl: 'https://docs.google.com/spreadsheets/x',
    rowCount: 10,
    colCount: 6,
    rows: [
      ['subject/staff/room', ''],
      ['a', 'b'],
    ],
  };

  const setWith = (sheets: unknown[]) => ({ sheets });

  it('accepts a well-formed sheet', () => {
    expect(ScheduleSetSchema.safeParse(setWith([sheet])).success).toBe(true);
  });

  it('rejects a short docId (min 10)', () => {
    expect(
      ScheduleSetSchema.safeParse(setWith([{ ...sheet, docId: '123' }])).success,
    ).toBe(false);
  });

  it('rejects non-positive rowCount/colCount', () => {
    expect(
      ScheduleSetSchema.safeParse(setWith([{ ...sheet, rowCount: 0 }])).success,
    ).toBe(false);
    expect(
      ScheduleSetSchema.safeParse(setWith([{ ...sheet, colCount: -1 }])).success,
    ).toBe(false);
  });

  it('rejects a set with zero sheets (min 1)', () => {
    expect(ScheduleSetSchema.safeParse(setWith([])).success).toBe(false);
  });

  it('accepts a one-sheet set', () => {
    expect(ScheduleSetSchema.safeParse(setWith([sheet])).success).toBe(true);
  });
});

describe('REAL production data contract (spec 040)', () => {
  it('the web manifest.json satisfies DriveManifestSchema', () => {
    const manifestPath = path.join(
      repoRoot,
      'apps/web/src/lib/materials/manifest.json',
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const result = DriveManifestSchema.safeParse(manifest);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`manifest.json drifted from DriveManifestSchema:\n${issues}`);
    }
    expect(result.success).toBe(true);
    expect(result.data.subjects.length).toBeGreaterThan(0);
  });

  it('every timetable JSON satisfies ScheduleSheetSchema', () => {
    const schedulesDir = path.join(repoRoot, 'apps/web/src/lib/schedules');
    const files = fs
      .readdirSync(schedulesDir)
      .filter((f) => f.startsWith('timetable-') && f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      const sheet = JSON.parse(fs.readFileSync(path.join(schedulesDir, file), 'utf8'));
      const result = ScheduleSetSchema.safeParse({ sheets: [sheet] });
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('\n');
        throw new Error(`${file} drifted from ScheduleSheetSchema:\n${issues}`);
      }
    }
  });
});
