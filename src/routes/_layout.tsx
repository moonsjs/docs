import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";
import { ClientNavigator } from "@/components/client-navigator";
import { Footer } from "@/components/footer";

export default function Layout(props: { children?: ReactNode }) {
  return (
    <ClientNavigator>
      <LazyMotion features={() => import("@/lib/motion-features").then((mod) => mod.domMax)} strict>
        <div className="flex min-h-svh flex-col">
          <div className="flex flex-1 flex-col">{props.children}</div>
          <Footer />
        </div>
      </LazyMotion>
    </ClientNavigator>
  );
}
