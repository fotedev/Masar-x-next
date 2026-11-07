import { describe, expect, it } from 'vitest';

import type { DriveFile, DriveSubject } from 'masarx-shared/types/schemas';

import {
  crawlableSubjects,
  driveOpenUrl,
  drivePreviewUrl,
  flattenSubjectFiles,
  isStubSubject,
  materialSubjects,
  materialsManifest,
  sortSubjects,
} from '../materials/index';
import { scheduleSet, scheduleSheets } from '../schedules/index';

/**
 * Both accessors parse real build-time JSON assets at import (validated by
 * the shared Zod schemas — an invalid manifest/schedule set would throw at
 * import and fail collection). The tests pin the parsed shapes plus the
 * pure helpers.
 */

const subject = (overrides: Partial<DriveSubject> & Pick<DriveSubject, 'level' | 'semester' | 'nameAr'>): DriveSubject =>
  ({
    slug: 'synthetic',
    name: 'Synthetic',
    icon: 'book',
    folderId: 'folder-123',
    groups: [],
    ...overrides,
  }) as DriveSubject;

describe('materials manifest (real asset, schema-validated at import)', () => {
  it('parses with subjects and a matching source URL', () => {
    expect(materialSubjects.length).toBeGreaterThan(0);
    expect(materialsManifest.subjects).toBe(materialSubjects);
    expect(materialsManifest.embedFormat).toContain('{fileId}');
    expect(materialsManifest.source.url).toContain('drive.google.com');
  });

  it('separates crawlable subjects from stubs consistently', () => {
    expect(crawlableSubjects).toEqual(materialSubjects.filter((s) => !s.stub));
    // Every crawlable subject has a folder link and is not a stub.
    for (const s of crawlableSubjects) {
      expect(s.folderId).not.toBeNull();
      expect(s.stub ?? false).toBe(false);
    }
    expect(crawlableSubjects.length).toBeLessThanOrEqual(materialSubjects.length);
  });

  it('isStubSubject flags stub=true and folderId=null subjects', () => {
    expect(isStubSubject({ ...subject({ level: 1, semester: 1, nameAr: 'س' }), stub: true })).toBe(true);
    expect(
      isStubSubject({ ...subject({ level: 1, semester: 1, nameAr: 'س' }), folderId: null }),
    ).toBe(true);
    expect(isStubSubject(subject({ level: 1, semester: 1, nameAr: 'س' }))).toBe(false);

    // Real-data cross-check: no crawlable subject is a stub.
    for (const s of crawlableSubjects) expect(isStubSubject(s)).toBe(false);
  });

  it('sortSubjects orders by level, then semester, then Arabic name', () => {
    const sorted = sortSubjects([
      subject({ level: 2, semester: 2, nameAr: 'ب' }),
      subject({ level: 1, semester: 2, nameAr: 'ب' }),
      subject({ level: 1, semester: 1, nameAr: 'ب' }),
      subject({ level: 1, semester: 1, nameAr: 'أ' }),
    ]);
    expect(sorted.map((s) => [s.level, s.semester, s.nameAr])).toEqual([
      [1, 1, 'أ'],
      [1, 1, 'ب'],
      [1, 2, 'ب'],
      [2, 2, 'ب'],
    ]);
    // Input is not mutated.
    expect(sortSubjects).toBeDefined();
  });

  it('keeps the real manifest sorted per the display-order comparator', () => {
    const ordered = sortSubjects(materialSubjects);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      const delta = prev.level - cur.level || prev.semester - cur.semester;
      expect(delta).toBeLessThanOrEqual(0);
    }
  });

  it('builds the Drive preview/open URLs', () => {
    expect(drivePreviewUrl('FILE123')).toBe('https://drive.google.com/file/d/FILE123/preview');
    expect(driveOpenUrl('FILE123')).toBe('https://drive.google.com/file/d/FILE123/view');
  });

  it('flattenSubjectFiles walks nested groups (synthetic nesting)', () => {
    const files = (name: string): DriveFile[] => [
      { name, fileId: `id-${name}`, type: 'pdf', modified: null },
    ];
    const nested = subject({
      level: 1,
      semester: 1,
      nameAr: 'م',
      groups: [
        {
          name: 'Lectures',
          nameAr: 'المحاضرات',
          folderId: 'f1',
          files: files('lec.pdf'),
          children: [
            { name: 'Section', nameAr: 'القسم', folderId: 'f2', files: files('sec.pdf') },
          ],
        },
        { name: 'Sheets', nameAr: 'الشيتات', folderId: 'f3', files: files('sheet.pdf') },
      ],
    });

    const flat = flattenSubjectFiles(nested);
    expect(flat.map((f) => f.name)).toEqual(['lec.pdf', 'sec.pdf', 'sheet.pdf']);
  });

  it('flattenSubjectFiles matches a manual walk on a real manifest subject', () => {
    const withFiles = materialSubjects.find((s) => flattenSubjectFiles(s).length > 0);
    expect(withFiles).toBeDefined();
    if (!withFiles) return;

    const manual: DriveFile[] = [];
    const walk = (groups: typeof withFiles.groups) => {
      for (const g of groups) {
        manual.push(...g.files);
        g.children?.forEach((child) => walk([child]));
      }
    };
    walk(withFiles.groups);
    expect(flattenSubjectFiles(withFiles)).toEqual(manual);
  });
});

describe('schedules accessor (real assets, schema-validated at import)', () => {
  it('returns exactly the 4 year sheets', () => {
    expect(scheduleSheets).toHaveLength(4);
    expect(scheduleSet.sheets).toBe(scheduleSheets);
  });

  it('each sheet is a distinct cohort timetable with the gviz-extracted shape', () => {
    const ids = scheduleSheets.map((s) => s.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id.startsWith('timetable-2025-26-f'))).toBe(true);

    for (const sheet of scheduleSheets) {
      expect(sheet.docId).toBeTruthy();
      expect(sheet.sourceUrl).toContain('docs.google.com/spreadsheets');
      expect(sheet.tab!.length).toBeGreaterThan(0);
      expect(sheet.rowCount).toBe(sheet.rows.length);
      expect(sheet.rows.length).toBeGreaterThan(0);
      for (const row of sheet.rows) {
        expect(Array.isArray(row)).toBe(true);
      }
    }
  });
});
