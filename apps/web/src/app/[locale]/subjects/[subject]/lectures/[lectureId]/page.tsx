"use client";

import { Suspense } from "react";
import SubjectPage from "../../page";

export default function LecturePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh-safe">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    }>
      <SubjectPage />
    </Suspense>
  );
}
