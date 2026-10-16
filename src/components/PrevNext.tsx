import type { NavNeighbor } from "../lib/content-types";

export function PrevNext(props: {
  prev?: NavNeighbor | undefined;
  next?: NavNeighbor | undefined;
}) {
  if (props.prev === undefined && props.next === undefined) {
    return null;
  }
  return (
    <nav className="docs-pager" aria-label="Pagination">
      {props.prev === undefined ? (
        <span />
      ) : (
        <a className="pager-link prev" href={props.prev.href}>
          <span className="pager-label">Previous</span>
          <span className="pager-title">{props.prev.label}</span>
        </a>
      )}
      {props.next === undefined ? (
        <span />
      ) : (
        <a className="pager-link next" href={props.next.href}>
          <span className="pager-label">Next</span>
          <span className="pager-title">{props.next.label}</span>
        </a>
      )}
    </nav>
  );
}
