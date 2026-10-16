---
description: "Fully executed plugins: addRoute/addMiddleware (observation), extendContext, onStart/onReady/onShutdown."
---

# Plugins & lifecycle

Plugins are the framework extension API — for libraries/tooling, not
regular apps. The shape is deliberately narrow and **fully executed**:

```ts
// moons.config.ts
export default defineConfig({
  routesDir: "src/routes",
  context: async () => ({}),
  plugins: [
    {
      name: "example",
      addRoute: (route) => console.log("route:", route.path),   // frozen, observation
      addMiddleware: (mw) => console.log("mw:", typeof mw),     // observation
      extendContext: (register) => {
        register((ctx) => ({ started: Date.now() }));           // merged per request
      },
      onStart: async (app) => { app.version; },                 // opaque App
      onReady: async () => {},
      onShutdown: async () => {},
    },
  ],
});
```

Execution order: `addRoute` (per route) → `addMiddleware` (per middleware) →
`extendContext` (registration) → `onStart` (before listen) → `onReady` (after
listen) → `onShutdown` (after drain, sharing the drain timeout).

- Keys outside the shape fail config validation (`E_CONFIG_INVALID`);
  middleware injection by plugins does not exist in v1 (observation only).
- Dev and production run the same lifecycle (dev: once on the first request;
  shutdown when the dev server closes).
