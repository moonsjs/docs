import type { ReactNode } from "react";
import { Link } from "@moonsjs/react";

/** Tautan dokumen internal yang sudah mengikuti locale. */
export function DocLink(props: { locale: "en" | "id"; slug: string; children: ReactNode }) {
  if (props.locale === "en") {
    return (
      <Link to="/[...slug]" params={{ slug: props.slug }}>
        {props.children}
      </Link>
    );
  }
  return (
    <Link to="/id/[...slug]" params={{ slug: props.slug }}>
      {props.children}
    </Link>
  );
}

/** Tautan ke landing sesuai locale. */
export function HomeLink(props: { locale: "en" | "id"; children: ReactNode }) {
  if (props.locale === "en") {
    return <Link to="/">{props.children}</Link>;
  }
  return <Link to="/id">{props.children}</Link>;
}
