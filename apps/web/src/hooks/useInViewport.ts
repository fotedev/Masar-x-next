"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Spec 036 Track C: one IntersectionObserver shared by every subscriber — a
// per-message observer would be N channels of churn for the same job. The
// rootMargin keeps the subject "live" slightly before it scrolls into view.
const ROOT_MARGIN = "200px";

type EntryCallback = (isIntersecting: boolean) => void;

const subscribers = new Map<Element, EntryCallback>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver | null {
  // jsdom (vitest) and IO-less environments have no constructor: the caller's
  // effect falls back to treating everything as visible.
  if (typeof IntersectionObserver === "undefined") return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          subscribers.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
  }
  return sharedObserver;
}

/**
 * Reports whether the attached element is inside (or within 200px of) the
 * viewport. Starts `false` so nothing viewport-dependent mounts at first
 * paint — the observer fires right after mount for anything visible.
 */
export function useInViewport<T extends Element>(): {
  ref: RefObject<T | null>;
  inView: boolean;
} {
  const [inView, setInView] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = getSharedObserver();
    if (!observer) {
      setInView(true);
      return;
    }
    subscribers.set(element, setInView);
    observer.observe(element);
    return () => {
      subscribers.delete(element);
      observer.unobserve(element);
    };
  }, []);

  return { ref, inView };
}
