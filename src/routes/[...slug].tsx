import {
  notFound,
  useLoaderData,
  type LoaderArgs,
  type RouteMetaFn,
} from "@moonsjs/react";
import { content } from "virtual:moons-docs-content";
import { DocsPage } from "@/components/docs-page";

export const prerender = true;

export const paths = () => Object.keys(content.pages).map((slug) => ({ slug }));

export const loader = async ({ params }: LoaderArgs<"/[...slug]">) => {
  const slug = params.slug.replace(/^\/+|\/+$/g, "");
  const page = content.pages[slug];
  if (page === undefined) {
    notFound();
  }
  return { page, nav: content.nav, version: content.version };
};

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `${data.page.title} — Moons`,
  description: data.page.description,
});

export default function DocRoute() {
  const data = useLoaderData<typeof loader>();
  return <DocsPage page={data.page} nav={data.nav} version={data.version} />;
}
