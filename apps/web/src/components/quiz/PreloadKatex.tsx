"use client";

import { useEffect } from "react";

export function PreloadKatex() {
  useEffect(() => {
    void import("@/components/HeavyLatexRenderer");
  }, []);

  return null;
}
