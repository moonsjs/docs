import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SearchRecord } from "@/lib/content-types";
import { useClientNavigate } from "./client-navigator";

export function Search() {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<SearchRecord[] | null>(null);
  const go = useClientNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || records !== null) {
      return;
    }
    void import("@/generated/search.json")
      .then((module) => {
        setRecords(module.default as SearchRecord[]);
      })
      .catch(() => {
        setRecords([]);
      });
  }, [open, records]);

  const select = (href: string): void => {
    setOpen(false);
    go(href);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 px-3 text-muted-foreground sm:w-56 sm:justify-start"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-4" />
        <span className="sr-only sm:not-sr-only">Search</span>
        <kbd className="ml-auto hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search documentation…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documentation">
            {(records ?? []).map((record) => (
              <CommandItem
                key={record.href}
                value={`${record.title} ${record.section} ${record.headings.join(" ")}`}
                onSelect={() => select(record.href)}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{record.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {record.section} · {record.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
