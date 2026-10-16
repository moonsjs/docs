---
description: "Plugin yang dieksekusi penuh: addRoute/addMiddleware (observasi), extendContext, onStart/onReady/onShutdown."
---

# Panduan: plugin & lifecycle

Plugin adalah API ekstensi framework — dipakai library/tooling,
bukan aplikasi biasa. Bentuknya sempit dan **dieksekusi penuh**:

```ts
// moons.config.ts
export default defineConfig({
  routesDir: "src/routes",
  context: async () => ({}),
  plugins: [
    {
      name: "contoh",
      // Observasi route hasil scan (objek beku).
      addRoute: (route) => console.log("route:", route.path),
      // Observasi middleware pada rantai final.
      addMiddleware: (mw) => console.log("mw:", typeof mw),
      // Daftarkan extender ctx: dipanggil per request, hasil objek di-merge.
      extendContext: (register) => {
        register((ctx) => ({ mulai: Date.now() }));
      },
      onStart: async (app) => {
        app.version; // opaque: ready/version
      },
      onReady: async () => {},
      onShutdown: async () => {},
    },
  ],
});
```

Urutan eksekusi: `addRoute` (per route) → `addMiddleware` (per middleware) →
`extendContext` (registrasi) → `onStart` (sebelum listen) → `onReady`
(sesudah listen) → `onShutdown` (setelah drain, sebelum exit; ikut batas
waktu drain).

- Key plugin di luar bentuk → build gagal `E_CONFIG_INVALID` ("lebih dari
  itu ditolak").
- Injeksi middleware oleh plugin belum ada di v1 — `addMiddleware` bersifat
  observasi.
- Dev dan produksi mengeksekusi lifecycle yang sama (dev: sekali saat request
  pertama; shutdown saat dev server ditutup).
