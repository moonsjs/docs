# `@moonsjs/cli`

Bin `moons`. Jalankan via `bunx --package @moonsjs/cli moons <command>`
(atau `moons` bila CLI terpasang sebagai devDependency).

## Perintah

| Perintah | Perilaku |
|---|---|
| `moons create <name>` | Scaffold dari template bawaan: copy (exclude `node_modules/dist/.moons/.git`), rewrite `name` di package.json, tulis `.gitignore`, jalankan `bun install` (dilewati bila target anggota workspace), print instruksi. Target non-kosong → error |
| `moons dev` | Dev server Vite (HMR + SSR), port `PORT` env (default 3000), `--strictPort`; SIGTERM/SIGINT diteruskan ke proses Vite. |
| `moons build` | `vite build` → `vite build --ssr` (bin vite di-resolve dari cwd ke atas, dijalankan dengan runtime saat ini). Output `dist/client/**` + `dist/server/index.js`; leak check canary berjalan di dalam build bila `leakTest.canary` disetel. |
| `moons start` | Load `dist/server/index.js` in-process; PORT/3000; HTML+static+RPC+health; SIGTERM → drain. |
| `moons typegen` | `loadConfigFromFile` + `validateConfig` + `generateTypes` → `.moons/*.d.ts`. |
| `moons help` / `--help` | Usage. |

Exit code: `0` sukses; `1` error (format untuk `MoonsError`, stack untuk
error tak terduga); `dev` meneruskan exit code proses Vite.

## `moons audit`

`moons audit [--json] [--strict] [--canary <nilai>]` — audit keamanan read-only:

- `rpc-inventory` — semua endpoint `serverFn` (file#export) yang bisa dipanggil siapa pun.
- `env-access` — kunci `env()` yang dibaca tiap file server.
- `cookie-flags` — peringatan `setCookie()` tanpa `HttpOnly`/`Secure`/`SameSite`.
- `headers-csp` — peringatan bila `headers` tanpa CSP, atau memakai `unsafe-inline`/`unsafe-eval`.
- `deploy-kit` — ringkasan header/redirect/sitemap/robots yang dikonfigurasi.
- `dist-scan` — memindai `dist/client/**` untuk nilai env mirip-rahasia + canary; **gagal** bila bocor.

Exit code `1` saat ada kegagalan (`--strict` juga menggagalkan peringatan). Dengan `--json`, stdout satu dokumen JSON dan stderr sunyi — aman untuk CI dan agen.

## Export programatik

```ts
runCli(argv, cwd?): Promise<number>;
parseCommand(argv): { command: CliCommand; args: string[] } | null;
CLI_COMMANDS: readonly CliCommand[];          // create|dev|build|start|typegen

scaffoldProject({ targetDir, templateDir, name }): { packageName };
detectWorkspaceRoot(targetDir): string | null;
matchesWorkspacePattern(relativePath, pattern): boolean;
resolveViteBin(cwd): string;
repoRoot: string; templateDir: string;        // v1: berbasis lokasi source repo
```

## Batasan

- `create` di dalam workspace melewati `bun install` (dependensi dari workspace).
- Direktori target harus kosong; file yang ada tidak pernah ditimpa.
