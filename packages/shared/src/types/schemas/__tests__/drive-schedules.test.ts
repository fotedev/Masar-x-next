import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DriveFileSchema,
  DriveGroupSchema,
  DriveManifestSchema,
  DriveSubjectSchema,
  ScheduleSetSchema,
  ScheduleSheetSchema,
} from '../index';

// These schemas guard two module-import-time parse sites: the web app's
// materials accessor safeParses the real manifest.json at import and the
// schedules accessor parses 4 timetable JSONs — schema drift crashes every
// materials/schedules page. Fixture tests pin the schema semantics; the
// real-data block at the bottom pins the production contract.

const here = path.dirname(fileURLToPath(import.meta.url));
// __tests__ -> schemas -> types -> src -> shared -> packages -> repo root
const repoRoot = path.resolve(here, '../../../../../..');

describe('DriveFileSchema', () => {
  it('accepts a well-formed file row', () => {
    expect(
      DriveFileSchema.safeParse({
        name: 'Lecture 1.pdf',
        fileId: '1AbCdEfGhIjK',
        type: 'application/pdf',
        modified: '2026-01-02T03:04:05.000Z',
      }).success,
    ).toBe(true);
  });

  it('tolerates a null modified date (Drive omits it sometimes)', () => {
    const result = DriveFileSchema.safeParse({
      name: 'x.pdf',
      fileId: '1AbCdEfGhIjK',
      type: 'application/pdf',
      modified: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a short fileId (min 10 — Drive ids are long)', () => {
    expect(
      DriveFileSchema.safeParse({
        name: 'x.pdf',
        fileId: 'short',
        type: 'pdf',
        modified: null,
      }).success,
    ).toBe(false);
  });
});

describe('DriveGroupSchema (recursive via z.lazy)', () => {
  it('accepts nested children two levels deep', () => {
    const group = {
      name: 'Lectures',
      nameAr: 'المحاضرات',
      folderId: 'folder-abc',
      files: [],
      children: [
        {
          name: 'Week 1',
          nameAr: 'الأسبوع ١',
          folderId: 'folder-child',
          files: [
            {
              name: 'a.pdf',
              fileId: '1AbCdEfGhIjK',
              type: 'application/pdf',
              modified: null,
            },
          ],
          children: [
            {
              name: 'Deep',
              nameAr: 'عميق',
              folderId: 'folder-deep',
              files: [],
            },
          ],
        },
      ],
    };
    const result = DriveGroupSchema.safeParse(group);
    expect(result.success).toBe(true);
  });

  it('rejects children that do not satisfy the group shape', () => {
    const group = {
      name: 'Lectures',
      nameAr: 'المحاضرات',
      folderId: 'folder-abc',
      files: [],
      children: [{ name: 'incomplete' }],
    };
    expect(DriveGroupSchema.safeParse(group).success).toBe(false);
  });
});

describe('DriveSubjectSchema', () => {
  it('accepts a stub subject (folderId null)', () => {
    const result = DriveSubjectSchema.safeParse({
      slug: 'math-2',
      name: 'Math 2',
      nameAr: 'رياضيات ٢',
      icon: '📘',
      folderId: null,
      groups: [],
      level: 1,
      semester: 1,
      stub: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive level/semester', () => {
    const base = {
      slug: 'x',
      name: 'X',
      nameAr: 'س',
      icon: '',
      folderId: null,
      groups: [],
    };
    expect(
      DriveSubjectSchema.safeParse({ ...base, level: 0, semester: 1 }).success,
    ).toBe(false);
    expect(
      DriveSubjectSchema.safeParse({ ...base, level: 1, semester: -2 }).success,
    ).toBe(false);
  });
});

describe('DriveManifestSchema', () => {
  it('accepts a minimal manifest envelope', () => {
    const manifest = {
      generated: '2026-11-07T00:00:00.000Z',
      source: { name: 'Drive', folderId: 'root', url: 'https://x' },
      embedFormat: 'iframe',
      subjects: [],
    };
    expect(DriveManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('tolerates an absent lastSyncRun and rejects a malformed source', () => {
    const base = {
      generated: '2026-11-07T00:00:00.000Z',
      source: { name: 'Drive', folderId: 'root', url: 'https://x' },
      embedFormat: 'iframe',
      subjects: [],
    };
    expect(
      DriveManifestSchema.safeParse({ ...base, lastSyncRun: 'run-1' }).success,
    ).toBe(true);
    expect(
      DriveManifestSchema.safeParse({ ...base, source: { name: 'x' } }).success,
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

  it('accepts a well-formed sheet', () => {
    expect(ScheduleSheetSchema.safeParse(sheet).success).toBe(true);
  });

  it('rejects a short docId (min 10)', () => {
    expect(
      ScheduleSheetSchema.safeParse({ ...sheet, docId: '123' }).success,
    ).toBe(false);
  });

  it('rejects non-positive rowCount/colCount', () => {
    expect(
      ScheduleSheetSchema.safeParse({ ...sheet, rowCount: 0 }).success,
    ).toBe(false);
    expect(
      ScheduleSheetSchema.safeParse({ ...sheet, colCount: -1 }).success,
    ).toBe(false);
  });

  it('rejects a set with zero sheets (min 1)', () => {
    expect(ScheduleSetSchema.safeParse({ sheets: [] }).success).toBe(false);
  });

  it('accepts a one-sheet set', () => {
    expect(ScheduleSetSchema.safeParse({ sheets: [sheet] }).success).toBe(true);
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
      const result = ScheduleSheetSchema.safeParse(sheet);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('\n');
        throw new Error(`${file} drifted from ScheduleSheetSchema:\n${issues}`);
      }
    }
  });
});
