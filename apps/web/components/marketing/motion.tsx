"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";
import type { ReactNode } from "react";

/** One spring for the whole marketing site: quick, a little bouncy, never wobbly. */
export const SPRING = { type: "spring", stiffness: 260, damping: 20 } as const;

const VIEWPORT = { once: true, margin: "0px 0px -80px 0px" } as const;

type Tag = "div" | "section" | "article" | "li" | "ul" | "ol";

const MOTION = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  ul: motion.ul,
  ol: motion.ol,
} as const;

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  as?: Tag;
  children?: ReactNode;
  /** Seconds before this element starts its entrance. */
  delay?: number;
  /** Distance in px the element rises from. */
  y?: number;
};

/** Fades and rises into place the first time it scrolls into view. */
export function Reveal({ as = "div", delay = 0, y = 24, children, ...props }: RevealProps) {
  const Component = MOTION[as] as typeof motion.div;
  return (
    <Component
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ ...SPRING, delay }}
      {...props}
    >
      {children}
    </Component>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
};

type StaggerProps = Omit<HTMLMotionProps<"div">, "children"> & { as?: Tag; children?: ReactNode };

/** Parent for a group of cards: children with `StaggerItem` enter one after another. */
export function Stagger({ as = "div", children, ...props }: StaggerProps) {
  const Component = MOTION[as] as typeof motion.div;
  return (
    <Component initial="hidden" whileInView="show" viewport={VIEWPORT} variants={container} {...props}>
      {children}
    </Component>
  );
}

/** A staggered child. `lift` adds a springy hover lift for cards. */
export function StaggerItem({ as = "div", lift = false, children, ...props }: StaggerProps & { lift?: boolean }) {
  const Component = MOTION[as] as typeof motion.div;
  return (
    <Component variants={item} whileHover={lift ? { y: -5, rotate: -0.4, transition: SPRING } : undefined} {...props}>
      {children}
    </Component>
  );
}
