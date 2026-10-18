"use client";

import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion`, read after mount so server and client render the
 * same first frame (Motion's hook reads it synchronously, which can cause a
 * hydration mismatch for people who have it on).
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
