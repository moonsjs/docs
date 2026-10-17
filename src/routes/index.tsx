import { useLoaderData } from "@moonsjs/react";
import {
  Bot,
  Braces,
  CircleCheck,
  Database,
  Files,
  Gauge,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { m, useReducedMotion, type Variants } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { content } from "virtual:moons-docs-content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/copy-button";
import { Header } from "@/components/header";
import { MotionReveal } from "@/components/motion-reveal";
import { ShowcaseCode } from "@/components/showcase-code";
import { TypingTerminal } from "@/components/typing-terminal";
import { SmartLink } from "@/components/smart-link";
import { SHOWCASE_CLIENT_CODE, SHOWCASE_SERVER_CODE } from "@/lib/showcase-code";
import { cn } from "@/lib/utils";

export const prerender = true;

export const loader = () => ({ version: content.version });

export const meta = () => ({
  title: "Moons — full-stack TypeScript with a zero-trust boundary",
  description:
    "Write routes, loaders, and server functions in one codebase. Moons replaces server modules with typed RPC stubs at build time, so server code can never reach the browser.",
});

const CREATE = `bunx --package @moonsjs/cli moons create my-app
cd my-app
bun run dev`;

const spring = { type: "spring", stiffness: 380, damping: 28 } as const;

const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const heroItem: Variants = {
  // No opacity: the hero must paint immediately (LCP), so the entrance
  // animation is transform-only.
  hidden: { y: 14 },
  show: { y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

const cardVariants: Variants = {
  hover: { y: -4 },
};

const chipVariants: Variants = {
  hover: { scale: 1.12, rotate: -5 },
};

function InlineCode(props: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-muted/60 px-1 py-0.5 font-mono text-[0.8em]">
      {props.children}
    </code>
  );
}

function Eyebrow(props: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", props.dot)} />
      {props.children}
    </span>
  );
}

interface Feature {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  chip: string;
  card: string;
  fun?: boolean;
}

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Zero-trust by design",
    body: "Server code can't reach the browser. Attempting it fails the build — a hard stop, not a warning.",
    chip: "bg-violet-500/10 text-violet-600 ring-violet-500/25 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25",
    card: "hover:border-violet-500/40 dark:hover:border-violet-400/40",
  },
  {
    icon: Files,
    title: "File-based routing",
    body: "Create routes by adding files. Layouts, dynamic segments, catch-alls, and nested layouts work out of the box, fully typed.",
    chip: "bg-sky-500/10 text-sky-600 ring-sky-500/25 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",
    card: "hover:border-sky-500/40 dark:hover:border-sky-400/40",
  },
  {
    icon: Database,
    title: "Typed loaders",
    body: (
      <>
        Fetch data on the server with <InlineCode>loader</InlineCode>. The return type flows
        straight into your component via <InlineCode>useLoaderData</InlineCode>. The route module
        still ships to the browser, so keep secrets in <InlineCode>serverFn</InlineCode>.
      </>
    ),
    chip: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25",
    card: "hover:border-emerald-500/40 dark:hover:border-emerald-400/40",
  },
  {
    icon: Server,
    title: "serverFn",
    body: "Secure server logic once. Input and output are validated on both sides, and the browser only ever receives a typed RPC stub.",
    chip: "bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/25 dark:bg-fuchsia-400/10 dark:text-fuchsia-300 dark:ring-fuchsia-400/25",
    card: "hover:border-fuchsia-500/40 dark:hover:border-fuchsia-400/40",
  },
  {
    icon: Braces,
    title: "End-to-end type safety",
    body: "Routes, params, search params, loaders, context, and server functions are all typed. Typegen keeps everything in sync.",
    chip: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/25 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25",
    card: "hover:border-indigo-500/40 dark:hover:border-indigo-400/40",
  },
  {
    icon: Layers,
    title: "SSR + hydration",
    body: "Pages render on the server and hydrate on the client. Loaders and search params stay consistent across the boundary.",
    chip: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25",
    card: "hover:border-cyan-500/40 dark:hover:border-cyan-400/40",
  },
  {
    icon: RefreshCw,
    title: "Built-in revalidation",
    body: (
      <>
        After a mutation, call <InlineCode>refresh()</InlineCode> to re-run loaders for the current
        page. No cache invalidation boilerplate.
      </>
    ),
    chip: "bg-teal-500/10 text-teal-600 ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25",
    card: "hover:border-teal-500/40 dark:hover:border-teal-400/40",
  },
  {
    icon: TriangleAlert,
    title: "Error handling",
    body: (
      <>
        Custom <InlineCode>_404</InlineCode> and <InlineCode>_error</InlineCode> pages, with clear
        build-time and runtime errors that point at a fix.
      </>
    ),
    chip: "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
    card: "hover:border-amber-500/40 dark:hover:border-amber-400/40",
  },
  {
    icon: Webhook,
    title: "API routes",
    body: (
      <>
        Need raw HTTP? Drop handlers in <InlineCode>src/api/</InlineCode> for full control when
        serverFn isn&rsquo;t the right fit.
      </>
    ),
    chip: "bg-orange-500/10 text-orange-600 ring-orange-500/25 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/25",
    card: "hover:border-orange-500/40 dark:hover:border-orange-400/40",
  },
  {
    icon: Gauge,
    title: "Prerender & ISR",
    body: "Opt pages into static generation at build time, including dynamic routes with explicit path lists.",
    chip: "bg-lime-500/10 text-lime-600 ring-lime-500/25 dark:bg-lime-400/10 dark:text-lime-300 dark:ring-lime-400/25",
    card: "hover:border-lime-500/40 dark:hover:border-lime-400/40",
  },
  {
    icon: Bot,
    title: "AI-ready tooling",
    body: "Machine-readable CLI output, an MCP server, and structured docs so agents can work accurately with your project.",
    chip: "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25",
    card: "hover:border-rose-500/40 dark:hover:border-rose-400/40",
  },
  {
    icon: Terminal,
    title: "One command to verify",
    body: (
      <>
        <InlineCode>moons check</InlineCode> runs typegen, TypeScript checking, and both builds.
        Green means the boundary held. Click to copy it.
      </>
    ),
    chip: "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25",
    card: "hover:border-blue-500/40 dark:hover:border-blue-400/40",
    fun: true,
  },
];

