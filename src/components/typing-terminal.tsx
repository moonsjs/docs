import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Segment {
  text: string;
  className?: string;
}

/** Colored terminal lines — same text the copy button copies. */
const LINES: Segment[][] = [
  [
    { text: "bunx", className: "text-brand" },
    { text: " --package " },
    { text: "@moonsjs/cli", className: "text-brand-2" },
    { text: " moons create my-app" },
  ],
  [{ text: "cd", className: "text-brand-2" }, { text: " my-app" }],
  [{ text: "bun run", className: "text-brand" }, { text: " dev" }],
];

/**
 * Character budget = the sum of all segment lengths. Line breaks are not
 * part of the budget — the renderer must consume exactly this many
 * characters, or the tail of the last line gets truncated.
 */
const TOTAL = LINES.flat().reduce((sum, segment) => sum + segment.text.length, 0);

/** Character indexes that end a line — the typing pauses briefly there. */
const LINE_END_INDEXES: ReadonlySet<number> = (() => {
  const ends = new Set<number>();
  let sum = 0;
  for (const line of LINES) {
    sum += line.reduce((total, segment) => total + segment.text.length, 0);
    ends.add(sum);
  }
  return ends;
})();

function charDelay(index: number): number {
  return LINE_END_INDEXES.has(index) ? 260 : 16 + Math.random() * 20;
}

export function TypingTerminal(props: { className?: string | undefined }) {
  const [count, setCount] = useState(TOTAL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0;
    setCount(0);
    const tick = (): void => {
      if (cancelled) {
        return;
      }
      index += 1;
      setCount(index);
      if (index < TOTAL) {
        timer = setTimeout(tick, charDelay(index));
      }
    };
    let started = false;
    const start = (): void => {
      if (started) {
        return;
      }
      started = true;
      timer = setTimeout(tick, 500);
    };
    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
    }
    // Watchdog: a slow network event (fonts, analytics) must not leave the
    // terminal empty after hydration.
    const watchdog = setTimeout(start, 2500);
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      window.removeEventListener("load", start);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, []);

  const lines = useMemo(() => {
    let remaining = count;
    return LINES.map((segments) =>
      segments.map((segment) => {
        const take = Math.max(0, Math.min(segment.text.length, remaining));
        remaining -= take;
        return { text: segment.text.slice(0, take), className: segment.className };
      }),
    );
  }, [count]);

  const done = count >= TOTAL;
  const activeLine = useMemo(() => {
    let accumulated = 0;
    for (let line = 0; line < LINES.length; line += 1) {
      accumulated += (LINES[line] ?? []).reduce(
        (total, segment) => total + segment.text.length,
        0,
      );
      if (count < accumulated) {
        return line;
      }
    }
    return LINES.length - 1;
  }, [count]);

  return (
    <div className={cn("relative", props.className)}>
      <p className="sr-only">
        Terminal commands: bunx --package @moonsjs/cli moons create my-app; cd my-app; bun run dev
      </p>
      <div
        data-terminal=""
        data-terminal-state={hydrated ? (done ? "done" : "typing") : "idle"}
        aria-hidden="true"
        className="space-y-1.5 text-left font-mono text-[13px] leading-6 text-muted-foreground"
      >
        {lines.map((segments, lineIndex) => (
          <p key={lineIndex} className="min-h-6">
            {segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} className={segment.className}>
                {segment.text}
              </span>
            ))}
            {!done && lineIndex === activeLine ? (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-[moons-caret_1.05s_steps(2)_infinite] bg-brand/80" />
            ) : null}
          </p>
        ))}
      </div>
    </div>
  );
}
