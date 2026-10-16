import type { ReactNode } from "react";

export default function Layout(props: { children?: ReactNode }) {
  return <div className="app">{props.children}</div>;
}
