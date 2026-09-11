# Data Model: Desktop Study Workspace & Native Shell

**Feature**: 005-desktop-study-workspace | **Date**: 2026-09-10
**Scope note**: This feature introduces **no database changes** — no tables, columns, or
migrations. All entities below are in-memory TypeScript shapes (`apps/web/src/components/desktop/workspace/types.ts`)
mapped from existing Supabase-backed data (subjects / summaries), per constitution II.

## Entities

### WorkspaceLecture (`types.ts`)

One selectable item in the lecture list column. Shape maps from the existing subject/summary
queries — no new schema.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | existing lecture/summary identifier | stable React key |
| `title` | `string` | existing display title | shown in list row + reader toolbar |
| `ordinal` | `number` | existing ordering | list sort order |
| `documentUrl` | `string?` | existing document URL | absent → reader "no document" state (FR-009) |
| `duration` | `number?` | optional metadata | display only |

Validation: constructed from server data already validated by the platform's existing
queries; the workspace performs no additional Zod validation (no new data crosses a trust
boundary — it is re-shaped, not re-fetched).

### WorkspaceSelection (`types.ts`) — the transient workspace state

| Field | Type | Notes |
|---|---|---|
| `lectureId` | `string \| null` | `null` → reader shows its pick-a-lecture invitation (FR-009, scenario 6) |
| `assistantOpen` | `boolean` | panel expanded state (FR-005); toggle appearance reflects it |

### StudyWorkspaceProps (`types.ts`)

| Prop | Type | Notes |
|---|---|---|
| `subjectName` | `string` | workspace heading (subject display name) |
| `lectures` | `WorkspaceLecture[]` | empty array → list-column empty state (FR-009) |
| `initialLectureId?` | `string` | optional deep-link preselection |

## Relationships

```text
Subject (existing DB entity) 1 ──── N WorkspaceLecture (UI projection)
WorkspaceSelection ──selects──> WorkspaceLecture (0..1)
WorkspaceSelection ──scopes──> AssistantPanel (scope text = active lecture title; FR-006)
```

The assistant conversation itself remains the platform's existing `ai_chat_messages` storage;
this feature only supplies placement, collapse behaviour, and the lecture scope label. It does
not change how the assistant answers or what it persists (spec Assumptions).

## State transitions

```text
Workspace load
  └─> selection = null            reader: invitation copy; list: no active row
        │ select lecture L
        ▼
  selection = L, assistant = kept open/closed as-is
        │ select lecture M        (in-place swap — no navigation, FR-003)
        ▼
  selection = M                   reader swaps content; active row moves;
                                  assistant scope label updates if open (FR-006)
        │ toggle assistant
        ▼
  assistantOpen flips             panel width animates (w-0 overflow-hidden ↔ w-96);
                                  reader reclaims/expands width (FR-005)
```

Failure/empty sub-states (each must not collapse the layout, FR-009):

- `lectures.length === 0` → list column renders its empty state.
- selected lecture has no `documentUrl` → reader states it plainly.
- document load failure → reader retry affordance; rest of workspace usable.

## Persistence & lifecycle

- **Not persisted.** Selection and panel state are session-scoped React state inside
  `StudyWorkspace.tsx` (spec: "Session-scoped; not persisted by this feature"). A reload
  returns to the empty-selection state unless `initialLectureId` was provided.
- **No server round-trips** are added by selection switching; the reader renders from the
  already-fetched lecture list data.
