import { DocLink, HomeLink } from "./DocLink";
import { Header } from "./Header";

const INSTALL = "bunx --package @moonsjs/cli moons create my-app";

function Icon(props: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={props.d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  check: "M4 12.5 9.5 18 20 6.5",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4M13.5 5l-3 14",
  rocket: "M14 4c3.5 0 6 2.5 6 6 0 5-4 8-8 10-2-4-5-8-5-12 0-3.5 2.5-6 7-4Zm0 0c-2 1-3.5 3-4 5m4 7c2-1 4-3 5-5M9 17l-2 4m4-4 4 2",
  laptop: "M5 6h14v10H5zM3 19h18",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
} as const;

interface Copy {
  badge: string;
  h1: string;
  lead: string;
  getStarted: string;
  cookbook: string;
  chips: string[];
  serverNote: string;
  leakText: string;
  featuresTitle: string;
  features: { icon: keyof typeof ICONS; title: string; body: string }[];
  layersTitle: string;
  layers: { title: string; body: string }[];
  agentsTitle: string;
  agentsBody: string;
  agentsLinks: { label: string; slug: string }[];
  stackLabel: string;
  stack: string[];
  ctaTitle: string;
  ctaLead: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

const COPY: Record<"en" | "id", Copy> = {
  en: {
    badge: "Zero-trust by construction",
    h1: "Full-stack TypeScript that can’t leak server code.",
    lead: "Moons is a file-based framework for React — SSR, loaders, server functions and raw API routes — with a build-time boundary that turns “never import server code” into “the build refuses”.",
    getStarted: "Get started",
    cookbook: "Cookbook",
    chips: ["MIT license", "TypeScript strict", "Runs on Bun & Node"],
    serverNote: "// runs on the server — never shipped",
    leakText: "Client code importing *.server.ts fails the build — by design.",
    featuresTitle: "Everything you need, nothing that leaks",
    features: [
      { icon: "file", title: "File-based routing", body: "Pages, layouts, _404 and _error files under src/routes. Typegen keeps <Link> hrefs and search params honest." },
      { icon: "check", title: "serverFn, validated on both sides", body: "Declare input and output once — zod or any Standard Schema. The client gets a typed RPC stub; the server keeps the handler." },
      { icon: "code", title: "Zero-trust build", body: "Every *.server.ts becomes an RPC stub in the client bundle. Importing server code from a route fails the build with E_SERVER_IMPORT_IN_CLIENT." },
      { icon: "rocket", title: "SSR today, hydration that stays in sync", body: "Routes render on the server and hydrate on the client, with loaders and useSearchParams sharing the same values." },
      { icon: "laptop", title: "API routes, prerender & ISR", body: "src/api/*.ts gives you raw HTTP endpoints. Prerender still pages and revalidate them with on-demand ISR." },
      { icon: "moon", title: "Built for AI agents", body: "llms.txt, /raw markdown, an MCP server, and moons routes|fns|check --json for machine-readable introspection." },
    ],
    layersTitle: "Zero-trust, in three layers",
    layers: [
      { title: "Build", body: "A Vite transform replaces every *.server.ts with an RPC stub before the client bundle is written. The original source never ships." },
      { title: "Runtime", body: "Server functions run in-process during SSR; on the client they POST to hashed endpoints with an x-moons header. No eval, no serialized source." },
      { title: "Guards", body: "Leak tests grep dist/client for handler bodies, env values and canary strings. A leak fails CI — not production." },
    ],
    agentsTitle: "Machine-readable by default",
    agentsBody: "Moons ships its own context: a compact agent guide, recipes that link real cookbook source, and an MCP server over stdio with list_routes, get_fn_registry, run_check and search_docs.",
    agentsLinks: [
      { label: "Agent context", slug: "ai/context" },
      { label: "Recipes", slug: "ai/recipes/search-params" },
      { label: "MCP reference", slug: "api/mcp" },
    ],
    stackLabel: "Plays well with",
    stack: ["React 19", "Vite", "Tailwind v4", "Drizzle ORM", "bun:sqlite", "Node & Bun"],
    ctaTitle: "Ship your first zero-trust route",
    ctaLead: "One command to scaffold, one build to prove nothing leaks.",
    ctaPrimary: "Read the quickstart",
    ctaSecondary: "Star on GitHub",
  },
  id: {
    badge: "Zero-trust sejak desain",
    h1: "TypeScript full-stack yang tak bisa membocorkan kode server.",
    lead: "Moons adalah framework berbasis file untuk React — SSR, loader, server function, dan endpoint API mentah — dengan batas build-time yang mengubah “jangan impor kode server” menjadi “build menolak”.",
    getStarted: "Mulai",
    cookbook: "Cookbook",
    chips: ["Lisensi MIT", "TypeScript strict", "Jalan di Bun & Node"],
    serverNote: "// berjalan di server — tidak pernah dikirim",
    leakText: "Kode client yang mengimpor *.server.ts menggagalkan build — memang begitu seharusnya.",
    featuresTitle: "Semua yang kamu butuhkan, tanpa yang bocor",
    features: [
      { icon: "file", title: "Routing berbasis file", body: "Halaman, layout, _404, dan _error di bawah src/routes. Typegen menjaga href <Link> dan search params." },
      { icon: "check", title: "serverFn, validasi dua sisi", body: "Deklarasikan input dan output sekali — zod atau Standard Schema apa pun. Client mendapat stub RPC tertip; server menyimpan handler." },
      { icon: "code", title: "Build zero-trust", body: "Setiap *.server.ts menjadi stub RPC di bundle klien. Mengimpor kode server dari route menggagalkan build dengan E_SERVER_IMPORT_IN_CLIENT." },
      { icon: "rocket", title: "SSR hari ini, hidrasi yang tetap sinkron", body: "Route dirender di server lalu dihidrasi di klien; loader dan useSearchParams berbagi nilai yang sama." },
      { icon: "laptop", title: "API route, prerender & ISR", body: "src/api/*.ts memberi endpoint HTTP mentah. Prerender halaman statis dan revalidasi dengan ISR on-demand." },
      { icon: "moon", title: "Dirancang untuk agen AI", body: "llms.txt, markdown /raw, server MCP, dan moons routes|fns|check --json untuk introspeksi mesin." },
    ],
    layersTitle: "Zero-trust dalam tiga lapis",
    layers: [
      { title: "Build", body: "Transform Vite mengganti setiap *.server.ts dengan stub RPC sebelum bundle klien ditulis. Sumber aslinya tidak pernah terkirim." },
      { title: "Runtime", body: "Server function berjalan in-process saat SSR; di klien mereka POST ke endpoint ber-hash dengan header x-moons. Tanpa eval, tanpa sumber terserialisasi." },
      { title: "Penjaga", body: "Test kebocoran memindai dist/client untuk isi handler, nilai env, dan canary. Kebocoran menggagalkan CI — bukan produksi." },
    ],
    agentsTitle: "Terbaca mesin sejak awal",
    agentsBody: "Moons membawa konteksnya sendiri: panduan agen yang ringkas, resep yang menautkan sumber cookbook asli, dan server MCP via stdio dengan list_routes, get_fn_registry, run_check, dan search_docs.",
    agentsLinks: [
      { label: "Konteks agen", slug: "ai/context" },
      { label: "Resep", slug: "ai/recipes/search-params" },
      { label: "Referensi MCP", slug: "api/mcp" },
    ],
    stackLabel: "Nyaman dengan",
    stack: ["React 19", "Vite", "Tailwind v4", "Drizzle ORM", "bun:sqlite", "Node & Bun"],
    ctaTitle: "Rilis route zero-trust pertamamu",
    ctaLead: "Satu perintah untuk scaffold, satu build untuk membuktikan tidak ada yang bocor.",
    ctaPrimary: "Baca quickstart",
    ctaSecondary: "Star di GitHub",
  },
};

export function Landing(props: { locale: "en" | "id" }) {
  const copy = COPY[props.locale];
  const locale = props.locale;
  return (
    <div className="moons-landing">
      <Header locale={locale} />
      <div className="landing-body">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">{copy.badge}</span>
            <h1>{copy.h1}</h1>
            <p className="lead">{copy.lead}</p>

            <div className="install code-block">
              <pre>
                <code>{INSTALL}</code>
              </pre>
              <button type="button" data-code-copy>
                Copy
              </button>
            </div>

            <div className="cta">
              <DocLink locale={locale} slug="start/quickstart">
                <span className="button primary">{copy.getStarted}</span>
              </DocLink>
              <a className="button" href="https://github.com/moonsjs/cookbook">
                {copy.cookbook}
              </a>
            </div>

            <ul className="chips" aria-label="At a glance">
              {copy.chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <figure className="codecard">
              <figcaption>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="file">src/server/moons.server.ts</span>
              </figcaption>
              <pre>
                <code>
                  <span className="c">{copy.serverNote}</span>
                  {"\n"}
                  <span className="k">import</span> {"{ serverFn }"}{" "}
                  <span className="k">from</span> <span className="s">"@moonsjs/server"</span>;{"\n\n"}
                  <span className="k">export const</span> <span className="f">moonById</span> ={" "}
                  <span className="f">serverFn</span>({"{"}
                  {"\n"} input: z.<span className="f">object</span>({"{ id: z."}
                  <span className="f">string</span>() {"}"}),{"\n"} handler: <span className="k">async</span> ({"{ input }"}) =&gt;
                  db.moons.<span className="f">find</span>(input.id),{"\n"}
                  {"}"});
                </code>
              </pre>
            </figure>

            <figure className="codecard leak">
              <figcaption>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="file">src/routes/moon.tsx</span>
              </figcaption>
              <pre>
                <code>
                  <span className="k">import</span> {"{ moonById }"} <span className="k">from</span>{" "}
                  <span className="s">"../server/moons.server"</span>;
                </code>
              </pre>
              <div className="leaknote">
                <code>E_SERVER_IMPORT_IN_CLIENT</code>
                <span>{copy.leakText}</span>
              </div>
            </figure>
          </div>
        </section>

        <section className="features">
          <h2>{copy.featuresTitle}</h2>
          <div className="grid">
            {copy.features.map((feature) => (
              <article key={feature.title}>
                <span className="icon">
                  <Icon d={ICONS[feature.icon]} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="layers">
          <h2>{copy.layersTitle}</h2>
          <div className="grid three">
            {copy.layers.map((layer, index) => (
              <article key={layer.title}>
                <span className="step">0{index + 1}</span>
                <h3>{layer.title}</h3>
                <p>{layer.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="agents">
          <div className="agents-copy">
            <h2>{copy.agentsTitle}</h2>
            <p>{copy.agentsBody}</p>
            <p className="agent-links">
              {copy.agentsLinks.map((link) => (
                <DocLink key={link.slug} locale={locale} slug={link.slug}>
                  {link.label}
                </DocLink>
              ))}
            </p>
          </div>
          <figure className="codecard" aria-hidden="true">
            <figcaption>
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="file">terminal</span>
            </figcaption>
            <pre>
              <code>
                <span className="p">$</span> bunx --package @moonsjs/mcp moons-mcp{"\n"}
                <span className="c"># stdio: list_routes · get_fn_registry · run_check · search_docs</span>
                {"\n\n"}
                <span className="p">$</span> moons check --json{"\n"}
                {"{ "}
                <span className="s">"ok"</span>: <span className="k">true</span>, <span className="s">"steps"</span>: [ … ] {"}"}
              </code>
            </pre>
          </figure>
        </section>

        <section className="stack" aria-label={copy.stackLabel}>
          <span>{copy.stackLabel}</span>
          <ul>
            {copy.stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="final-cta">
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaLead}</p>
          <div className="cta">
            <DocLink locale={locale} slug="start/quickstart">
              <span className="button primary">{copy.ctaPrimary}</span>
            </DocLink>
            <a className="button" href="https://github.com/moonsjs">
              {copy.ctaSecondary}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
