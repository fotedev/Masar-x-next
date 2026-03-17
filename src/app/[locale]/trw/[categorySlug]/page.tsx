"use client";

import Image from "next/image";
import useTRWCourses from "@/hooks/trw/useTRWCourses";
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
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";

export default function CategoryCoursesPage() {
  const { categorySlug } = useParams() as { categorySlug: string };
  const { data: courses, isLoading } = useTRWCourses(categorySlug);

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/trw"
          className="p-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {categorySlug.replace(/-/g, " ")} Courses
          </h1>
          <p className="text-muted-foreground">
            Pick a course to start your journey.
          </p>
        </div>
      </div>

      <TRWAccessGate>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                </Card>
              ))
            : courses?.map(
                (course: {
                  id: string;
                  slug: string;
                  thumbnail_url?: string;
                  title: string;
                  description?: string;
                }) => (
                  <Link
                    key={course.id}
                    href={`/trw/${categorySlug}/${course.slug}`}
                  >
                    <Card className="group overflow-hidden hover:shadow-md transition-all">
                      {course.thumbnail_url && (
                        <div className="h-40 overflow-hidden relative">
                          <Image
                            src={course.thumbnail_url}
                            alt={course.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="text-xl line-clamp-1">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {course.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-muted-foreground">
                          <BookOpen className="w-4 h-4 mr-2" />
                          View Modules
                        </div>
                        <ChevronRight className="w-4 h-4 text-primary" />
                      </CardContent>
                    </Card>
                  </Link>
                ),
              )}
        </div>

        {!isLoading && courses?.length === 0 && (
          <div className="text-center py-20 border rounded-xl bg-muted/20">
            <p className="text-muted-foreground">
              No courses found in this category.
            </p>
          </div>
        )}
      </TRWAccessGate>
    </div>
  );
}
