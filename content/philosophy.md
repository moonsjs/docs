---
title: What Moons Refuses, and Why
description: The features Moons deliberately leaves out, the reason behind each refusal, and the pattern that replaces it.
---

Every framework refuses something; Moons is explicit about what it refuses. The refusals are not a gap in the roadmap — they follow from the one thing the framework is built to guarantee: a server/client boundary you can verify from the build output. Features that blur where code runs, or move decisions into bundler magic, weaken that verification. Here is each refusal, the reason, and the pattern that replaces it.

## No React Server Components

RSC moves the server/client line from the file system into directives and bundler analysis. That makes the boundary harder to inspect: the build output no longer tells you, at a glance, which module shipped to the browser. Moons keeps the line in a file name — `*.server.ts` is server-only, everything else a route imports is client code, and crossing the line fails the build. Data comes from loaders and mutations from `serverFn` calls ([serverFn](/core-concepts/server-fn), [Loaders](/core-concepts/loaders)).

## No streaming SSR — deferred, not rejected

Streaming is on the post-1.0 backlog as an opt-in per route; it is not a refusal. The reason for the delay is the boundary: a streamed document splits rendering and data delivery into pieces, and each piece has to keep the same server/client contract. Today the document is rendered completely before it is sent, and pending UI comes from `useNavigation()` ([Navigation & Search Params](/core-concepts/navigation)).

## No ORM, auth, or session system

Data access and identity are where secrets actually live. A built-in layer would either hide which side runs a query, or ship a session model that has to cross the boundary. Moons provides the primitives instead: bring your own driver in a `*.server.ts` module and query through `serverFn` ([Working with Databases](/guides/databases)); read a signed cookie in `context(req)` and guard loaders and handlers yourself ([Authentication](/guides/authentication)).

## No edge or serverless adapters

Every deployment target multiplies the environments the boundary must hold in, and an adapter package becomes a second implementation of the same rules. Moons builds one server that runs on Bun and Node with the same request pipeline, and prerendered paths can be served by any static host ([Deployment](/guides/deployment)).

## No image or font optimization

Optimization pipelines add build-time magic and one more layer whose output you have to trust. Images and fonts are ordinary assets here: `<img>` with explicit dimensions, CSS, and self-hosted or system fonts. None of it crosses the server/client boundary, so the framework does not manage it.

## No form actions

A framework-managed form action couples a submission to a server function implicitly — the call site no longer shows that a boundary is being crossed. Moons keeps mutations explicit: validate input, call a `serverFn`, then `refresh()`. A native form posting to a `src/api` route keeps the no-JavaScript path ([Forms & Mutations](/guides/forms)).

## What the refusals buy

Each one keeps the boundary legible: a file name you can see, a build error that names the file and line, and an artifact you can scan. That is the trade Moons makes instead of feature parity. [Architecture](/architecture) explains the enforcement layers; [Zero-Trust Model](/core-concepts/zero-trust) covers what stays your responsibility.
