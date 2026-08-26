## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor / internal cleanup
- [ ] Documentation only

## What changed

<!-- Bullet list of the notable changes. Link related issues/specs. -->

## How was this tested?

<!-- Describe the verification you performed. Paste command output where useful. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] Manually verified in the running app

## Contributor checklist

- [ ] New environment variables are documented in `.env.example` with scope comments; no real secrets committed
- [ ] Changes touching `packages/shared/` state whether a cross-platform contract is affected ([contracts](../specs/004-multi-platform-expansion/contracts/README.md))
- [ ] Spec-affecting changes update the relevant files under `specs/`
- [ ] I have read and followed the [Code of Conduct](../CODE_OF_CONDUCT.md) and [Contributing guide](../CONTRIBUTING.md)
