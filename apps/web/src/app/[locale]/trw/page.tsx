"use client";

import Image from "next/image";
import useTRWCategories from "@/hooks/trw/useTRWCategories";
import { TRWAccessGate } from "@/components/trw/TRWAccessGate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export default function TRWLandingPage() {
  const { data: categories, isLoading: isLoadingCats } = useTRWCategories();

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight uppercase">
            MONEY MAKING IS A SKILL
          </h1>
          <p className="text-muted-foreground">
            Here you will teach you how to master it
          </p>
        </div>
      </div>

      <TRWAccessGate>
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
            : categories?.map(
                (category: {
                  id: string;
                  slug: string;
                  cover_url?: string;
                  name: string;
                  description?: string;
                }) => (
                  <Link key={category.id} href={`/trw/${category.slug}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-all border-muted hover:border-primary/50">
                      {category.cover_url && (
                        <div className="h-48 overflow-hidden relative">
                          <Image
                            src={category.cover_url}
                            alt={category.name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                ),
              )}
        </div>

        {!isLoadingCats && categories?.length === 0 && (
          <div className="text-center py-20 border rounded-xl bg-muted/20">
            <p className="text-muted-foreground font-medium">
              No categories available yet.
            </p>
          </div>
        )}
      </TRWAccessGate>
    </div>
  );
}
