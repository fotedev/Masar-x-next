import React from "react";
import { Edit, Eye, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Badge } from "../ui/Badge";
import { CourseWithInstructor } from "@/types/database";

interface CourseCardProps {
  course: CourseWithInstructor;
  onEdit: (course: CourseWithInstructor) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, currentStatus: boolean) => void;
}

export function CourseCard({
  course,
  onEdit,
  onDelete,
  onTogglePublish,
}: CourseCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge variant={course.price === 0 ? "secondary" : "default"}>
            {course.price === 0 ? "مجاني" : `${course.price} جنيه`}
          </Badge>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onTogglePublish(course.id, course.is_published)}
              className={`p-1 rounded-full transition-colors ${
                course.is_published
                  ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              title={course.is_published ? "إلغاء النشر" : "نشر الكورس"}
            >
              {course.is_published ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
        <CardDescription className="line-clamp-3">
          {course.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>المدرب: {course.instructor_name}</span>
            <span>{course.enrollments_count} طالب</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(course)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/courses/${course.id}`, "_blank")}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(course.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
