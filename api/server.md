# `@moonsjs/server`

`serverFn`, registry, RPC handler, `env`, and the client stub

## `serverFn`

```ts
function serverFn<I extends StandardSchemaV1, O extends StandardSchemaV1>(
  config: ServerFnConfig<I, O>,
): ServerFn<I, O>;
```

```ts
interface ServerFnConfig<I, O> {
  input: I;
  output: O;
  handler: (args: { input: StandardSchemaV1.InferOutput<I>; ctx: Ctx })
    => Promise<StandardSchemaV1.InferOutput<O>>;
  // Injected plugin metadata (internal): __hash, __file, __line, __exportName
}

interface ServerFn<I, O> {
  (args: { input: StandardSchemaV1.InferInput<I> }): Promise<StandardSchemaV1.InferOutput<O>>;
  readonly __moons_server_fn: true;
  readonly hash: string;
}
```

- May only be declared in `*.server.ts(x)`; without the plugin-injected metadata
  → `E_INTERNAL`.
- Called server-side (from a loader): in-process, using the `ctx` from
  AsyncLocalStorage (`runWithContext` in the SSR runtime) — no HTTP; input and
  output are validated on both sides
- Schemas use [Standard Schema](https://github.com/standard-schema/standard-schema)
  (zod ≥3.24 / v4, valibot, etc.).

## Registry

```ts
const __moons_registry: Map<string, FnRegistryEntry>;
function __moons_lookup(hash: string): FnRegistryEntry | undefined;
function __moons_callInProcess<I = unknown, O = unknown>(hash: string, input: I, ctx?: Ctx): Promise<O>;
```

```ts
interface FnRegistryEntry {
  hash: string; file: string;        // posix relatif project root
  exportName: string; line: number;  // for error messages
  handler: (args: { input: unknown; ctx: Ctx }) => Promise<unknown>;
  input: StandardSchemaV1; output: StandardSchemaV1;
}
```

`__moons_callInProcess` = the path (lookup → validate → handler → validate).

## Request context

```ts
function runWithContext<T>(ctx: Ctx, fn: () => T): T;   // used by the SSR runtime
function getCurrentContext(): Ctx | undefined;
```

## `env`

```ts
function env<T = string>(key: string): T;   // process.env / Bun.env
function isClientRuntime(): boolean;        // no `process`
```

Called in the client → `E_ENV_IN_CLIENT` (runtime guard; build-time rejection
by the transform). Missing key → `undefined` (cast to `T`).

## RPC handler — used by `@moonsjs/vite/server`

```ts
function createRpcHandler(options?: { security?: { originWhitelist?: string[]; bodyLimitBytes?: number } })
  : (request: Request, hash: string, ctx: Ctx) => Promise<Response>;
```

Flow & statuses: method ≠ POST → 405 · no `x-moons: 1` → 400 `E_RPC_MISSING_HEADER` ·
foreign Origin → 403 `E_RPC_BAD_ORIGIN` · body > limit → 413 `E_RPC_BODY_TOO_LARGE` ·
invalid devalue → 400 `E_RPC_INVALID_INPUT` · unknown hash → 404 `E_INTERNAL` ·
input fails the schema → 400 `E_RPC_INVALID_INPUT` · handler error → 500 (production:
generic message) · output fails the schema → 500 `E_RPC_INVALID_OUTPUT` · success →
`200 application/x-moons` with a devalue body. No Origin header = a non-browser
client (allowed); localhost is allowed when non-production.

## Client stub — the `@moonsjs/server/client` subpath

```ts
function __moons_createStub<I extends StandardSchemaV1, O extends StandardSchemaV1>(
  args: { hash: string; input: I; output: O },
): ServerFn<I, O>;
```

Used by the transform-generated stub. When called: input validation (client) →
if `globalThis.__moons_ssr === true` and the hook is available → in-process →
otherwise `POST /_moons/fn/<hash>` (`x-moons: 1`, `application/x-moons`) →
output validation (client).

## Standard Schema validation

```ts
function validateSchema<S extends StandardSchemaV1>(schema: S, value: unknown)
  : Promise<{ ok: true; value: InferOutput<S> } | { ok: false; issues: string[] }>;
```

## Internal notes

- The `__moons_` prefix = framework-internal; the stub uses the `/client`
  subpath so the server handler does not end up in the client bundle.
- Calling `serverFn` with no active ctx → `E_INTERNAL` with a suggestion to call
  it from a loader.
