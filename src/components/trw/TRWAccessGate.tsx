"use client";

import React from "react";
import { useTRWMembership } from "@/hooks/trw/useTRWHooks";
import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface TRWAccessGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function TRWAccessGate({ children, fallback }: TRWAccessGateProps) {
  const { data: membership, isLoading } = useTRWMembership();
  const pathname = usePathname();
  const localePrefix = pathname?.startsWith("/en") ? "/en" : "/ar";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Verifying TRW membership...
        </p>
      </div>
    );
  }

  if (!membership) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-6 bg-card border rounded-xl shadow-sm">
        <div className="p-4 bg-primary/10 rounded-full">
          <Lock className="w-12 h-12 text-primary" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Access Required</h2>
          <p className="text-muted-foreground">
            You need an active TRW membership to view this content. If you have
            an access code, you can redeem it below.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href={`${localePrefix}/trw/redeem`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Redeem Access Code
          </Link>
          <Link
            href={`${localePrefix}/`}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
