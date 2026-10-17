import { Link } from "@moonsjs/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const NavContext = createContext<((href: string) => void) | null>(null);

/**
 * Client-side navigation for arbitrary URLs. Moons `Link` targets route
 * patterns, so we keep one hidden `Link` around and "click" it after a
 * caller asks for a URL — the click runs the framework's soft navigation.
 */
export function useClientNavigate(): (href: string) => void {
  const go = useContext(NavContext);
  if (go !== null) {
    return go;
  }
  return (href: string): void => {
    window.location.assign(href);
  };
}

export function ClientNavigator(props: { children: ReactNode }) {
  const [target, setTarget] = useState<string | null>(null);
  const holder = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (target === null) {
      return;
    }
    const anchor = holder.current?.querySelector("a");
    if (anchor instanceof HTMLAnchorElement) {
      anchor.click();
    }
    setTarget(null);
  }, [target]);

  const go = useCallback((href: string) => {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")) {
      window.location.assign(href);
      return;
    }
    const [pathname = href] = href.split("#");
    if (pathname === window.location.pathname) {
      return;
    }
    setTarget(pathname);
  }, []);

  const slug = target === null || target === "/" ? null : target.replace(/^\/+|\/+$/g, "");

  return (
    <NavContext.Provider value={go}>
      {props.children}
      <span ref={holder} hidden aria-hidden="true">
        {target === "/" ? <Link to="/">home</Link> : null}
        {slug !== null ? (
          <Link to="/[...slug]" params={{ slug }}>
            page
          </Link>
        ) : null}
      </span>
    </NavContext.Provider>
  );
}
