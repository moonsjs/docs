---
description: "Auth via ctx: cookie sesi HttpOnly/Secure/SameSite, guard loader & serverFn, dan batas CSRF pada endpoint RPC."
---

# Auth & CSRF

Auth **bukan fitur bawaan** Moons (non-goal — framework tidak menyediakan
sesi/JWT/OAuth). Pola kanoniknya kecil dan eksplisit: **cookie → `ctx` → guard**.

## Pola minimum (cookbook)

```ts
// moons.config.ts — cookie mentah, tanpa helper framework
function readDemoUser(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (cookie === null) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "demo_user" && rest.length > 0) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export default defineConfig({
  context: async (req) => ({ requestId: crypto.randomUUID(), demoUser: readDemoUser(req) }),
});
```

```tsx
// src/routes/session.tsx — loader memakai ctx (bertipe dari config)
export const loader = async ({ ctx }: LoaderArgs<"/session">) => ({ user: ctx.demoUser });
```

Kode ini hidup dan diuji: [`moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts) ·
[`session.tsx`](https://github.com/moonsjs/cookbook/blob/main/src/routes/session.tsx).

## Guard

- **Loader** (halaman privat): `if (ctx.demoUser === null) redirect("/login")` —
  navigasi server-side, bukan render halaman kosong.
- **ServerFn** (mutasi): periksa `ctx` di handler. Untuk penolakan, gunakan
 error yang Anda format sendiri (message di production disamarkan) atau
  kembalikan bentuk schema yang aman (`{ ok: false }`) — jangan bergantung pada
  status HTTP yang tidak bisa di-set dari serverFn.

## Cookie sesi (atribut wajib)

Untuk cookie sesi yang Anda set sendiri (mis. dari route handler lain di masa
depan atau reverse proxy):

```txt
Set-Cookie: session=<acak-256bit>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...
```

- **HttpOnly** — tidak terbaca JavaScript (XSS tidak mencuri sesi).
- **Secure** — hanya HTTPS.
- **SameSite=Lax/Strict** — pertahanan CSRF pertama; rotate token saat login.

## Set cookie & header dari loader/serverFn (D.2)

```ts
import { setCookie, setHeader } from "@moonsjs/react"; // atau @moonsjs/server

export const loader = async () => {
  setHeader("cache-control", "private, max-age=60");
  setCookie("session_id", token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 });
  return {};
};
```

- Dikumpulkan per request (aman untuk request paralel) dan diterapkan ke
  respons HTML, RPC serverFn, endpoint `src/api`, termasuk halaman error.
- `appendHeader` untuk nilai ganda; `setCookie` boleh dipanggil berkali-kali;
  nilai cookie otomatis `encodeURIComponent`; default `Path=/`.
- Validasi: CRLF/karakter kontrol → `E_RESPONSE_HEADER_INVALID`; header framing
  (`content-length`, dll.) ditolak; di luar request →
  `E_RESPONSE_OUTSIDE_REQUEST`.

## Batas CSRF bawaan (penting)

- Header `x-moons: 1` + pemeriksaan origin (`security.originWhitelist`)
  **hanya melindungi endpoint RPC** (`POST /_moons/fn/*`).
- **Loader adalah GET** tanpa efek samping — jangan menulis data dari loader.
- Semua mutasi lewat **serverFn** (CSRF-protected). Form non-JS tidak ada di v1
  (non-goal) — jadi tidak ada endpoint POST lain yang perlu dilindungi.
- `SameSite` cookie tetap lapis pertama; `originWhitelist` adalah lapis kedua
  untuk case lintas-origin yang sah.

## Kenapa tanpa helper cookie?

Keputusan sadar: parsing `Cookie` cukup 5–10 baris di `context(req)`, dan
menambahkan helper akan menyeret ekspektasi API auth (sesi, sign, verify) yang
merupakan non-goal. Kalau helper dibutuhkan, jalurnya amendemen spesifikasi resmi.

## Untuk agen AI

Resep Inggris: [`docs/ai/recipes/auth-ctx.md`](/ai/recipes/auth-ctx/) — tautan
ke kode cookbook nyata yang lolos CI.
