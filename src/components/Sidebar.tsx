import type { SidebarGroup } from "../lib/content-types";
import { DocLink } from "./DocLink";

export function Sidebar(props: {
  locale: "en" | "id";
  groups: SidebarGroup[];
  current: string;
}) {
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {props.groups.map((group) => (
        <div className="docs-nav-group" key={group.label}>
          <p className="docs-nav-label">{group.label}</p>
          <ul>
            {group.items.map((item) => {
              const active = item.slug !== undefined && item.slug === props.current;
              if (item.href !== undefined) {
                return (
                  <li key={item.href}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                );
              }
              return (
                <li key={item.slug} className={active ? "active" : undefined}>
                  <DocLink locale={props.locale} slug={item.slug ?? ""}>
                    {item.label}
                  </DocLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
