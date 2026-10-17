---
title: Form Submission + Revalidation
description: Submit a form to a server function, then re-run the page's loaders with fresh data.
planned: true
---

This recipe covers the full mutation loop, from form submit to an updated list in the UI. This page is planned content and is not written yet.

What this page will cover:

- Handling the form submit and calling a `serverFn`
- Validating with one schema on both sides
- Calling `refresh()` so the page re-renders from fresh loader data
- Showing pending and error states during submission without blocking the UI
- Guarding against duplicate submits and accidental double mutations
