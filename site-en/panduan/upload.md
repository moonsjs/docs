---
description: "Multipart uploads as a src/api pattern: req.formData(), per-route size limits, and the security rules."
---

# File uploads (multipart)

No new framework API: uploads are a **`src/api` pattern** (D.1) using the Web
API `req.formData()`. Storage is the app's job (fs/S3/R2).

```ts
// src/api/upload.ts
import type { ApiHandlerArgs } from "@moonsjs/server";

const MAX_BYTES = 64 * 1024;

export const POST = async ({ req }: ApiHandlerArgs): Promise<Response> => {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES + 4096) return Response.json({ error: "too large" }, { status: 413 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return Response.json({ error: "too large" }, { status: 413 });
  return Response.json({ name: file.name, size: bytes.byteLength });
};
```

Live code: [cookbook `src/api/upload.ts`](https://github.com/moonsjs/cookbook/blob/main/src/api/upload.ts).

Security rules:

- `security.bodyLimitBytes` covers RPC only — enforce per-route limits
  (`content-length` **and** actual bytes).
- Never trust `file.name`/`file.type` for storage paths; generate server-side
  names, validate content (magic bytes) when it matters.
- Add rate limiting to upload endpoints; `formData()` buffers into memory.
