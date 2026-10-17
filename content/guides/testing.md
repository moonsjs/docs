---
title: Testing
description: The practical path for testing routes, server functions, and production builds.
planned: true
---

Tests keep the server/client contract honest as an app grows. This page is planned content and is not written yet.

What this page will cover:

- In-process request tests with `createTestServer`, following the starter template's `test/example.test.ts`
- Running the suite with `bun test` and asserting SSR markup, status codes, and response headers
- Testing loader output and `serverFn` input/output validation without touching the network
- Verifying a production build, including prerendered pages and smoke checks
- Running the same checks in continuous integration
