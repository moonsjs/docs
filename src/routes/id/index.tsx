import { Landing } from "../../components/Landing";

export const prerender = true;

export const meta = () => ({
  title: "Moons — TypeScript full-stack yang tak bisa membocorkan kode server",
  description:
    "Framework full-stack berbasis file untuk React: SSR, loader, server function, dan endpoint API mentah — dengan batas build-time yang membuat kebocoran kode server mustahil.",
});

export default function HomeId() {
  return <Landing locale="id" />;
}
