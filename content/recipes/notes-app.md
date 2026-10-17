---
title: Notes App
description: A small end-to-end app with a shared schema, a server store, loaders, and mutations working together.
planned: true
---

This recipe puts the core concepts together in one small app. This page is planned content and is not written yet.

What this page will cover:

- Sharing one schema between the client and the server
- A tiny in-memory store inside a `*.server.ts` module
- CRUD server functions with input and output validation
- A loader that lists notes and a client handler that adds a new one through a server function
- Revalidating the list with `refresh()` after each mutation
