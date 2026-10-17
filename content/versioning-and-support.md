---
title: Versioning and Support
description: How Moons versions and deprecates its packages, what 0.x means, the criteria for 1.0, and how to report security issues.
---

Moons ships as a set of npm packages with a public policy for version numbers, deprecations, and support. This page summarizes it so you can decide when and how to upgrade.

## Version policy

- **MAJOR** — breaking changes to the public contract: signatures, payload shapes, and observable error behavior.
- **MINOR** — additive features: new APIs, config options, and CLI tools.
- **PATCH** — bug fixes with no contract change, including security fixes.

Releases historically moved in aligned waves: core, server, react, vite, and cli on the same MINOR, with mcp on its own line. Since 0.7.0, only the packages that changed are released, so versions differ across packages. Package dependency ranges always point at a compatible release of their siblings, and the scaffolder writes ranges that match what is actually published.

## Deprecation

A public API that will be removed is marked `@deprecated` and emits a one-time runtime warning. It is kept for at least one full MINOR release before removal. Every deprecation and removal is recorded in the package's CHANGELOG and in the documentation. New or changed error codes are registered in the error catalog, which `moons errors` prints ([CLI](/api/cli)).

## What 0.x means

Before 1.0, the usual allowance for 0.x releases applies: a MINOR release can change behavior in a breaking way when the change closes a gap in the boundary. Moons holds itself to more than the letter of that rule:

- Every breaking change ships with a migration guide, a CHANGELOG entry, and error suggestions that name the replacement.
- The core signatures have not broken since 0.2.0, and keeping them stable across two consecutive MINOR releases is one of the criteria for 1.0.

If you deploy Moons today, pin the versions you run and read the CHANGELOG before upgrading.

## The criteria for 1.0

Moons reaches 1.0 when all of the following hold:

- The public API signatures stay stable across two consecutive MINOR releases.
- The security test corpus and the full test suite pass on two consecutive releases.
- The agent-first evaluation suite meets its success, time, and safety targets on two consecutive rounds.
- The deprecation policy has run through one full cycle.
- Every runtime in the supported matrix (Bun and Node) is tested in CI.
- Releases are reproducible end to end — Trusted Publishing with provenance, no undocumented manual steps.
- Every package has a security policy and a changelog, and the documentation has no placeholder pages.

## Is Moons production-ready?

Honest answer: usable today with care, not finished. Moons is 0.x, and the request and data boundaries are still open work — [Security and Verification](/security-and-verification) lists exactly which guarantees are done and which are not. The core signatures have been stable since 0.2.0, but a MINOR release before 1.0 can still change behavior when the change strengthens the boundary; those changes always arrive with a migration guide.

What that means in practice:

- Pin the versions you deploy, and read the CHANGELOG before upgrading.
- This documentation site is itself a Moons app, built as a static export, so the framework is exercised by the project's own workflow.
- If your threat model requires all three guarantees verified today, wait for the criteria above to be met.

## Support and security

- **Security fixes** go to the latest MINOR release line. Older lines are patched only when the issue also affects the current line.
- **Report vulnerabilities privately** through the advisory link in each package's security policy; do not open a public issue. The policy also lists what is in scope and out of scope.

| Package | Security policy | Changelog |
| --- | --- | --- |
| `@moonsjs/core` | [SECURITY.md](https://github.com/moonsjs/core/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/core/blob/main/CHANGELOG.md) |
| `@moonsjs/server` | [SECURITY.md](https://github.com/moonsjs/server/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/server/blob/main/CHANGELOG.md) |
| `@moonsjs/react` | [SECURITY.md](https://github.com/moonsjs/react/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/react/blob/main/CHANGELOG.md) |
| `@moonsjs/vite` | [SECURITY.md](https://github.com/moonsjs/vite/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/vite/blob/main/CHANGELOG.md) |
| `@moonsjs/cli` | [SECURITY.md](https://github.com/moonsjs/cli/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/cli/blob/main/CHANGELOG.md) |
| `@moonsjs/mcp` | [SECURITY.md](https://github.com/moonsjs/mcp/blob/main/SECURITY.md) | [CHANGELOG.md](https://github.com/moonsjs/mcp/blob/main/CHANGELOG.md) |
