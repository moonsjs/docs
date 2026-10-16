import type { TocEntry } from "../lib/content-types";

export function Toc(props: { entries: TocEntry[] }) {
  if (props.entries.length === 0) {
    return null;
  }
  return (
    <nav className="docs-toc" aria-label="On this page">
      <p className="docs-nav-label">On this page</p>
      <ul>
        {props.entries.map((entry) => (
          <li key={entry.id} className={`depth-${entry.depth}`}>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
