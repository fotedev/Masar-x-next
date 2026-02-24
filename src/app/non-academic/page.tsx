"use client";

import { useTRWCategories, useTRWMembership } from "@/hooks/trw/useTRWHooks";
import { TRWAccessGate } from "@/components/trw/TRWAccessGate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2, ArrowRight, BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

export default function NonAcademicPage() {
  const router = useRouter();
  const { data: membership, isLoading: membershipLoading } = useTRWMembership();
  const { data: categories, isLoading: isLoadingCats } = useTRWCategories();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (membershipLoading) return;

    if (membership) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      const timer = setTimeout(() => {
        router.replace("/");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [membership, membershipLoading, router]);

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
    <TRWAccessGate>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingCats
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                </Card>
              ))
            : categories?.map((category: any) => (
                <Link key={category.id} href={`/trw/${category.slug}`}>
                  <Card className="group overflow-hidden hover:shadow-lg transition-all border-muted hover:border-primary/50">
                    {category.cover_url && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={category.cover_url}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {category.name}
                        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {category.description ||
                          "Access premium training materials."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Browse Courses
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>

        {!isLoadingCats && categories?.length === 0 && (
          <div className="text-center py-20 border rounded-xl bg-muted/20">
            <p className="text-muted-foreground font-medium">
              No categories available yet.
            </p>
          </div>
        )}
      </div>
    </TRWAccessGate>
  );
}
