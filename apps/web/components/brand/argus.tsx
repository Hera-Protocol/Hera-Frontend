"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { useShowArgus } from "@/lib/hooks/account";

/**
 * Argus, Hera's peacock. In the myth Hera set the hundred eyes of Argus on
 * the peacock's tail; here the tail's eyes watch your transactions.
 *
 * Moods map to screening outcomes:
 *   idle     gentle sway, slow look-around
 *   scanning tail eyes dart, feathers flutter
 *   happy    a little hop (clear result)
 *   alarmed  feathers flare, pupils lock forward (severe result)
 */
export type ArgusMood = "idle" | "scanning" | "happy" | "alarmed";

const FEATHER_ANGLES = [-68, -45, -22, 0, 22, 45, 68];
const PIVOT = { x: 100, y: 132 };
const INK = "var(--line)";

const LOOK_TARGETS = [
  { x: 0, y: 0 },
  { x: 2.2, y: -1 },
  { x: -2.2, y: 0.6 },
  { x: 1.2, y: 1.6 },
  { x: -1.4, y: -1.6 },
];

function useLook(mood: ArgusMood, reduced: boolean | null) {
  const [look, setLook] = useState(LOOK_TARGETS[0]!);
  useEffect(() => {
    if (reduced || mood === "alarmed") {
      setLook({ x: 0, y: 0 });
      return;
    }
    const interval = mood === "scanning" ? 260 : 1900;
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1 + Math.floor(Math.random() * 3)) % LOOK_TARGETS.length;
      setLook(LOOK_TARGETS[i]!);
    }, interval);
    return () => clearInterval(timer);
  }, [mood, reduced]);
  return look;
}

function useBlink(reduced: boolean | null) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (reduced) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        setClosed(true);
        setTimeout(() => setClosed(false), 140);
        schedule();
      }, 3200 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [reduced]);
  return closed;
}

export function Argus({
  mood = "idle",
  size = 160,
  className,
  title = "Argus the peacock",
}: {
  mood?: ArgusMood;
  size?: number;
  className?: string;
  title?: string;
}) {
  const reduced = useReducedMotion();
  // "Show Argus" (Settings) applies to the dashboard; the public site always shows him.
  const [showArgus] = useShowArgus();
  const inApp = usePathname()?.startsWith("/app") ?? false;
  const look = useLook(mood, reduced);
  const blink = useBlink(reduced);
  const gradientId = useId();

  const spread = mood === "alarmed" ? 1.18 : mood === "happy" ? 1.06 : 1;

  if (inApp && !showArgus) return null;

  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("overflow-visible", className)}
      animate={
        reduced
          ? undefined
          : mood === "happy"
            ? { y: [0, -10, 0, -5, 0] }
            : mood === "alarmed"
              ? { x: [0, -2, 2, -2, 2, 0] }
              : { y: [0, -3, 0] }
      }
      transition={
        mood === "happy"
          ? { duration: 0.9, ease: "easeOut" }
          : mood === "alarmed"
            ? { duration: 0.45 }
            : { duration: 4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#6f7cff" />
          <stop offset="100%" stopColor="#3a48e0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="100" cy="186" rx="44" ry="6" fill="var(--shadow-color)" opacity="0.15" />

      {/* tail fan */}
      <g>
        {FEATHER_ANGLES.map((angle, i) => (
          <motion.g
            key={angle}
            // view-box: Motion defaults SVG groups to fill-box, which would pivot each feather on itself.
            style={{ transformBox: "view-box", originX: `${PIVOT.x}px`, originY: `${PIVOT.y}px` }}
            initial={{ rotate: angle * 0.2, scale: 0.6 }}
            animate={{
              rotate: reduced ? angle : mood === "scanning" ? [angle * spread, angle * spread + (i % 2 ? 3 : -3), angle * spread] : angle * spread,
              scale: 1,
            }}
            transition={
              mood === "scanning" && !reduced
                ? { rotate: { duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }, scale: { type: "spring", stiffness: 200, damping: 14 } }
                : { type: "spring", stiffness: 180, damping: 13, delay: i * 0.03 }
            }
          >
            <line x1={PIVOT.x} y1={PIVOT.y} x2="100" y2="44" stroke={INK} strokeWidth="2.5" />
            <ellipse cx="100" cy="52" rx="17" ry="27" fill="var(--peacock)" stroke={INK} strokeWidth="2.5" />
            <ellipse cx="100" cy="50" rx="11" ry="13" fill="var(--sun)" stroke={INK} strokeWidth="2" />
            <circle cx="100" cy="50" r="6.5" fill="#2f3fd6" stroke={INK} strokeWidth="1.5" />
            <motion.circle
              cx="100"
              cy="50"
              r="3"
              fill="#17130f"
              animate={{ x: look.x * 0.9, y: look.y * 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            />
          </motion.g>
        ))}
      </g>

      {/* feet */}
      <g stroke="var(--tangerine)" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M91 166 L89 182 M89 182 L82 184 M89 182 L94 185" />
        <path d="M109 166 L111 182 M111 182 L104 185 M111 182 L118 184" />
      </g>

      {/* body */}
      <path
        d="M100 86 C123 86 133 118 129 143 C126 161 113 170 100 170 C87 170 74 161 71 143 C67 118 77 86 100 86 Z"
        fill={`url(#${gradientId})`}
        stroke={INK}
        strokeWidth="3"
      />
      <path d="M100 118 C112 118 117 134 115 147 C113 158 107 163 100 163 C93 163 87 158 85 147 C83 134 88 118 100 118 Z" fill="var(--peacock)" opacity="0.9" />
      {/* wing */}
      <path d="M78 122 C72 136 76 154 90 160 C86 146 86 133 92 122 Z" fill="#2c38c4" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />

      {/* crest */}
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <line x1="100" y1="54" x2="90" y2="34" />
        <line x1="100" y1="54" x2="100" y2="29" />
        <line x1="100" y1="54" x2="110" y2="34" />
      </g>
      {[[90, 34], [100, 29], [110, 34]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.5" fill="var(--peacock)" stroke={INK} strokeWidth="2.5" />
      ))}

      {/* head */}
      <circle cx="100" cy="70" r="21" fill={`url(#${gradientId})`} stroke={INK} strokeWidth="3" />
      {/* beak */}
      <path d="M119 67 L134 72.5 L119 78 Z" fill="var(--tangerine)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* cheek */}
      <circle cx="98" cy="80" r="4.5" fill="var(--blush)" opacity="0.85" />
      {/* eye */}
      <motion.g
        style={{ transformBox: "view-box", originX: "108px", originY: "66px" }}
        animate={{ scaleY: blink ? 0.1 : 1 }}
        transition={{ duration: 0.08 }}
      >
        <circle cx="108" cy="66" r="8.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <motion.g animate={{ x: look.x, y: look.y }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <circle cx="109" cy="66" r={mood === "alarmed" ? 2.8 : 4} fill="#17130f" />
          <circle cx="110.5" cy="64.5" r="1.3" fill="#fff" />
        </motion.g>
      </motion.g>
      {mood === "alarmed" && (
        <motion.g initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} stroke={INK} strokeWidth="3" strokeLinecap="round">
          <line x1="128" y1="44" x2="134" y2="34" />
          <line x1="136" y1="52" x2="146" y2="47" />
        </motion.g>
      )}
    </motion.svg>
  );
}
