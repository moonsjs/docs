---
title: Working with Databases
description: Connecting to a database from server-only modules and querying it from serverFn handlers.
planned: true
---

Database clients hold credentials, so they belong on the server. This page is planned content and is not written yet.

What this page will cover:

- Creating a client or pool in a `*.server.ts` module and reusing it across requests
- Reading connection strings with `env()` and keeping them out of schemas and loaders
- Wrapping queries in `serverFn` so results are validated on both sides
- Where query types should live so the client stays type-safe without the driver
- Common pitfalls, such as importing a driver from a route or component