interface Faq {
  question: string;
  answer: ReactNode;
}

const faq: Faq[] = [
  {
    question: "Do I need Bun to use Moons?",
    answer:
      "Bun is the fastest way to run the CLI and the dev server, and it is what the create template targets. Your app itself runs on Bun or Node — nothing in @moonsjs/core or @moonsjs/server depends on Bun-only APIs.",
  },
  {
    question: "How does zero-trust actually work?",
    answer: (
      <>
        Your <InlineCode>*.server.ts</InlineCode> modules are replaced by typed RPC stubs in the
        client build. If any client code reaches for server implementation, the build fails with a
        file:line error instead of shipping it. The{" "}
        <SmartLink href="/architecture" className="font-medium text-brand hover:underline">
          Architecture
        </SmartLink>{" "}
        page walks through the whole pipeline.
      </>
    ),
  },
  {
    question: "Is Moons production-ready?",
    answer:
      "The core — routing, SSR, loaders, server functions, and the build-time boundary — is stable and heavily tested. The surrounding ecosystem is young, so treat newer areas accordingly. The Architecture page lists the honest limits of the model.",
  },
  {
    question: "Where do secrets go?",
    answer: (
      <>
        In <InlineCode>*.server.ts</InlineCode> files and <InlineCode>env()</InlineCode> reads —
        they never enter the client bundle. Remember that loader return values are embedded in the
        HTML payload, so keep secrets out of loader results too.
      </>
    ),
  },
];

const trust = [
  { label: "Leaks fail the build", color: "text-emerald-500" },
  { label: "Typed from route to server", color: "text-brand" },
  { label: "Develop on Bun, deploy on Bun or Node", color: "text-brand-2" },
  { label: "MIT licensed", color: "text-amber-500" },
];

const cardBase =
  "flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors duration-200";

