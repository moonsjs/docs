---
title: Protected Route
description: Cookie sessions, loader guards, and server-side checks for a login-protected page.
planned: true
---

This recipe shows the canonical cookie to context to guard pattern end to end. This page is planned content and is not written yet.

What this page will cover:

- Parsing a session cookie in `context(req)` and exposing it as `ctx`
- Guarding a loader with `redirect("/login")` when the session is missing
- Checking the session inside serverFn handlers for mutations
- A layout that shows the signed-in state and a logout control
- What must stay server-side in the flow
