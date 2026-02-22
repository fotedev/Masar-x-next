"use client";

import { useTRWMembership } from "@/hooks/trw/useTRWHooks";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubjectsGrid } from "../../components/SubjectsGrid";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function NonAcademicPage() {
  const router = useRouter();
  const { data: membership, isLoading: membershipLoading } = useTRWMembership();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (membershipLoading) return;

    if (membership) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      // Wait for a tick to avoid "update during render" warning if called directly
      const timer = setTimeout(() => {
        router.replace("/");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [membership, membershipLoading, router]);

  const handleSubjectClick = (subjectName: string) => {
    router.push(`/non-academic/${encodeURIComponent(subjectName)}`);
  };

  if (membershipLoading || isAuthorized === null) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse">
          Authenticating...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-slate-500">
          System authentication failed. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center mb-4">
          <img
            src="https://framerusercontent.com/images/lVFqGPfJm0f8Q6XqNcyZnWvQUe8.webp?width=256&height=256"
            alt="TRW Logo"
            className="w-20 h-20 object-contain shadow-lg rounded-2xl"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight uppercase">
          MONEY MAKING IS A SKILL
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Here you will teach you how to master it
        </p>
      </div>

      <div className="modern-card p-6 sm:p-8">
        <SubjectsGrid onSubjectClick={handleSubjectClick} is_academic={false} />
      </div>
    </div>
  );
}
