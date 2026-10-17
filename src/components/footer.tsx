export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>Released under the MIT License.</p>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/moonsjs"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://github.com/moonsjs/cookbook"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Cookbook
          </a>
        </div>
      </div>
    </footer>
  );
}
