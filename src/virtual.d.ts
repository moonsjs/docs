declare module "*.css";

declare module "virtual:moons-docs-content" {
  const content: import("./lib/content-types").DocsContent;
  export { content };
}
