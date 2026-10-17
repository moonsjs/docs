import { ShikiMagicMovePrecompiled } from "shiki-magic-move/react";
import type { KeyedTokensInfo } from "shiki-magic-move/types";
import showcase from "@/generated/showcase.json";

const steps = [showcase.server, showcase.client] as unknown as KeyedTokensInfo[];

/**
 * Morphs between the server and client code steps. Tokens are precompiled at
 * build time (`bun run content`), so no shiki highlighter ships to the browser.
 */
export function ShowcaseCode(props: { tab: "server" | "client" }) {
  return (
    <div className="showcase-code">
      <ShikiMagicMovePrecompiled
        steps={steps}
        step={props.tab === "server" ? 0 : 1}
        options={{
          duration: 420,
          stagger: 10,
          containerStyle: false,
          animateContainer: true,
        }}
      />
    </div>
  );
}
