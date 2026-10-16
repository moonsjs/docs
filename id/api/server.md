# `@moonsjs/server`

`serverFn`, registry, handler RPC `env` dan stub client 

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

- Hanya boleh dideklarasikan di `*.server.ts(x)`; tanpa meta injeksi plugin → `E_INTERNAL`.
- Dipanggil server-side (loader): in-process memakai `ctx` dari AsyncLocalStorage
 (`runWithContext` di runtime SSR) — tanpa HTTP; validasi input+output 
- Schema memakai [Standard Schema](https://github.com/standard-schema/standard-schema)
  (zod ≥3.24 / v4, valibot, dst.).

## Registry 

```ts
const __moons_registry: Map<string, FnRegistryEntry>;
function __moons_lookup(hash: string): FnRegistryEntry | undefined;
function __moons_callInProcess<I = unknown, O = unknown>(hash: string, input: I, ctx?: Ctx): Promise<O>;
```

```ts
interface FnRegistryEntry {
  hash: string; file: string;        // posix relatif project root
  exportName: string; line: number;  // untuk pesan error
  handler: (args: { input: unknown; ctx: Ctx }) => Promise<unknown>;
  input: StandardSchemaV1; output: StandardSchemaV1;
}
```

`__moons_callInProcess` = jalur (lookup → validasi → handler → validasi).

## Konteks request

```ts
function runWithContext<T>(ctx: Ctx, fn: () => T): T;   // dipakai runtime SSR
function getCurrentContext(): Ctx | undefined;
```

## `env` 

```ts
function env<T = string>(key: string): T;   // process.env / Bun.env
function isClientRuntime(): boolean;        // tidak ada `process`
```

Dipanggil di client → `E_ENV_IN_CLIENT` (guard runtime; build-time rejection
oleh transform). Key tidak ada → `undefined` (di-cast ke `T`).

## RPC handler — dipakai `@moonsjs/vite/server`

```ts
function createRpcHandler(options?: { security?: { originWhitelist?: string[]; bodyLimitBytes?: number } })
  : (request: Request, hash: string, ctx: Ctx) => Promise<Response>;
```

Alur & status: method ≠ POST → 405 · tanpa `x-moons: 1` → 400 `E_RPC_MISSING_HEADER` ·
Origin asing → 403 `E_RPC_BAD_ORIGIN` · body > limit → 413 `E_RPC_BODY_TOO_LARGE` ·
devalue invalid → 400 `E_RPC_INVALID_INPUT` · hash tak dikenal → 404 `E_INTERNAL` ·
input gagal schema → 400 `E_RPC_INVALID_INPUT` · handler error → 500 (production:
pesan generik) · output gagal schema → 500 `E_RPC_INVALID_OUTPUT` · sukses →
`200 application/x-moons` body devalue. Origin tanpa header = klien non-browser
(diizinkan); localhost diizinkan saat non-production.

## Stub client — subpath `@moonsjs/server/client`

```ts
function __moons_createStub<I extends StandardSchemaV1, O extends StandardSchemaV1>(
  args: { hash: string; input: I; output: O },
): ServerFn<I, O>;
```

Dipakai stub hasil transform Saat dipanggil: validasi input (client) →
bila `globalThis.__moons_ssr === true` dan hook tersedia → in-process →
selain itu `POST /_moons/fn/<hash>` (`x-moons: 1`, `application/x-moons`) →
validasi output (client).

## Validasi Standard Schema

```ts
function validateSchema<S extends StandardSchemaV1>(schema: S, value: unknown)
  : Promise<{ ok: true; value: InferOutput<S> } | { ok: false; issues: string[] }>;
```

## Catatan internal

- Prefiks `__moons_` = internal framework; stub memakai subpath `/client`
  agar handler server tidak ikut ke bundle client.
- Race `serverFn` tanpa ctx aktif → `E_INTERNAL` dengan saran memanggil dari loader.
