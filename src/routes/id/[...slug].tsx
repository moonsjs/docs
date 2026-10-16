import {
  notFound,
  useLoaderData,
  type LoaderArgs,
  type RouteMetaFn,
} from "@moonsjs/react";
import { content } from "virtual:moons-docs-content";
import { DocsPage } from "../../components/DocsPage";

export const prerender = true;

export const paths = () => Object.keys(content.id.pages).map((slug) => ({ slug }));

export const loader = async ({ params }: LoaderArgs<"/id/[...slug]">) => {
  const slug = params.slug.replace(/^\/+|\/+$/g, "");
  const page = content.id.pages[slug];
  if (page === undefined) {
    notFound();
  }
  return {
    page,
    sidebar: content.id.sidebar,
    nav: content.id.prevNext[slug] ?? {},
  };
};

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `${data.page.title} · Moons`,
  description: data.page.description,
});

export default function DocPageId() {
  const data = useLoaderData<typeof loader>();
  return <DocsPage locale="id" data={data} />;
}
