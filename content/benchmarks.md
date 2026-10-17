---
title: Benchmarks
description: The measured numbers, what each one covers, the budgets that guard against regressions, and how to reproduce them.
---

Performance claims are easy to make and hard to trust. Moons publishes the numbers its benchmark suite measures, the budgets that keep regressions visible, and the commands to reproduce every value on your own machine.

## What is measured

One script measures the numbers that matter for development speed and production cost, on one fixture (`url-policy`) so results stay comparable between runs:

| Metric | What it measures |
| --- | --- |
| transform throughput | `analyzeServerFile` throughput — the zero-trust transform that turns `*.server.ts` into client stubs. |
| `moons check` | The full verification pipeline: typegen → `tsc --noEmit` → client build → server build. |
| cold start | Time from launching the built server to `GET /_moons/health` answering `200`. |
| SSR throughput | Requests per second for `/` with 16 concurrent clients. |
| transport only | Requests per second for a bare handler with no routing or rendering, per transport. |
| client bundle | Total JavaScript bytes in `dist/client`. |

## Frozen results

The latest recorded run, from 2026-10-17 on Bun 1.4.2. The table of record is `quality/bench/RESULTS.md`; new releases append a new table instead of editing old ones, and the numbers below are one measurement, not a specification.

| Metric | Value | Budget |
| --- | --- | --- |
| transform throughput | 2388 ops/s | min 200 |
| `moons check` (typegen + tsc + 2 builds) | 3932 ms | max 120000 |
| cold start — Bun.serve (health 200) | 200 ms | max 8000 |
| SSR throughput — Bun.serve (`/`, 16 concurrent) | 577 req/s | min 30 |
| cold start — node:http (`MOONS_SERVER=node`) | 191 ms | max 8000 |
| SSR throughput — node:http (`/`, 16 concurrent) | 552 req/s | min 20 |
| transport only — Bun.serve (handler `ok`) | 12671 req/s | min 3000 |
| transport only — node:http (handler `ok`) | 10343 req/s | min 1500 |
| client bundle (JS bytes) | 234449 | max 5000000 |

### Bun.serve versus node:http

The built server runs on both runtimes and shares one request pipeline; only the HTTP layer differs. The same three rows, side by side:

| Metric | Bun.serve | node:http |
| --- | --- | --- |
| cold start (health `200`) | 200 ms | 191 ms |
| SSR throughput (`/`, 16 concurrent) | 577 req/s | 552 req/s |
| transport only (handler `ok`) | 12671 req/s | 10343 req/s |

## Reproducing the numbers

```bash
# from a checkout of the Moons repository
bun install
bun run build
bun quality/bench/bench.ts                  # human-readable table
bun quality/bench/bench.ts --json           # machine-readable
bun quality/bench/bench.ts --check          # compare against the recorded budgets
bun quality/bench/bench.ts --update-results # freeze a new table into the results file
MOONS_BENCH_FAST=1 bun quality/bench/bench.ts --check   # smaller measurement windows
```

`--check` exits non-zero when a value crosses its budget; CI runs it on every change. `MOONS_BENCH_FAST=1` shortens the measurement windows for quick local checks — expect noisier numbers.

## Reading the numbers honestly

- **They are machine-dependent.** CPU, disk, and background load move every value. Run the commands above on your own hardware before making decisions; treat the published table as a reference point.
- **Budgets are regression guards, not targets.** They are deliberately generous and exist to catch catastrophic regressions in CI, not to rank hardware.
- **The fixture is small on purpose.** It measures the framework's fixed costs, not your application. Your loaders, database, and traffic shape dominate real-world numbers.
