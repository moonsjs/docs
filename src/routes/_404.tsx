import { Header } from "../components/Header";

export default function NotFound() {
  return (
    <div className="docs-shell">
      <Header locale="en" />
      <div className="shell notfound">
        <p className="notfound-code">404</p>
        <h1>Page not found</h1>
        <p>
          The page you are looking for doesn’t exist. Try the{" "}
          <a href="/start/quickstart">quickstart</a> or the{" "}
          <a href="/id">Indonesian docs</a>.
        </p>
      </div>
    </div>
  );
}