export default function Home() {
  const { version } = useLoaderData<typeof loader>();
  const [showcase, setShowcase] = useState<"server" | "client">("server");
  const [armed, setArmed] = useState(false);
  const [verifyCopied, setVerifyCopied] = useState(false);
  const reduce = useReducedMotion();
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setArmed(true);
  }, []);

  const heroAnimate = armed && reduce !== true;
  const heroMotion = heroAnimate
    ? { initial: "hidden" as const, animate: "show" as const }
    : { initial: false as const };
  const hoverProps = reduce === true ? {} : { whileHover: "hover" as const };
  const tapProps = reduce === true ? {} : { whileTap: { scale: 0.985 } };

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const glow = glowRef.current;
    if (glow === null) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    glow.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    glow.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
  }, []);

  const handleVerify = useCallback(() => {
    void navigator.clipboard.writeText("bun run check").then(() => {
      setVerifyCopied(true);
      window.setTimeout(() => setVerifyCopied(false), 1800);
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (sessionStorage.getItem("moons-celebrated") === "1") {
      return;
    }
    sessionStorage.setItem("moons-celebrated", "1");
    void import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 110,
        spread: 72,
        startVelocity: 36,
        ticks: 180,
        origin: { y: 0.78 },
        colors: ["#8d80ff", "#5eead4", "#f0abfc", "#fcd34d"],
        disableForReducedMotion: true,
      });
    });
  }, []);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section
          className="relative mx-auto w-full max-w-[90rem] px-4 pt-16 pb-12 sm:px-6 sm:pt-24"
          onPointerMove={handlePointerMove}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[660px] overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-40 dark:opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                backgroundSize: "52px 52px",
                maskImage: "radial-gradient(ellipse 58% 52% at 50% 0%, black, transparent)",
                WebkitMaskImage: "radial-gradient(ellipse 58% 52% at 50% 0%, black, transparent)",
              }}
            />
            <div className="absolute left-1/2 top-[-300px] h-[580px] w-[880px] -translate-x-1/2 rounded-full bg-brand/25 blur-[140px] dark:bg-brand/20" />
            <div className="absolute left-[6%] top-[140px] h-[280px] w-[280px] rounded-full bg-brand-2/20 blur-[110px] dark:bg-brand-2/15" />
            <div className="absolute right-[4%] top-[60px] h-[300px] w-[300px] rounded-full bg-fuchsia-400/15 blur-[120px] dark:bg-fuchsia-500/10" />
            <div
              ref={glowRef}
              className="absolute inset-0 hidden motion-safe:pointer-fine:block"
              style={{
                background:
                  "radial-gradient(520px circle at var(--glow-x, 50%) var(--glow-y, 0px), color-mix(in oklab, var(--brand) 24%, transparent), transparent 72%)",
              }}
            />
          </div>

          <m.div
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
            variants={heroContainer}
            {...heroMotion}
          >
            <m.div variants={heroItem}>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-brand/30 bg-brand/5 px-3 py-1 text-xs text-foreground"
              >
                <ShieldCheck className="size-3.5 text-brand" />
                Zero-trust by design · v{version}
              </Badge>
            </m.div>
            <m.h1
              variants={heroItem}
              className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
            >
              The full-stack TypeScript framework that{" "}
              <span className="bg-gradient-to-r from-brand via-violet-500 to-brand-2 bg-clip-text text-transparent dark:from-brand dark:via-violet-400 dark:to-brand-2">
                fails the build before it ships a leak.
              </span>
            </m.h1>
            <m.p variants={heroItem} className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Server code, secrets, and open endpoints are caught at build time, not in production.
              Built for teams, and AI agents, that move fast.
            </m.p>
            <m.div variants={heroItem} className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="shadow-lg shadow-brand/25">
                <SmartLink href="/getting-started/installation">Get started</SmartLink>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://github.com/moonsjs" target="_blank" rel="noreferrer">
                  View on GitHub
                </a>
              </Button>
            </m.div>
            <m.div
              variants={heroItem}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              {trust.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <CircleCheck className={cn("size-4", item.color)} />
                  {item.label}
                </span>
              ))}
            </m.div>
          </m.div>

          <MotionReveal className="mx-auto mt-14 max-w-3xl" delay={0.1}>
            <Card className="gap-0 overflow-hidden p-0 shadow-2xl shadow-brand/10 dark:shadow-brand/15">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">Terminal</p>
                </div>
                <CopyButton value={CREATE} />
              </div>
              <TypingTerminal className="px-5 py-4" />
            </Card>
          </MotionReveal>
        </section>

        <Separator />

        <section className="mx-auto w-full max-w-[90rem] px-4 py-16 sm:px-6">
          <MotionReveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Eyebrow dot="bg-brand-2">The boundary, in practice</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">One module, two worlds</h2>
            <p className="mt-3 text-muted-foreground text-balance">
              Server modules keep their implementation on the server. The client build gets a typed
              RPC stub — same import, same types, no implementation.
            </p>
          </MotionReveal>
          <MotionReveal className="mx-auto mt-8 max-w-3xl" delay={0.08}>
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
                <div
                  role="group"
                  aria-label="Code view"
                  className="flex h-8 items-center gap-1 rounded-lg bg-muted p-1"
                >
                  <button
                    type="button"
                    aria-pressed={showcase === "server"}
                    onClick={() => setShowcase("server")}
                    className="relative flex h-6 cursor-pointer items-center gap-2 rounded-md px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showcase === "server" ? (
                      <m.span
                        layoutId="showcase-tab"
                        className="absolute inset-0 rounded-md bg-background shadow-sm"
                        transition={spring}
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                      posts.server.ts
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={showcase === "client"}
                    onClick={() => setShowcase("client")}
                    className="relative flex h-6 cursor-pointer items-center gap-2 rounded-md px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showcase === "client" ? (
                      <m.span
                        layoutId="showcase-tab"
                        className="absolute inset-0 rounded-md bg-background shadow-sm"
                        transition={spring}
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand-2" aria-hidden="true" />
                      client call sites
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {showcase === "server" ? (
                    <Badge
                      variant="outline"
                      className="hidden border-brand/40 bg-brand/5 font-mono text-[10px] text-brand sm:inline-flex"
                    >
                      server-only
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="hidden border-brand-2/40 bg-brand-2/5 font-mono text-[10px] text-brand-2 sm:inline-flex"
                    >
                      typed RPC stub
                    </Badge>
                  )}
                  <CopyButton
                    value={showcase === "server" ? SHOWCASE_SERVER_CODE : SHOWCASE_CLIENT_CODE}
                  />
                </div>
              </div>
              <ShowcaseCode tab={showcase} />
            </Card>
          </MotionReveal>
        </section>

        <Separator />

        <section id="features" className="mx-auto w-full max-w-[90rem] px-4 py-16 sm:px-6">
          <MotionReveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Eyebrow dot="bg-brand">Features</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Everything wired for the happy path
            </h2>
            <p className="mt-3 text-muted-foreground">
              Small pieces that compose into a full app — with guardrails where it matters most.
            </p>
          </MotionReveal>
          <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <MotionReveal key={feature.title} delay={Math.min(index * 0.03, 0.27)}>
                {feature.fun === true ? (
                  <m.button
                    type="button"
                    onClick={handleVerify}
                    variants={cardVariants}
                    {...hoverProps}
                    {...tapProps}
                    transition={spring}
                    className={cn(cardBase, "cursor-pointer text-left", feature.card)}
                    title="Copy the command"
                    data-feature={feature.title}
                  >
                    <m.span
                      variants={chipVariants}
                      transition={spring}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg ring-1",
                        feature.chip,
                      )}
                    >
                      <feature.icon className="size-4" />
                    </m.span>
                    <span className="font-semibold tracking-tight">{feature.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {verifyCopied ? (
                        <span className="font-medium text-brand">
                          Copied <InlineCode>bun run check</InlineCode> — green means the boundary held.
                        </span>
                      ) : (
                        feature.body
                      )}
                    </span>
                  </m.button>
                ) : (
                  <m.div
                    variants={cardVariants}
                    {...hoverProps}
                    transition={spring}
                    className={cn(cardBase, feature.card)}
                    data-feature={feature.title}
                  >
                    <m.span
                      variants={chipVariants}
                      transition={spring}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg ring-1",
                        feature.chip,
                      )}
                    >
                      <feature.icon className="size-4" />
                    </m.span>
                    <span className="font-semibold tracking-tight">{feature.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </span>
                  </m.div>
                )}
              </MotionReveal>
            ))}
          </div>
        </section>

        <Separator />

        <section className="mx-auto w-full max-w-[90rem] px-4 py-16 sm:px-6">
          <MotionReveal className="mx-auto max-w-3xl">
            <Eyebrow dot="bg-amber-500">FAQ</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Questions, answered</h2>
            <Accordion type="single" collapsible className="mt-6">
              {faq.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </MotionReveal>
        </section>

        <section className="mx-auto w-full max-w-[90rem] px-4 pb-20 sm:px-6">
          <MotionReveal className="mx-auto max-w-3xl">
            <Card className="relative overflow-hidden border-brand/30 bg-gradient-to-br from-brand/10 via-background to-brand-2/10 dark:from-brand/15 dark:via-card dark:to-brand-2/10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand/20 blur-[90px]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-brand-2/15 blur-[90px]"
              />
              <CardHeader>
                <CardTitle className="text-2xl">Start building with Moons</CardTitle>
                <CardDescription>
                  Scaffold an app in one command, then read the guides at your own pace.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px]">
                  bunx --package @moonsjs/cli moons create my-app
                  <CopyButton value="bunx --package @moonsjs/cli moons create my-app" />
                </span>
                <Button asChild className="shadow-lg shadow-brand/25">
                  <SmartLink href="/getting-started/installation">
                    Read the installation guide
                  </SmartLink>
                </Button>
              </CardContent>
            </Card>
          </MotionReveal>
        </section>
      </main>
    </>
  );
}
