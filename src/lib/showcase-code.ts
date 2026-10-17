/**
 * Code snippets shown in the landing "One module, two worlds" card.
 * Client-safe: the content pipeline (build-time tokens) and the landing
 * component (display) both import from here.
 */

export const SHOWCASE_SERVER_CODE = `// src/server/posts.server.ts — runs on the server, always.
import { env, serverFn } from "@moonsjs/server";
import { z } from "zod";

export const publishPost = serverFn({
  input: z.object({ title: z.string().min(1) }),
  output: z.object({ id: z.string() }),
  handler: async ({ input }) => {
    const response = await fetch(\`\${env("CMS_URL")}/posts\`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const post = (await response.json()) as { id: string };
    return { id: post.id };
  },
});`;

export const SHOWCASE_CLIENT_CODE = `// Anywhere in the browser — routes, components, handlers.
import { publishPost } from "../server/posts.server";

const post = await publishPost({ title: "Hello" });
// → { id: "p_123" }

// The implementation and env("CMS_URL") stay on the server.
// The client build only contains a typed RPC stub.`;
