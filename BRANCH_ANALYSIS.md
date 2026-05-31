# Cascade Branch Analysis: Useful Logic & Fixes

This document summarizes differences between `main` and each cascade branch, focusing on potentially useful logic, helper functions, and fixes to cherry-pick (excluding deleted page.tsx files).

---

## ⚠️ Important Finding: Architectural Refactoring Detected

**All 4 cascade branches contain a significant architectural change:**
- **Migrating from React Query (`@tanstack/react-query`) to a custom `queryCache` system**
- This is a **breaking architectural change** that affects many hooks
- **Recommendation**: Cherry-pick individual fixes only, NOT entire hook refactors

---

## Branch 1 & 2: React Query → Custom Cache Refactoring

### Branches
- `cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f`
- `cascade/commit-8d49eee-aboalayoun-aboalayoun-a279dc`

### Commit Pattern
- Both branches have identical snapshot: `b31d5a8` (2026-02-19T23:46:45Z)
- Automated cascade snapshots of the same commit

### ✅ Cherry-Pickable Changes

#### useQuizzes.ts
```typescript
// ❌ DON'T cherry-pick the full hook (uses custom cache)
// ✅ DO cherry-pick these specific changes:

// 1. Remove confirmToast dependency
-import { confirmToast } from "../lib/confirmToast";

// 2. Simplify quiz deletion confirmation (if confirmToast exists in your codebase):
-const confirmed = await confirmToast("Are you sure?", {
-  confirmLabel: "Delete",
-  cancelLabel: "Cancel",
-});
-if (!confirmed) return;

+if (!confirm("Are you sure?")) return;

// 3. Cache TTL optimization (if using queryCache):
-queryCache.set(cacheKey, quizData, cacheTTL.quizzes);
+queryCache.set(cacheKey, quizData, cacheTTL.summaries);
```

#### useVideos.ts - Major Refactor
```typescript
// ❌ DON'T cherry-pick - this is a full hook replacement:
// - Removes: @tanstack/react-query import
// - Removes: logger usage
// - Changes: useState/useCallback architecture
// - Adds: Custom queryCache integration

// ✅ USEFUL PATTERN: If you migrate to custom cache, this shows the pattern:
const cacheKeyBase = cacheKeys.videos ? cacheKeys.videos() : "videos";
const cacheKey = `${cacheKeyBase}:subject:${subject}`;

// Check cache first
if (!skipCache && queryCache.get) {
  const cached = queryCache.get<Video[]>(cacheKey);
  if (cached) {
    setVideos(cached);
    setLoading(false);
    return;
  }
}
// ... fetch ...
// Cache the result
if (queryCache.set) {
  queryCache.set(cacheKey, videoData, cacheTTL.summaries || 3600);
}
```

#### useSubjects.ts - Major Refactor
```typescript
// ❌ DON'T cherry-pick the full hook refactoring
// ✅ USEFUL PATTERN: Cache key generation with parameters:
const cacheKey = `${cacheKeyBase}:lvl:${effectiveLevel}:sem:${effectiveSemester}:anon:${isAnonymous ? 1 : 0}`;

// ✅ USEFUL PATTERN: Local state update + cache invalidation on mutations:
setSubjects(prev => prev.map(s => s.id === id ? { ...s, show_on_home: showOnHome } : s));
if (queryCache.delete) {
  queryCache.delete(cacheKey);
}
```

### ❌ NOT Recommended for Cherry-Pick

These files have systematic conflicts trying to restore deleted pages + custom cache refactoring:
- All hook files under `src/hooks/` attempting full React Query removal
- Architecture change too pervasive to extract partially

---

## Branch 3 & 4: Label/Accessibility Branch Name Pattern

### Branches
- `cascade/the-label-s-for-attribute-doesn-t-match-135f4c`
- `cascade/the-label-s-for-attribute-doesn-t-match-2876e7`

### ⚠️ WARNING: Branch Names Are Misleading

Despite "label" in the name, these branches:
- **Delete quiz components** (DeleteQuizDialog, PreviousExamsButton, QuizDeleteDialog, etc.)
- **Attempt to restore deleted pages** (same conflict pattern as other branches)
- **NOT** actually contain label/accessibility fixes

### Example Deletions Found:
- ❌ `src/app/[locale]/quizzes/_components/DeleteQuizDialog.tsx` (deleted)
- ❌ `src/app/[locale]/quizzes/_components/PreviousExamsButton.tsx` (deleted)  
- ❌ `src/app/[locale]/quizzes/_components/QuizDeleteDialog.tsx` (deleted)
- ❌ `src/app/[locale]/quizzes/_components/QuizzesEmptyState.tsx` (deleted)

**Recommendation**: ❌ **Skip these branches entirely** - they have the same problematic conflict pattern

---

## 📋 Summary: What to Cherry-Pick

| Change | Branch(es) | Recommendation | Effort |
|--------|-----------|-----------------|--------|
| **confirmToast → confirm()** | 93756f, a279dc | ✅ Pick | Low |
| **Cache TTL: quizzes → summaries** | 93756f, a279dc | ✅ Pick (if applicable) | Low |
| **React Query removal in hooks** | All | ❌ Skip | High |
| **Custom queryCache pattern** | 93756f, a279dc | ⚠️ Reference only | N/A |
| **Component deletions** | 135f4c, 2876e7 | ❌ Skip | N/A |
| **Label accessibility fixes** | 135f4c, 2876e7 | ❌ None found | N/A |

---

## How to Cherry-Pick Safely

### Step 1: Extract Single File Diffs
```bash
# Get just the confirmToast removal pattern
git diff main..cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f -- src/hooks/useQuizzes.ts
```

### Step 2: Apply Only Specific Hunks
```bash
# Use git apply with editing
git show cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f:src/hooks/useQuizzes.ts | \
  # Copy only the specific changes you want
```

### Step 3: Validate Changes
```bash
npm run typecheck  # Ensure types are valid
npm run lint       # Check code style
# Test manually to confirm the feature works
```

---

## Detailed Diff Commands

```bash
# Branch 93756f
git diff main..cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f -- src/hooks/useQuizzes.ts
git diff main..cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f -- src/hooks/useVideos.ts
git diff main..cascade/commit-8d49eee-aboalayoun-aboalayoun-93756f -- src/hooks/useSubjects.ts

# Branch a279dc (identical to 93756f)
git diff main..cascade/commit-8d49eee-aboalayoun-aboalayoun-a279dc -- src/hooks/

# Branches 135f4c & 2876e7 (NOT RECOMMENDED)
git diff main..cascade/the-label-s-for-attribute-doesn-t-match-135f4c --stat | head -20
```

---

## Verdict

✅ **Worth Cherry-Picking From Branches 93756f & a279dc**:
- Small, isolated changes (confirmToast removal, cache TTL updates)
- Low risk of conflicts
- Improves code simplicity

❌ **Not Recommended**:
- Full hook refactoring (React Query migration) - too invasive
- Branches 135f4c & 2876e7 - have systematic conflicts + misleading names
- Component deletions from any branch

**Next Step**: If you want specific fixes, run the git diff commands above and manually extract the hunks you need.
