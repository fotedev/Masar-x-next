/**
 * Static Drive-materials manifest accessor (spec 033).
 *
 * The manifest is sync-maintained by the drive-materials sandbox tooling
 * (`sandbox/drive-materials/tools/sync-drive.mjs`) and copied here as a
 * build-time asset — no DB tables, no admin surface. Subjects with
 * `folderId: null` are stubs (no Drive folder link yet) and render a
 * coming-soon state.
 */
import rawManifest from "./manifest.json";
import {
  DriveManifestSchema,
  type DriveManifest,
  type DriveSubject,
  type DriveFile,
  type DriveGroup,
} from "masarx-shared/types/schemas";

export type { DriveManifest, DriveSubject, DriveFile, DriveGroup };

const parsed = DriveManifestSchema.safeParse(rawManifest);
if (!parsed.success) {
  throw new Error(`Invalid materials manifest: ${parsed.error.message}`);
}

export const materialsManifest: DriveManifest = parsed.data;

export const materialSubjects: DriveSubject[] = materialsManifest.subjects;

/** Subjects that have a real Drive folder (stubs excluded). */
export const crawlableSubjects = materialSubjects.filter((s) => !s.stub);

export function isStubSubject(subject: DriveSubject): boolean {
  return subject.stub === true || subject.folderId === null;
}

/** Sort: level asc, then semester asc, then Arabic name (stable display order). */
export function sortSubjects(subjects: DriveSubject[]): DriveSubject[] {
  return [...subjects].sort(
    (a, b) =>
      a.level - b.level ||
      a.semester - b.semester ||
      a.nameAr.localeCompare(b.nameAr, "ar"),
  );
}

export function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function driveOpenUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Every file in a subject, flattened across (nested) groups — used by tests. */
export function flattenSubjectFiles(subject: DriveSubject): DriveFile[] {
  const out: DriveFile[] = [];
  const walk = (groups: DriveGroup[]) => {
    for (const g of groups) {
      out.push(...g.files);
      if (g.children) walk(g.children);
    }
  };
  walk(subject.groups);
  return out;
}
