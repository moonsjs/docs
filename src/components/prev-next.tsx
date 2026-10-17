import { cn } from "@/lib/utils";
import { SmartLink } from "./smart-link";

interface Neighbor {
  title: string;
  href: string;
}

export function PrevNext(props: { prev?: Neighbor | undefined; next?: Neighbor | undefined }) {
  if (props.prev === undefined && props.next === undefined) {
    return null;
  }
  return (
    <nav
      aria-label="Pagination"
      className="mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
    >
      {props.prev !== undefined ? (
        <SmartLink
          href={props.prev.href}
          className="group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-brand/50 hover:bg-accent/40"
        >
          <span className="text-xs text-muted-foreground">← Previous</span>
          <span className="text-sm font-medium">{props.prev.title}</span>
        </SmartLink>
      ) : (
        <span className="hidden sm:block" />
      )}
      {props.next !== undefined ? (
        <SmartLink
          href={props.next.href}
          className={cn(
            "group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:border-brand/50 hover:bg-accent/40",
          )}
        >
          <span className="text-xs text-muted-foreground">Next →</span>
          <span className="text-sm font-medium">{props.next.title}</span>
        </SmartLink>
      ) : null}
    </nav>
  );
}
