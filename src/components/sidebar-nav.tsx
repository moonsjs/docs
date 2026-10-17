import { Badge } from "@/components/ui/badge";
import type { NavSection } from "@/lib/content-types";
import { cn } from "@/lib/utils";
import { SmartLink } from "./smart-link";

export function SidebarNav(props: { nav: NavSection[]; activeHref: string }) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {props.nav.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.href === props.activeHref;
              return (
                <li key={item.href}>
                  <SmartLink
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-brand/10 font-medium text-brand dark:bg-brand/15"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{item.title}</span>
                    {item.planned ? (
                      <Badge
                        variant="outline"
                        className="h-5 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground"
                      >
                        Planned
                      </Badge>
                    ) : null}
                  </SmartLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
