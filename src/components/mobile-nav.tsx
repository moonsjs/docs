import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavSection } from "@/lib/content-types";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav(props: { nav: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    if (open) {
      setPathname(window.location.pathname);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 min-[64rem]:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <img src="/logo.svg" alt="" width={20} height={20} />
            <span>Moons</span>
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100svh-3.25rem)] overflow-y-auto scrollbar-thin">
          <div className="px-3 py-4" onClick={() => setOpen(false)}>
            <SidebarNav nav={props.nav} activeHref={pathname} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
