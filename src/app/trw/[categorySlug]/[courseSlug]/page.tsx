"use client";

import { useTRWCourseDetails, useTRWProgress } from "@/hooks/trw/useTRWHooks";
import { TRWAccessGate } from "@/components/trw/TRWAccessGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  PlayCircle,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { useParams } from "next/navigation";

export default function CourseDetailsPage() {
  const { categorySlug, courseSlug } = useParams() as {
    categorySlug: string;
    courseSlug: string;
  };
  const { data: course, isLoading } = useTRWCourseDetails(courseSlug);
  const { data: progress } = useTRWProgress();

  const isCompleted = (materialId: string) =>
    progress?.some(
      (p: { material_id: string }) => p.material_id === materialId,
    );

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href={`/trw/${categorySlug}`}
          className="p-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {course?.title || "Course Details"}
          </h1>
          <p className="text-muted-foreground">
            {course?.instructor_name || "TRW Instructor"}
          </p>
        </div>
      </div>

      <TRWAccessGate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))
              : course?.modules
                  ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
                  .map((module: any) => (
                    <Card
                      key={module.id}
                      className="overflow-hidden border-muted"
                    >
                      <CardHeader className="bg-muted/30">
                        <CardTitle className="text-lg">
                          {module.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-muted">
                          {module.materials
                            ?.sort(
                              (a: any, b: any) => a.sort_order - b.sort_order,
                            )
                            .map((material: any) => (
                              <div
                                key={material.id}
                                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  {material.type === "video" ? (
                                    <PlayCircle className="w-5 h-5 text-primary" />
                                  ) : material.type === "file" ? (
                                    <FileText className="w-5 h-5 text-blue-500" />
                                  ) : (
                                    <LinkIcon className="w-5 h-5 text-green-500" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">
                                      {material.title}
                                    </p>
                                    {material.duration_s && (
                                      <p className="text-xs text-muted-foreground">
                                        {Math.floor(material.duration_s / 60)}m{" "}
                                        {material.duration_s % 60}s
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {isCompleted(material.id) && (
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                )}
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {course?.thumbnail_url && (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full rounded-lg shadow-sm"
                  />
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {course?.description}
                </p>
                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Modules</span>
                    <span className="font-medium">
                      {course?.modules?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Materials
                    </span>
                    <span className="font-medium">
                      {course?.modules?.reduce(
                        (acc: number, m: any) =>
                          acc + (m.materials?.length || 0),
                        0,
                      ) || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TRWAccessGate>
    </div>
  );
}
