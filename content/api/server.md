---
title: "@moonsjs/server"
description: serverFn, environment access, signed cookies, rate limiting, validation, and request-scoped helpers for server code.
---

`@moonsjs/server` is what `*.server.ts` files import from: server functions, environment access, signed cookies, rate limiting, and request-scoped helpers.

## serverFn

```ts
function serverFn<I extends StandardSchemaV1, O extends StandardSchemaV1>(config: {
  input: I;
  output: O;
  handler: (args: { input: StandardSchemaV1.InferOutput<I>; ctx: Ctx }) => Promise<StandardSchemaV1.InferOutput<O>>;
}): ServerFn<I, O>;
```

`serverFn` must live in a `*.server.ts(x)` file built with the `moons()` plugin. Called from a loader it runs in-process with the request's `ctx`; called from the browser it goes through the generated stub, so the handler body never enters the client bundle. Input is validated before the handler runs and the return value against `output`; any Standard Schema library works ([serverFn](/core-concepts/server-fn)).

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const addNote = serverFn({
  input: z.object({ title: z.string().min(1) }),
  output: z.object({ id: z.string(), title: z.string() }),
  handler: async ({ input }) => ({ id: crypto.randomUUID(), title: input.title }),
});
```

## env and isClientRuntime

```ts
function env<T = string>(key: string): T;
function isClientRuntime(): boolean;
```

`env(key)` reads `process.env`, populated by both Bun and Node; a missing key returns `undefined` cast to `T`. A call that reaches the client bundle fails the build, and the runtime guard throws `E_ENV_IN_CLIENT`; public values should use Vite's `import.meta.env.VITE_*` instead.

```ts
import { env } from "@moonsjs/server";

const databaseUrl = env<string>("DATABASE_URL");
```

## Session cookies

```ts
function signCookie(data: unknown, secret: string, options?: SignCookieOptions): Promise<string>;
function verifyCookie<T = unknown>(token: string | null | undefined, secret: string, options?: VerifyCookieOptions): Promise<T | null>;
```

`signCookie` serializes `data` as JSON, signs it with HMAC-SHA256, and returns a `v1.<payload>.<signature>` token. `verifyCookie` returns the payload, or `null` for a tampered, malformed, or expired token, so a failed check reads as "not logged in" instead of throwing. Secrets shorter than 16 characters are rejected with `E_CONFIG_INVALID`.

| Option | Type | Used by | Default |
| --- | --- | --- | --- |
| `expiresIn` | `number` (seconds) | `signCookie` | no expiry |
| `now` | `() => number` | both | `Date.now` |

```ts
// src/server/session.server.ts
import { env, signCookie, verifyCookie } from "@moonsjs/server";

const secret = env<string>("SESSION_SECRET");

export async function createSession(userId: string) {
  return signCookie({ userId }, secret, { expiresIn: 86_400 });
}

export async function readSession(token: string) {
  return verifyCookie<{ userId: string }>(token, secret);
}
```

## Rate limiting

```ts
function createRateLimiter(options: RateLimiterOptions): RateLimiter;
```

| `RateLimiterOptions` | Type | Default |
| --- | --- | --- |
| `limit` | `number` | required |
| `windowMs` | `number` | required |
| `now` | `() => number` | `Date.now` |
| `maxKeys` | `number` | `10_000` |

`check(key)` records a request and returns `{ ok, remaining, retryAfterMs }`; `reset(key?)` clears one key or everything. State is a sliding window kept in memory, so one process owns its counters — for multiple instances, keep the state in a shared store. The store is bounded by `maxKeys` and evicts the oldest key first, so spoofed keys cannot grow memory without limit.

## Client IP

```ts
const CLIENT_IP_HEADER = "x-moons-client-ip";

function getClientIp(request: Request): string | null;
```

The runtime always overwrites this header on incoming requests, so `getClientIp(req)` is trustworthy for rate-limit keys and logs — never read `x-forwarded-for` directly.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { createRateLimiter, getClientIp } from "@moonsjs/server";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export default defineConfig({
  context: async () => ({}),
  middleware: [
    async ({ req, next }) => {
      const quota = limiter.check(getClientIp(req) ?? "unknown");
      if (!quota.ok) return new Response("Too Many Requests", { status: 429 });
      return next();
    },
  ],
});
```

## Request-scoped helpers

```ts
function cache<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R>;
function getCurrentContext(): Ctx | undefined;
```

`cache(fn)` runs once per request for repeated calls with the same arguments; outside a request it calls `fn` directly. `getCurrentContext()` returns the active request's `ctx`, or `undefined` outside one.

```ts
// src/server/flags.server.ts
import { cache } from "@moonsjs/server";

export const loadFlag = cache(async (name: string) => {
  const response = await fetch(`https://flags.example.com/${name}`);
  return (await response.json()) as { enabled: boolean };
});
```

## Validation and RPC mounting

```ts
function validateSchema<S extends StandardSchemaV1>(schema: S, value: unknown): Promise<
  { ok: true; value: StandardSchemaV1.InferOutput<S> } | { ok: false; issues: string[] }
>;

function createRpcHandler(options?: {
  security?: { originWhitelist?: string[]; bodyLimitBytes?: number };
}): (request: Request, hash: string, ctx: Ctx) => Promise<Response>;
```

`validateSchema` runs any Standard Schema validator, sync or async, reporting issues as strings instead of throwing. `createRpcHandler` is what the server runtime mounts to serve registered `serverFn`s by hash; application code rarely calls it directly.

## Types

| Type | Shape |
| --- | --- |
| `ApiHandlerArgs` | `{ req: Request; params: Record<string, string>; ctx: Ctx }` |
| `ApiMethod` | `"GET" \| "HEAD" \| "POST" \| "PUT" \| "PATCH" \| "DELETE" \| "OPTIONS"` |
| `ServerFn<I, O>` | Callable as `fn({ input })`; carries `__moons_server_fn` and `hash` |
| `FnRegistryEntry` | `hash`, `file`, `exportName`, `line`, handler, `input`/`output` schemas |
| `CookieOptions` | Re-exported from [@moonsjs/core](/api/core) |

`ApiHandlerArgs` is the argument shape for `src/api` handlers ([API Routes](/guides/api-routes)); `FnRegistryEntry` is the record stored for each declared `serverFn`, keyed by its hash.
