"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Props = {
  children: ReactNode;
  pathname: string;
};

export function PageTransition({ children, pathname }: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                duration: 0.2,
                ease: "easeInOut",
              }
        }
        className="flex h-full min-h-0 w-full flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
