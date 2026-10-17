import { m, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Progressive-enhancement reveal: the server-rendered HTML is fully visible
 * (no hidden content without JS), and the entrance animation only arms after
 * hydration when the visitor allows motion.
 */
export function MotionReveal(props: { children: ReactNode; className?: string | undefined; delay?: number | undefined }) {
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(true);
  }, []);

  const animate = armed && reduce !== true;
  const motionProps = animate
    ? { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 } }
    : { initial: false as const };

  return (
    <m.div
      className={props.className}
      {...motionProps}
      viewport={{ once: true, margin: "-64px" }}
      transition={{
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
        delay: props.delay ?? 0,
      }}
    >
      {props.children}
    </m.div>
  );
}
