import { useCallback, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useClientNavigate } from "./client-navigator";
import { cn } from "@/lib/utils";

/**
 * `<a>` that performs client-side navigation for plain left clicks on
 * internal links. Modifiers, middle clicks, and external links keep the
 * browser's default behavior.
 */
export function SmartLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = useClientNavigate();
  const { href, className, children, onClick, ...rest } = props;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>): void => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.currentTarget.getAttribute("target");
      if (target !== null && target !== "_self") {
        return;
      }
      if (href === undefined || href.startsWith("#") || href.startsWith("//")) {
        return;
      }
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
        return;
      }
      event.preventDefault();
      go(href);
    },
    [href, onClick, go],
  );

  return (
    <a href={href} className={cn(className)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
