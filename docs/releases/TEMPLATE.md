# Release Notes Template

**Spec**: 004-multi-platform-expansion, Task T063.
Copy this file (e.g. `docs/releases/v0.6.0.md`) or paste the skeleton into the
GitHub Release body. Fill every section, delete the HTML guidance comments.

---

<!--
  Version + date of the release. For desktop releases also make sure the
  auto-update feed metadata (electron-updater channel) matches this version.
-->
# Masar X <version> - <YYYY-MM-DD>

## Summary

<!-- 2-4 sentences: what this release delivers and who it is for. -->

## Shipped user stories

<!-- One row per user story that shipped. Reference task IDs from
     specs/004-multi-platform-expansion/tasks.md so the traceability
     matrix stays honest. -->
| Story | What shipped | Tasks | Platforms |
| --- | --- | --- | --- |
| US? | <one-line description> | T0xx-T0xx | Web / Desktop / Mobile |

## Platforms

<!-- Mark status per surface; call out anything platform-specific
     (signing status, update channel, store submission state). -->
- **Web**: <deployed / not in this release> - <deploy URL or commit sha>
- **Desktop**: <version> - installer + portable; auto-update channel <channel>; signing status (e.g. unsigned - SmartScreen "Run anyway" expected until the EV cert lands)
- **Mobile**: <status - internal build / store submission / not shipped this release>

## Known issues

<!-- Link issues; include a workaround when one exists. -->
- #<issue> - <short description> - workaround: <... | none>

## Deferred (with reason)

<!-- Everything planned-but-not-shipped MUST land here with a reason.
     Mark [external-dependency] items explicitly (audit requirement). -->
| Item | Reason | Follow-up |
| --- | --- | --- |
| <item> | <reason, e.g. [external-dependency] cert acquisition pending> | <issue # / spec phase> |

## Security & performance notes

<!-- Required when the release touches auth, secrets, or platform builds. -->
- gitleaks artifact scan: <green | findings + resolution>
- Dependabot triage status (flagged per T066): <...>
- Perf deltas vs baselines (`docs/perf/baselines.md`): <...>
- Lighthouse Performance / Accessibility vs baseline (repo variables): <...>

## Verification

<!-- Evidence that this release was actually validated. -->
- Build: <status per platform>
- Typecheck / lint / tests: <status>
- Smoke evidence: <link to the smoke-test report or screenshots>

## Next planned

<!-- The next user story / milestone and its target, so readers know
     what to expect next. -->
- Next: <user story / milestone> - target <date / milestone>