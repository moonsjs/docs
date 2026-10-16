# `@moonsjs/cli`

Bin `moons` (RFC). v1 dijalankan dari repo:
`bun packages/cli/src/cli.ts <command>` — belum ada instalasi global/npm
(: scope npm & lisensi menunggu keputusan pemilik produk).

## Perintah

| Perintah | Perilaku |
|---|---|
| `moons create <name>` | Scaffold dari `examples/basic`: copy (exclude `node_modules/dist/.moons/.git`), rewrite `name` di package.json, tulis `.gitignore`, jalankan `bun install` (dilewati bila target anggota workspace), print instruksi. Target non-kosong → error |
| `moons dev` | Dev server Vite (HMR + SSR), port `PORT` env (default 3000), `--strictPort`; SIGTERM/SIGINT diteruskan ke proses Vite. |
| `moons build` | `vite build` → `vite build --ssr` (bin vite di-resolve dari cwd ke atas, dijalankan dengan runtime saat ini). Output `dist/client/**` + `dist/server/index.js`; leak check canary berjalan di dalam build bila `leakTest.canary` disetel. |
| `moons start` | Load `dist/server/index.js` in-process; PORT/3000; HTML+static+RPC+health; SIGTERM → drain. |
| `moons typegen` | `loadConfigFromFile` + `validateConfig` + `generateTypes` → `.moons/*.d.ts`. |
| `moons help` / `--help` | Usage. |

Exit code: `0` sukses; `1` error (format untuk `MoonsError`, stack untuk
error tak terduga); `dev` meneruskan exit code proses Vite.

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

## Batasan v1 (dicatat)

- Template & pemanggilan Vite mengasumsikan source monorepo (scaffold standalone
  menunggu paket dipublikasikan; lihat `../decisions/0006-m5-cli.md`).
- `create` di dalam workspace melewati `bun install` (dependensi dari workspace).
