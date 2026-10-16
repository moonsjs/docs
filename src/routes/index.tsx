import { Landing } from "../components/Landing";

export const prerender = true;

export const meta = () => ({
  title: "Moons — full-stack TypeScript that can’t leak server code",
  description:
    "File-based full-stack framework for React: SSR, loaders, server functions and raw API routes, with a build-time boundary that makes server-code leaks impossible.",
});

export default function Home() {
  return <Landing locale="en" />;
}
